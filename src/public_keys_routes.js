const { z } = require('zod');
const { useDb } = require('./config');
const billingDb = require('./billing_db');
const { makeChallenge, verifyChallengeToken, checkSolution } = require('./pow');

function registerPublicKeysRoutes(app) {
  // Get a PoW challenge (stateless, signed).
  app.get('/v1/public/pow', { config: { rateLimit: { max: 60, timeWindow: 10 * 60 * 1000 } } }, async (req, reply) => {
    try {
      const difficulty = Number(process.env.POW_DIFFICULTY || 4);
      const ttlMs = Number(process.env.POW_TTL_MS || 2 * 60 * 1000);
      const c = makeChallenge({ difficulty, ttlMs });
      return { ok: true, challenge: { token: c.token, difficulty: c.difficulty, expires_at: new Date(c.exp).toISOString() } };
    } catch (e) {
      reply.code(500);
      return { ok: false, error: 'pow_not_configured' };
    }
  });

  // Public: create API key (credits=0 only) with PoW.
  app.post('/v1/public/keys', { config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } } }, async (req, reply) => {
    if (!useDb()) {
      reply.code(400);
      return { ok: false, error: 'db_required' };
    }

    const Body = z.object({
      name: z.string().optional(),
      pow: z.object({ token: z.string().min(10), nonce: z.string().min(1).max(200) }),
    });

    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body' };
    }

    const { name, pow } = parsed.data;
    const v = verifyChallengeToken(pow.token);
    if (!v.ok) {
      reply.code(403);
      return { ok: false, error: 'pow_invalid', detail: v.error };
    }

    const ok = checkSolution({ id: v.payload.id, nonce: pow.nonce, difficulty: v.payload.difficulty });
    if (!ok) {
      reply.code(403);
      return { ok: false, error: 'pow_invalid', detail: 'bad_nonce' };
    }

    const safeName = String(name || 'selfserve').slice(0, 80);
    const k = await billingDb.createKey({ name: safeName, credits: 0 });
    return { ok: true, key: { id: k.id, name: k.name, credits: k.credits, apiKey: k.plaintextKey, created_at: k.createdAt } };
  });
}

module.exports = { registerPublicKeysRoutes };
