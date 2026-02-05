const { loadStore } = require('../src/billing');
const store = loadStore();
const keys = Object.entries(store.keys || {}).map(([k, v]) => ({ apiKey: k, ...v }));
keys.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
console.log(keys.slice(0, 5));
