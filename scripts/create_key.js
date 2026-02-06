require('dotenv').config({
  path: require('node:path').join(__dirname, '..', '.env'),
  override: true,
});

const { useDb } = require('../src/config');

const name = process.argv[2] || 'local';
const credits = Number(process.argv[3] || 200);

(async () => {
  if (useDb()) {
    const { createKey } = require('../src/billing_db');
    const k = await createKey({ name, credits });
    console.log('API key created (DB):');
    console.log('  name   :', k.name);
    console.log('  id     :', k.id);
    console.log('  credits:', k.credits);
    console.log('  key    :', k.plaintextKey);
    return;
  }

  const { createKey } = require('../src/billing');
  const k = createKey({ name, credits });
  console.log('API key created (file-store):');
  console.log('  name   :', k.name);
  console.log('  id     :', k.id);
  console.log('  credits:', k.credits);
  console.log('  key    :', k.apiKey);
})();
