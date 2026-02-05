const crypto = require('node:crypto');
const { nanoid } = require('nanoid');

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function newApiKey() {
  return `cb_${nanoid(32)}`;
}

module.exports = { hashKey, newApiKey };
