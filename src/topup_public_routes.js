const { parseAuth, getApiKeyRow } = require('./auth');
const { useDb } = require('./config');
const { getPrisma } = require('./db');

function registerTopupPublicRoutes(app) {
  // API-key scoped invoice status (for polling from a website)
  app.get('/v1/topup/invoice/:invoiceRef', async (req, reply) => {
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

    const invoiceRef = String(req.params.invoiceRef || '').trim();
    if (!invoiceRef) {
      reply.code(400);
      return { ok: false, error: 'missing_invoice_ref' };
    }

    if (!useDb()) {
      reply.code(400);
      return { ok: false, error: 'db_required' };
    }

    const prisma = getPrisma();
    const inv = await prisma.topupInvoice.findUnique({ where: { invoiceRef } });
    if (!inv || inv.apiKeyId !== apiKeyRow.id) {
      reply.code(404);
      return { ok: false, error: 'invoice_not_found' };
    }

    return {
      ok: true,
      invoice: {
        invoiceRef: inv.invoiceRef,
        chain: inv.chain,
        asset: inv.asset,
        units: String(inv.units),
        credits: inv.credits,
        memo: inv.memo,
        status: inv.status,
        txHash: inv.txHash,
        created_at: inv.createdAt,
        confirmed_at: inv.confirmedAt,
      },
    };
  });
}

module.exports = { registerTopupPublicRoutes };
