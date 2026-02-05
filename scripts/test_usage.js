const { request } = require('undici');

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node scripts/test_usage.js <apiKey>');
  process.exit(2);
}

(async () => {
  const r = await request('http://127.0.0.1:8787/v1/usage', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await r.body.text();
  console.log('HTTP', r.statusCode);
  console.log(text);
})();
