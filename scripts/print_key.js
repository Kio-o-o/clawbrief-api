require('dotenv').config({
  path: require('node:path').join(__dirname, '..', '.env'),
  override: true,
});

const { useDb } = require('../src/config');

(async () => {
  if (useDb()) {
    const { getPrisma } = require('../src/db');
    const prisma = getPrisma();
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, credits: true, disabled: true, createdAt: true, lastUsedAt: true },
    });
    console.log(keys);
    console.log('\n(note) DB mode stores only key hashes; plaintext keys are shown only on creation.');
    return;
  }

  const { loadStore } = require('../src/billing');
  const store = loadStore();
  const keys = Object.entries(store.keys || {}).map(([k, v]) => ({ apiKey: k, ...v }));
  keys.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  console.log(keys.slice(0, 10));
})();
