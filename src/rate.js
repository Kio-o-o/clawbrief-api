const { loadStore } = require('./billing');

// Rate limit per API key (simple config; can be made per-plan later)
function getLimitsForKey(apiKey) {
  const store = loadStore();
  const k = store.keys?.[apiKey];
  if (!k) return null;

  // Default: 60 req / 10 minutes
  return { max: 60, timeWindow: 10 * 60 * 1000 };
}

module.exports = { getLimitsForKey };
