const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString('utf8')));
    p.stderr.on('data', (d) => (err += d.toString('utf8')));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`cmd failed (${code}): ${err.slice(0, 500)}`));
      resolve({ out, err });
    });
  });
}

async function ocrImageToText(imagePath, { lang = 'eng', tesseractPath } = {}) {
  const exe = tesseractPath || process.env.TESSERACT_PATH || DEFAULT_TESSERACT;
  if (!fs.existsSync(exe)) throw new Error(`tesseract not found at: ${exe}`);

  // Output to stdout with "-".
  const args = [imagePath, 'stdout', '-l', lang, '--dpi', '300'];
  const { out } = await run(exe, args);
  return out.replace(/\s+\n/g, '\n').trim();
}

module.exports = { ocrImageToText };
