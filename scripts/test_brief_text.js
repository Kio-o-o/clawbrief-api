const { request } = require('undici');

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node scripts/test_brief_text.js <apiKey>');
  process.exit(2);
}

(async () => {
  const body = { text: 'Summarize this: ClawBrief turns messy text/URLs/PDFs/images into JSON with summary, bullets, todos, tags.' };
  const r = await request('http://127.0.0.1:8787/v1/brief', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await r.body.text();
  console.log('HTTP', r.statusCode);
  console.log(text);
})();
