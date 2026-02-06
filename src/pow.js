const crypto = require('node:crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function nowMs() {
  return Date.now();
}

function makeChallenge({ ttlMs = 2 * 60 * 1000, difficulty = 4 } = {}) {
  const secret = process.env.POW_SECRET;
  if (!secret) throw new Error('POW_SECRET not configured');

  const id = b64url(crypto.randomBytes(16));
  const exp = nowMs() + ttlMs;
  const payload = { v: 1, id, exp, difficulty };
  const body = b64urlJson(payload);
  const sig = hmac(secret, body);
  return { token: `${body}.${sig}`, ...payload };
}

function verifyChallengeToken(token) {
  const secret = process.env.POW_SECRET;
  if (!secret) return { ok: false, error: 'POW_SECRET_not_configured' };
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { ok: false, error: 'bad_token' };
  const [body, sig] = parts;
  const expect = hmac(secret, body);
  // timing safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'bad_signature' };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'bad_payload' };
  }
  if (!payload || payload.v !== 1) return { ok: false, error: 'bad_version' };
  if (!payload.id || !payload.exp) return { ok: false, error: 'bad_payload' };
  if (nowMs() > Number(payload.exp)) return { ok: false, error: 'expired' };
  const difficulty = Math.max(1, Math.min(10, Number(payload.difficulty || 4)));
  return { ok: true, payload: { id: String(payload.id), exp: Number(payload.exp), difficulty } };
}

function checkSolution({ id, nonce, difficulty }) {
  // sha256(id + '.' + nonce) starts with N hex zeros
  const n = String(nonce ?? '');
  const digest = crypto.createHash('sha256').update(`${id}.${n}`).digest('hex');
  const prefix = '0'.repeat(difficulty);
  return digest.startsWith(prefix);
}

module.exports = { makeChallenge, verifyChallengeToken, checkSolution };
