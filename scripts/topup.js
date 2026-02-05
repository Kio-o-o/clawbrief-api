const fs = require('node:fs');
const path = require('node:path');

const storePath = path.join(__dirname, '..', 'data', 'store.json');
if (!fs.existsSync(storePath)) throw new Error('store.json not found');

const apiKey = process.argv[2];
const add = Number(process.argv[3] || 0);
if (!apiKey || !add) {
  console.log('Usage: node scripts/topup.js <apiKey> <addCredits>');
  process.exit(2);
}

const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const k = store.keys?.[apiKey];
if (!k) throw new Error('invalid apiKey');

k.credits += add;
fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
console.log('ok. new credits:', k.credits);
