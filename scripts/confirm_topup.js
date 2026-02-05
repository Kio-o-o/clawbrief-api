const { request } = require('undici');

const invoiceId = process.argv[2];
const txHash = process.argv[3];
const adminToken = process.argv[4] || process.env.CLAWBRIEF_ADMIN_TOKEN;

if (!invoiceId || !txHash) {
  console.error('Usage: node scripts/confirm_topup.js <invoiceId> <txHash> [adminToken]');
  console.error('or set env: CLAWBRIEF_ADMIN_TOKEN');
  process.exit(2);
}
if (!adminToken) {
  console.error('Missing adminToken. Provide as arg or set CLAWBRIEF_ADMIN_TOKEN.');
  process.exit(2);
}

(async () => {
  const r = await request('http://127.0.0.1:8787/v1/topup/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoiceId, txHash }),
  });
  const text = await r.body.text();
  console.log('HTTP', r.statusCode);
  console.log(text);
})();
