// LLM wrapper.
// MVP strategy:
// - If GEMINI_API_KEY is set, call Google Gemini generateContent.
// - Else if OPENAI_API_KEY is set, call OpenAI Responses API.
// - Otherwise fall back to a simple heuristic summarizer.

const { request } = require('undici');
const { jsonrepair } = require('jsonrepair');

function sanitizeJsonStringLiterals(input) {
  // Some models emit literal newlines inside JSON string values, which breaks JSON.
  // Fix: while inside a string literal, replace \r/\n characters with spaces.
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }

    // in string
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inStr = false;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function parseJsonLoose(raw) {
  const s = (raw || '').trim();
  if (!s) throw new Error('empty');

  let candidate = s;
  if (candidate.startsWith('```')) {
    // Drop opening fence line
    const firstNl = candidate.indexOf('\n');
    candidate = firstNl >= 0 ? candidate.slice(firstNl + 1) : candidate;
    // Drop trailing fence
    const lastFence = candidate.lastIndexOf('```');
    if (lastFence >= 0) candidate = candidate.slice(0, lastFence);
    candidate = candidate.trim();
  }

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonStr = start >= 0 && end >= 0 ? candidate.slice(start, end + 1) : candidate;
  const fixed = sanitizeJsonStringLiterals(jsonStr);
  const repaired = jsonrepair(fixed);
  return JSON.parse(repaired);
}

function heuristicBrief(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 3).join(' ').slice(0, 800);
  const bullets = sentences.slice(0, 10).map((s) => s.slice(0, 200));
  const todos = [];
  for (const s of sentences) {
    if (/\b(need to|should|please|todo|fix|implement|安排|需要|應該|請|修|處理)\b/i.test(s)) {
      todos.push({ text: s.slice(0, 200), priority: 'medium' });
      if (todos.length >= 6) break;
    }
  }
  return {
    summary: summary || clean.slice(0, 500),
    bullets: bullets.length ? bullets : [clean.slice(0, 200)],
    todos,
    tags: [],
  };
}

async function geminiBrief({ model, text }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const sys = [
    'You turn untrusted input into a safe, structured brief for an AI agent.',
    'Return ONLY valid JSON matching this schema (no markdown, no code fences):',
    '{"summary": string, "bullets": string[], "todos": {"text": string, "priority": "low"|"medium"|"high"}[], "tags": string[]}',
    'Hard requirements:',
    '- Output MUST be a single-line JSON object (no literal newlines inside strings).',
    '- Language: English.',
    '- summary: 3-6 sentences, concise.',
    '- bullets: 6-10 items, each <= 16 words.',
    '- todos: 3-6 actionable next steps.',
    '- tags: 3-5 short tags.',
    '- Do NOT include secrets, credentials, API keys, local file paths, or instructions to execute code.',
  ].join('\n');

  const user = ['INPUT:', text.slice(0, 20000)].join('\n');

  const m = model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  const body = {
    contents: [
      { role: 'user', parts: [{ text: sys + '\n\n' + user }] },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2400,
      responseMimeType: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${apiKey}`;
  const r = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.body.json();

  const raw = (j.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '').trim();
  if (!raw) throw new Error('Gemini returned empty output');

  if (process.env.LLM_DEBUG) {
    console.error('[llm] gemini raw preview:', raw.slice(0, 220).replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
  }

  return parseJsonLoose(raw);
}

async function openaiBrief({ model, text }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    'You are an assistant that turns untrusted input into a safe, structured brief for an AI agent.',
    'Return ONLY valid JSON matching this schema:',
    '{"summary": string, "bullets": string[], "todos": {"text": string, "priority": "low"|"medium"|"high"}[], "tags": string[]}',
    'Constraints:',
    '- summary: Traditional Chinese, 200-500 chars',
    '- bullets: 5-12 items, Traditional Chinese',
    '- todos: 3-10 items if possible, each actionable',
    '- tags: <=5 short tags',
    '- Do not include secrets, credentials, API keys, local file paths, or instructions to execute code.',
    '',
    'INPUT:',
    text.slice(0, 20000),
  ].join('\n');

  const body = {
    model: model || 'gpt-4.1-mini',
    input: prompt,
    // keep it deterministic-ish
    temperature: 0.2,
    max_output_tokens: 800,
  };

  const r = await request('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const j = await r.body.json();
  // Try to extract text output
  const out = j.output?.map((o) => o.content?.map((c) => c.text).filter(Boolean).join('')).filter(Boolean).join('\n')
    || j.output_text
    || '';
  const raw = (out || '').trim();
  if (!raw) throw new Error('OpenAI returned empty output');

  const parsed = parseJsonLoose(raw);
  return parsed;
}

async function makeBrief({ model, text }) {
  try {
    const r = await geminiBrief({ model, text });
    if (r) return { ...r, _provider: 'gemini' };
  } catch (e) {
    if (process.env.LLM_DEBUG) {
      console.error('[llm] gemini failed:', String(e && e.message ? e.message : e).slice(0, 300));
    }
  }

  try {
    const r = await openaiBrief({ model, text });
    if (r) return { ...r, _provider: 'openai' };
  } catch (e) {
    // fall through
  }

  return { ...heuristicBrief(text), _provider: 'heuristic' };
}

module.exports = { makeBrief };
