const { getPrisma } = require('./db');
const { hashKey, newApiKey } = require('./keys');

function parseAuth(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function computeCost({ sourceKind, mimetype, bytes, pages, textChars, pixels }) {
  const tc = Math.max(0, Number(textChars || 0));

  if (sourceKind === 'text') {
    return 1 + Math.floor(Math.max(0, tc - 4000) / 4000);
  }

  if (sourceKind === 'url') {
    return 2 + Math.floor(Math.max(0, tc - 6000) / 6000);
  }

  if (sourceKind === 'file') {
    const mt = String(mimetype || '').toLowerCase();

    if (mt.includes('pdf')) {
      const p = Math.max(1, Number(pages || 1));
      const byPages = 2 + Math.floor((p - 1) / 5);
      const byText = Math.floor(Math.max(0, tc - 10000) / 10000);
      return byPages + byText;
    }

    if (mt.startsWith('image/')) {
      const px = Number(pixels || 0);
      const mp = px > 0 ? px / 1_000_000 : 1;
      return 2 + Math.floor(Math.max(0, mp - 2) / 2);
    }

    const b = Math.max(0, Number(bytes || 0));
    return 2 + Math.floor(b / (5 * 1024 * 1024));
  }

  return 1;
}

async function authenticateApiKey(plaintextKey) {
  if (!plaintextKey) return null;
  const prisma = getPrisma();
  const keyHash = hashKey(plaintextKey);
  return prisma.apiKey.findUnique({ where: { keyHash } });
}

async function createKey({ name = 'default', credits = 0 }) {
  const prisma = getPrisma();
  const plaintext = newApiKey();
  const keyHash = hashKey(plaintext);
  const row = await prisma.apiKey.create({
    data: { name, keyHash, credits: Number(credits || 0) },
  });
  return { plaintextKey: plaintext, id: row.id, name: row.name, credits: row.credits, createdAt: row.createdAt };
}

async function charge({ apiKeyRow, cost, event }) {
  const prisma = getPrisma();
  if (!apiKeyRow || apiKeyRow.disabled) return { ok: false, error: 'invalid_key' };
  if (apiKeyRow.credits < cost) return { ok: false, error: 'insufficient_credits', credits: apiKeyRow.credits };

  const updated = await prisma.apiKey.update({
    where: { id: apiKeyRow.id },
    data: {
      credits: { decrement: cost },
      lastUsedAt: new Date(),
      usageEvents: {
        create: {
          type: 'CHARGE',
          cost,
          endpoint: event?.endpoint,
          sourceKind: event?.source_kind,
          mimetype: event?.mimetype,
          bytes: event?.bytes ?? null,
          pages: event?.pages ?? null,
          textChars: event?.text_chars ?? null,
          pixels: event?.pixels ?? null,
          meta: event || undefined,
        },
      },
    },
    select: { credits: true },
  });

  return { ok: true, credits: updated.credits };
}

async function credit({ apiKeyRow, addCredits, event, invoiceRef }) {
  const prisma = getPrisma();
  if (!apiKeyRow || apiKeyRow.disabled) return { ok: false, error: 'invalid_key' };

  const updated = await prisma.apiKey.update({
    where: { id: apiKeyRow.id },
    data: {
      credits: { increment: Math.abs(Number(addCredits || 0)) },
      usageEvents: {
        create: {
          type: 'TOPUP',
          cost: -Math.abs(Number(addCredits || 0)),
          endpoint: event?.endpoint,
          meta: { ...event, invoiceRef } || undefined,
        },
      },
    },
    select: { credits: true },
  });

  return { ok: true, credits: updated.credits };
}

module.exports = {
  parseAuth,
  computeCost,
  authenticateApiKey,
  createKey,
  charge,
  credit,
};
