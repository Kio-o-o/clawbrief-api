// Load .env explicitly from project root (so it works even when started elsewhere)
require('dotenv').config({
  path: require('node:path').join(__dirname, '..', '.env'),
  override: true,
});

const path = require('node:path');
const fs = require('node:fs/promises');

const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const { PDFParse } = require('pdf-parse');
const sharp = require('sharp');
const { z } = require('zod');

const { fetchUrlText } = require('./extract');
const { ocrImageToText } = require('./ocr');
const { detectRiskFlags } = require('./risk');
const { makeBrief } = require('./llm');
const { requireAdmin } = require('./admin');
const { registerMonitoringRoutes } = require('./monitoring_routes');
const { initSentry } = require('./sentry');
const { httpRequestDuration, creditsCharged } = require('./metrics');

// Billing backend: DB when DATABASE_URL is set; otherwise file-store for local dev.
const billingDb = require('./billing_db');
const billingFile = require('./billing');
const { useDb } = require('./config');
const { parseAuth, getApiKeyRow } = require('./auth');

const app = Fastify({ logger: true });
const { registerTopupRoutes } = require('./topup_routes');
const { registerTopupWebhookRoutes } = require('./topup_webhook');

initSentry(app);
registerMonitoringRoutes(app);

// metrics: request duration
app.addHook('onRequest', async (req) => {
  req._startAt = process.hrtime.bigint();
});
app.addHook('onResponse', async (req, reply) => {
  if (!req._startAt) return;
  const sec = Number(process.hrtime.bigint() - req._startAt) / 1e9;
  const route = req.routerPath || req.url;
  httpRequestDuration.labels(req.method, route, String(reply.statusCode)).observe(sec);
});

// Rate limit (per key): protects costs.
const rateLimit = require('@fastify/rate-limit');
const { getLimitsForKey } = require('./rate');
app.register(rateLimit, {
  global: false,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  keyGenerator: (req) => parseAuth(req) || req.ip,
  max: (req) => getLimitsForKey(parseAuth(req))?.max || 30,
  timeWindow: (req) => getLimitsForKey(parseAuth(req))?.timeWindow || 10 * 60 * 1000,
});

app.register(multipart, {
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB
  },
});

app.get('/healthz', async () => ({ ok: true }));

// Admin: create API keys (DB mode only)
app.post('/v1/admin/keys', async (req, reply) => {
  const deny = requireAdmin(req, reply);
  if (deny) return deny;

  if (!useDb()) {
    reply.code(400);
    return { ok: false, error: 'db_required', message: 'Set DATABASE_URL to use admin key management.' };
  }

  const body = req.body || {};
  const name = String(body.name || 'customer').slice(0, 80);
  const credits = Number(body.credits ?? 0);

  const k = await billingDb.createKey({ name, credits });
  return { ok: true, key: { id: k.id, name: k.name, credits: k.credits, apiKey: k.plaintextKey, created_at: k.createdAt } };
});

app.get('/v1/usage', { config: { rateLimit: { max: 120, timeWindow: 10 * 60 * 1000 } } }, async (req, reply) => {
  const plaintext = parseAuth(req);
  if (!plaintext) {
    reply.code(401);
    return { error: 'missing_auth', message: 'Use Authorization: Bearer <apiKey>' };
  }

  if (useDb()) {
    const row = await getApiKeyRow(plaintext);
    if (!row) {
      reply.code(401);
      return { error: 'invalid_key' };
    }
    const prisma = require('./db').getPrisma();
    const events = await prisma.usageEvent.findMany({
      where: { apiKeyId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { key: { id: row.id, name: row.name, credits: row.credits, disabled: row.disabled, created_at: row.createdAt }, recent: events };
  }

  // file-store
  const store = billingFile.loadStore();
  const info = billingFile.getUsageForKey(store, plaintext);
  if (!info) {
    reply.code(401);
    return { error: 'invalid_key' };
  }
  const events = (store.usage || []).filter((u) => u.apiKeyId === info.id).slice(-50);
  return { key: info, recent: events };
});

const BriefBodySchema = z
  .object({
    text: z.string().optional(),
    url: z.string().url().optional(),
  })
  .refine((v) => (v.text ? 1 : 0) + (v.url ? 1 : 0) === 1, {
    message: 'Provide exactly one of: text or url',
  });

async function readMultipartFile(part) {
  const chunks = [];
  for await (const chunk of part.file) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  return { buf, filename: part.filename, mimetype: part.mimetype };
}

async function ocrBuffer(buf, mimetype) {
  // Use sharp to normalize and write a temp PNG, then run tesseract.
  const tmpDir = process.env.TEMP || process.env.TMP || 'C:/tmp';
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `clawbrief_${Date.now()}_${Math.random().toString(16).slice(2)}.png`);

  let img = sharp(buf, { failOn: 'none' }).rotate();
  // Improve OCR: grayscale + normalize + threshold-ish.
  img = img.grayscale().normalize().sharpen();
  const png = await img.png().toBuffer();
  await fs.writeFile(tmpPath, png);

  try {
    return await ocrImageToText(tmpPath, { lang: process.env.OCR_LANG || 'eng' });
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
}

async function pdfToText(buf) {
  const parser = new PDFParse({ data: buf });
  let pages = null;
  try {
    const info = await parser.getInfo({ parsePageInfo: false });
    pages = info?.total || null;
  } catch {
    // ignore
  }
  const data = await parser.getText();
  await parser.destroy();
  const text = (data.text || '').replace(/\s+/g, ' ').trim();
  return { text, pages };
}

function focusAcademicText(text) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return { focused: '', strategy: 'empty' };

  const markers = [
    '摘要',
    '關鍵字',
    'Abstract',
    'Keywords',
    '結論',
    'Conclusion',
    '研究方法',
    '實驗',
    'Results',
  ];

  // Find windows around markers.
  const windows = [];
  for (const m of markers) {
    let idx = 0;
    const lower = t.toLowerCase();
    const needle = m.toLowerCase();
    while (true) {
      const at = lower.indexOf(needle, idx);
      if (at === -1) break;
      const start = Math.max(0, at - 1200);
      const end = Math.min(t.length, at + 6000);
      windows.push([start, end]);
      idx = at + needle.length;
      if (windows.length > 12) break;
    }
  }

  if (windows.length === 0) {
    // Fallback: take head+tail, avoid acknowledgements dominating.
    const head = t.slice(0, 6000);
    const tail = t.slice(Math.max(0, t.length - 4000));
    return { focused: head + '\n\n' + tail, strategy: 'head_tail' };
  }

  // Merge overlapping windows.
  windows.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (!last || w[0] > last[1]) merged.push([...w]);
    else last[1] = Math.max(last[1], w[1]);
  }

  // Build focused text with separators; cap total length.
  let out = '';
  for (const [s, e] of merged) {
    const chunk = t.slice(s, e).trim();
    if (!chunk) continue;
    if (out) out += '\n\n---\n\n';
    out += chunk;
    if (out.length > 18000) break;
  }
  return { focused: out.slice(0, 18000), strategy: 'marker_windows' };
}

registerTopupRoutes(app);
registerTopupWebhookRoutes(app);

app.post('/v1/brief', { config: { rateLimit: true } }, async (req, reply) => {
  const plaintext = parseAuth(req);
  if (!plaintext) {
    reply.code(401);
    return { error: 'missing_auth', message: 'Use Authorization: Bearer <apiKey>' };
  }

  const apiKeyRow = await getApiKeyRow(plaintext);
  if (!apiKeyRow) {
    reply.code(401);
    return { error: 'invalid_key' };
  }

  const ct = (req.headers['content-type'] || '').toString();
  // Let llm.js pick provider-specific model (GEMINI_MODEL / OPENAI model).
  const model = undefined;

  let source = null;
  let rawText = '';

  if (ct.includes('multipart/form-data')) {
    const parts = req.parts();
    let filePart = null;
    for await (const part of parts) {
      if (part.type === 'file') {
        filePart = part;
        break;
      }
    }
    if (!filePart) {
      reply.code(400);
      return { error: 'missing_file', message: 'multipart/form-data requires a file field' };
    }

    const { buf, filename, mimetype } = await readMultipartFile(filePart);
    source = { kind: 'file', filename, mimetype, bytes: buf.length };

    let pdfMeta = null;
    let imageMeta = null;

    if (mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      const pdf = await pdfToText(buf);
      rawText = pdf.text;
      pdfMeta = { pages: pdf.pages || null };
      if (!rawText) {
        reply.code(400);
        return { error: 'empty_pdf', message: 'PDF extracted to empty text' };
      }
    } else if (mimetype.startsWith('image/')) {
      rawText = await ocrBuffer(buf, mimetype);
      // best-effort pixels count
      try {
        const m = await sharp(buf, { failOn: 'none' }).metadata();
        if (m?.width && m?.height) imageMeta = { pixels: m.width * m.height, width: m.width, height: m.height };
      } catch {}
      if (!rawText) {
        reply.code(400);
        return { error: 'empty_ocr', message: 'OCR extracted empty text' };
      }
    } else {
      reply.code(415);
      return { error: 'unsupported_file', message: `Unsupported mimetype: ${mimetype}` };
    }
  } else {
    const body = BriefBodySchema.parse(req.body || {});
    if (body.text) {
      source = { kind: 'text' };
      rawText = body.text;
    } else {
      source = { kind: 'url', url: body.url };
      rawText = await fetchUrlText(body.url);
    }
  }

  // Charge credits based on size/complexity (after extraction, before LLM).
  const cost = (useDb() ? billingDb.computeCost : billingFile.computeCost)({
    sourceKind: source?.kind,
    mimetype: source?.mimetype,
    bytes: source?.bytes,
    pages: (typeof pdfMeta !== 'undefined' ? pdfMeta?.pages : null),
    textChars: rawText.length,
    pixels: (typeof imageMeta !== 'undefined' ? imageMeta?.pixels : null),
  });

  const charged = useDb()
    ? await billingDb.charge({
        apiKeyRow,
        cost,
        event: {
          endpoint: '/v1/brief',
          source_kind: source?.kind,
          mimetype: source?.mimetype,
          bytes: source?.bytes,
          pages: (typeof pdfMeta !== 'undefined' ? pdfMeta?.pages : null),
          text_chars: rawText.length,
          pixels: (typeof imageMeta !== 'undefined' ? imageMeta?.pixels : null),
        },
      })
    : billingFile.charge({
        apiKey: plaintext,
        cost,
        event: {
          endpoint: '/v1/brief',
          source_kind: source?.kind,
          mimetype: source?.mimetype,
          bytes: source?.bytes,
          pages: (typeof pdfMeta !== 'undefined' ? pdfMeta?.pages : null),
          text_chars: rawText.length,
          pixels: (typeof imageMeta !== 'undefined' ? imageMeta?.pixels : null),
        },
      });

  if (!charged.ok) {
    reply.code(402);
    return { error: charged.error, credits: charged.credits };
  }

  // metrics
  creditsCharged.labels(String(source?.kind || 'unknown'), String(source?.mimetype || '')).inc(cost);

  const risk_flags = detectRiskFlags(rawText);

  let llmInput = rawText;
  let focus = null;
  if (source?.kind === 'file' && (source.mimetype === 'application/pdf' || String(source.filename || '').toLowerCase().endsWith('.pdf'))) {
    const f = focusAcademicText(rawText);
    focus = { strategy: f.strategy, focused_chars: f.focused.length };
    if (f.focused) llmInput = f.focused;
  }

  const brief = await makeBrief({ model, text: llmInput });

  // Ensure minimal fields
  function autoTagsFromText(s) {
    const t = (s || '').toLowerCase();
    const candidates = [
      ['capt', 'CAPT'],
      ['tdnn', 'TDNN'],
      ['gmm-hmm', 'GMM-HMM'],
      ['dnn-hmm', 'DNN-HMM'],
      ['eer', 'EER'],
      ['da', 'DA'],
      ['mandarin', 'Mandarin'],
      ['mispronunciation', 'Mispronunciation'],
      ['發音', '發音'],
      ['錯誤發音', '錯誤發音'],
      ['多任務', '多任務學習'],
      ['語料庫', '語料庫'],
    ];
    const tags = [];
    for (const [needle, tag] of candidates) {
      if (t.includes(needle) && !tags.includes(tag)) tags.push(tag);
      if (tags.length >= 5) break;
    }
    return tags;
  }

  const out = {
    source,
    provider: brief._provider,
    billing: {
      cost,
      credits_remaining: charged.credits,
    },
    summary: String(brief.summary || ''),
    bullets: Array.isArray(brief.bullets) ? brief.bullets.map(String).slice(0, 12) : [],
    todos: Array.isArray(brief.todos)
      ? brief.todos
          .map((t) => ({
            text: String(t.text || '').slice(0, 300),
            priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
          }))
          .slice(0, 10)
      : [],
    tags: Array.isArray(brief.tags) ? brief.tags.map(String).slice(0, 5) : [],
    risk_flags,
    meta: {
      text_chars: rawText.length,
      llm_input_chars: llmInput.length,
      focus,
      pdf: (typeof pdfMeta !== 'undefined' ? pdfMeta : null),
      image: (typeof imageMeta !== 'undefined' ? imageMeta : null),
    },
  };

  if (!out.tags.length) {
    out.tags = autoTagsFromText(out.summary + '\n' + out.bullets.join('\n'));
  }

  return out;
});

async function main() {
  const { isProd } = require('./config');
  const host = process.env.HOST || (isProd() ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT || 8787);
  await app.listen({ host, port });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
