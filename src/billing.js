const fs = require('node:fs');
const path = require('node:path');
const { nanoid } = require('nanoid');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ keys: {}, usage: [] }, null, 2),
      'utf8',
    );
  }
}

function loadStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function saveStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function parseAuth(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function nowIso() {
  return new Date().toISOString();
}

function computeCost({ sourceKind, mimetype, bytes, pages, textChars, pixels }) {
  // Reasonable + scalable credit pricing (MVP):
  // - text: base 1 + 1 per additional 4k chars
  // - url:  base 2 + 1 per additional 6k chars
  // - pdf:  base 2 + 1 per 5 pages + 1 per additional 10k extracted chars
  // - image: base 2 + 1 per ~2MP

  const tc = Math.max(0, Number(textChars || 0));

  if (sourceKind === 'text') {
    return 1 + Math.floor(Math.max(0, tc - 4000) / 4000);
  }

  if (sourceKind === 'url') {
    return 2 + Math.floor(Math.max(0, tc - 6000) / 6000);
  }

  if (sourceKind === 'file') {
    const mt = String(mimetype || '').toLowerCase();

    if (mt.includes('pdf')) {
      const p = Math.max(1, Number(pages || 1));
      const byPages = 2 + Math.floor((p - 1) / 5);
      const byText = Math.floor(Math.max(0, tc - 10000) / 10000);
      return byPages + byText;
    }

    if (mt.startsWith('image/')) {
      const px = Number(pixels || 0);
      const mp = px > 0 ? px / 1_000_000 : 1;
      return 2 + Math.floor(Math.max(0, mp - 2) / 2);
    }

    // fallback
    const b = Math.max(0, Number(bytes || 0));
    return 2 + Math.floor(b / (5 * 1024 * 1024));
  }

  return 1;
}

function getUsageForKey(store, apiKey) {
  const k = store.keys[apiKey];
  if (!k) return null;
  return {
    id: k.id,
    name: k.name,
    credits: k.credits,
    created_at: k.created_at,
    disabled: !!k.disabled,
  };
}

function createKey({ name = 'default', credits = 100 }) {
  const store = loadStore();
  const apiKey = `cb_${nanoid(32)}`;
  store.keys[apiKey] = {
    id: nanoid(10),
    name,
    credits,
    created_at: nowIso(),
    disabled: false,
  };
  saveStore(store);
  return { apiKey, ...getUsageForKey(store, apiKey) };
}

function creditKey({ apiKey, addCredits, event }) {
  const store = loadStore();
  const k = store.keys[apiKey];
  if (!k || k.disabled) return { ok: false, error: 'invalid_key' };
  k.credits += Number(addCredits || 0);
  store.usage.push({
    at: nowIso(),
    apiKeyId: k.id,
    cost: -Math.abs(Number(addCredits || 0)),
    event,
  });
  if (store.usage.length > 5000) store.usage = store.usage.slice(-2000);
  saveStore(store);
  return { ok: true, credits: k.credits, key: getUsageForKey(store, apiKey) };
}

function charge({ apiKey, cost, event }) {
  const store = loadStore();
  const k = store.keys[apiKey];
  if (!k || k.disabled) return { ok: false, error: 'invalid_key' };
  if (k.credits < cost) return { ok: false, error: 'insufficient_credits', credits: k.credits };

  k.credits -= cost;
  store.usage.push({
    at: nowIso(),
    apiKeyId: k.id,
    cost,
    event,
  });
  // Keep usage log bounded.
  if (store.usage.length > 5000) store.usage = store.usage.slice(-2000);
  saveStore(store);
  return { ok: true, credits: k.credits, key: getUsageForKey(store, apiKey) };
}

module.exports = {
  parseAuth,
  computeCost,
  getUsageForKey,
  createKey,
  creditKey,
  charge,
  loadStore,
};
