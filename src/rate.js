// Central rate-limit policy.
// IMPORTANT: In DB mode we don't want attackers to bypass limits by spraying random Bearer tokens.
// So server.js pre-validates keys (async) and sets req._rateAuthed / req._rateKey.

function getLimitsForReq(req) {
  // Unauthed / unknown key: keep small.
  if (!req._rateAuthed) return { max: 30, timeWindow: 10 * 60 * 1000 };

  // Authed key default (can evolve into per-plan later)
  return { max: 60, timeWindow: 10 * 60 * 1000 };
}

module.exports = { getLimitsForReq };
