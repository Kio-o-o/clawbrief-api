require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const { request } = require('undici');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Return ONLY JSON: {"summary":"hi","bullets":[],"todos":[],"tags":[]}' }],
      },
    ],
    generationConfig: { temperature: 0.0, maxOutputTokens: 50 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const r = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.body.text();
  console.log('HTTP', r.statusCode);
  console.log(text.slice(0, 400));
})();
