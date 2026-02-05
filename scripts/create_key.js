const { createKey } = require('../src/billing');

const name = process.argv[2] || 'local';
const credits = Number(process.argv[3] || 200);
const k = createKey({ name, credits });

console.log('API key created:');
console.log('  name   :', k.name);
console.log('  id     :', k.id);
console.log('  credits:', k.credits);
console.log('  key    :', k.apiKey);
