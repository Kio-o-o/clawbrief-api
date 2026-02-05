const { parseAuth: parseAuthDb, authenticateApiKey } = require('./billing_db');
const { parseAuth: parseAuthFile, loadStore } = require('./billing');
const { useDb } = require('./config');

function parseAuth(req) {
  return useDb() ? parseAuthDb(req) : parseAuthFile(req);
}

async function getApiKeyRow(plaintextKey) {
  if (useDb()) return authenticateApiKey(plaintextKey);
  // file-store: emulate row
  const store = loadStore();
  const k = store.keys?.[plaintextKey];
  if (!k || k.disabled) return null;
  return { id: k.id, name: k.name, credits: k.credits, disabled: k.disabled, _file: true, plaintextKey };
}

module.exports = { parseAuth, getApiKeyRow };
