const { request } = require('undici');
const { execSync } = require('node:child_process');

const apiKey = process.argv[2] || process.env.CLAWBRIEF_API_KEY;
if (!apiKey) {
  console.error('Usage: node scripts/run_ntu.js <apiKey>');
  console.error('or set env: CLAWBRIEF_API_KEY');
  process.exit(2);
}

function findPdf() {
  const out = execSync('where /r C:\\Users\\petri ntu-108-1.pdf', { encoding: 'utf8' }).trim();
  const first = out.split(/\r?\n/).filter(Boolean)[0];
  if (!first) throw new Error('ntu-108-1.pdf not found');
  return first;
}

(async () => {
  const filePath = findPdf();
  console.log('Using:', filePath);

  // Use curl for multipart (simplest on Windows)
  const { execSync } = require('node:child_process');
  const cmd = `"%SystemRoot%\\System32\\curl.exe" -s -H "Authorization: Bearer ${apiKey}" -F "file=@${filePath}" http://127.0.0.1:8787/v1/brief`;
  const text = execSync(cmd, { encoding: 'utf8' });
  console.log(text);
})();
