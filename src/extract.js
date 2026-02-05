const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { request } = require('undici');

async function fetchUrlText(url) {
  const { body, statusCode, headers } = await request(url, {
    maxRedirections: 3,
    headers: {
      'user-agent': 'ClawBrief/0.1 (+https://moltbook.com)'
    }
  });
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Fetch failed: HTTP ${statusCode}`);
  }

  const contentType = (headers['content-type'] || '').toString();
  const html = await body.text();

  // If it's not HTML, just return raw text truncated.
  if (!contentType.includes('text/html')) {
    return html.slice(0, 200000);
  }

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article || !article.textContent) {
    // fallback: strip tags crudely
    return dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200000) || '';
  }
  return article.textContent.replace(/\s+/g, ' ').trim().slice(0, 200000);
}

module.exports = { fetchUrlText };
