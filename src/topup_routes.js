const { buildInvoice, pricing } = require('./topup');
const { requireAdmin } = require('./admin');
const { useDb } = require('./config');
const billingDb = require('./billing_db');
const billingFile = require('./billing');
const { getPrisma } = require('./db');
const { parseAuth } = require('./auth');

function registerTopupRoutes(app) {
  // Create an invoice for manual crypto payment.
  // Auth: API key
  app.post('/v1/topup/create', async (req, reply) => {
    const plaintext = parseAuth(req);
    if (!plaintext) {
      reply.code(401);
      return { error: 'missing_auth', message: 'Use Authorization: Bearer <apiKey>' };
    }

    const apiKeyRow = await (useDb() ? billingDb.authenticateApiKey(plaintext) : Promise.resolve(null));
    if (useDb() && !apiKeyRow) {
      reply.code(401);
      return { error: 'invalid_key' };
    }

    const body = req.body || {};
    const units = Number(body.units || 0);
    const asset = body.asset || 'USDT';
    const chain = body.chain || 'SOL';

    const built = buildInvoice({ asset, chain, units });
    if (!built.ok) {
      reply.code(400);
      return built;
    }

    let invoice;

    if (useDb()) {
      const prisma = getPrisma();
      const row = await prisma.topupInvoice.create({
        data: {
          invoiceRef: built.invoice.invoiceRef,
          apiKeyId: apiKeyRow.id,
          chain: built.invoice.chain,
          asset: built.invoice.asset,
          units: built.invoice.units,
          credits: built.invoice.credits,
          memo: built.invoice.memo,
          status: 'PENDING',
        },
      });
      invoice = {
        invoiceRef: row.invoiceRef,
        chain: row.chain,
        asset: row.asset,
        units: String(row.units),
        credits: row.credits,
        status: row.status,
        memo: row.memo,
        created_at: row.createdAt,
      };
    } else {
      // local file-store (backwards compatible)
      const store = billingFile.loadStore();
      if (!store.topups) store.topups = { invoices: {} };
      const inv = {
        id: built.invoice.invoiceRef,
        apiKey: plaintext,
        asset: built.invoice.asset,
        chain: built.invoice.chain,
        units: built.invoice.units,
        credits: built.invoice.credits,
        status: 'pending',
        created_at: built.invoice.created_at,
        memo: built.invoice.memo,
        txHash: null,
        confirmed_at: null,
      };
      store.topups.invoices[inv.id] = inv;
      require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'data', 'store.json'), JSON.stringify(store, null, 2), 'utf8');
      invoice = inv;
    }

    return {
      ok: true,
      pricing: pricing(),
      invoice,
      payTo: built.payTo,
      instructions: [
        `Send ${built.invoice.units} ${built.invoice.asset} on ${built.invoice.chain} to the payTo.address.`,
        `Put this memo in the transfer if possible: ${built.invoice.memo}`,
        'If you cannot set a memo, the payment may require manual matching.',
      ],
    };
  });

  // Admin confirms a topup invoice and credits the API key.
  // Auth: X-Admin-Token
  app.post('/v1/topup/confirm', async (req, reply) => {
    const deny = requireAdmin(req, reply);
    if (deny) return deny;

    const { invoiceId, txHash } = req.body || {};
    if (!invoiceId || !txHash) {
      reply.code(400);
      return { ok: false, error: 'missing_fields', message: 'Need invoiceId and txHash' };
    }

    if (useDb()) {
      const prisma = getPrisma();
      const inv = await prisma.topupInvoice.findUnique({ where: { invoiceRef: String(invoiceId) } });
      if (!inv) {
        reply.code(404);
        return { ok: false, error: 'invoice_not_found' };
      }
      if (inv.status === 'CONFIRMED') {
        return { ok: true, invoice: inv, message: 'already_confirmed' };
      }

      const updated = await prisma.topupInvoice.update({
        where: { invoiceRef: String(invoiceId) },
        data: { status: 'CONFIRMED', txHash: String(txHash), confirmedAt: new Date() },
      });

      const apiKeyRow = await prisma.apiKey.findUnique({ where: { id: inv.apiKeyId } });
      const credited = await billingDb.credit({
        apiKeyRow,
        addCredits: inv.credits,
        event: { endpoint: '/v1/topup/confirm', type: 'topup', invoiceId: inv.invoiceRef, chain: inv.chain, asset: inv.asset, units: String(inv.units), txHash: String(txHash) },
        invoiceRef: inv.invoiceRef,
      });

      if (!credited.ok) {
        reply.code(400);
        return credited;
      }

      return { ok: true, invoice: updated, credits_remaining: credited.credits };
    }

    // file-store fallback
    const store = billingFile.loadStore();
    const inv = store.topups?.invoices?.[invoiceId];
    if (!inv) {
      reply.code(404);
      return { ok: false, error: 'invoice_not_found' };
    }
    if (inv.status === 'confirmed') {
      return { ok: true, invoice: inv, message: 'already_confirmed' };
    }

    inv.status = 'confirmed';
    inv.txHash = String(txHash);
    inv.confirmed_at = new Date().toISOString();

    require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'data', 'store.json'), JSON.stringify(store, null, 2), 'utf8');

    const credited = billingFile.creditKey({
      apiKey: inv.apiKey,
      addCredits: inv.credits,
      event: {
        type: 'topup',
        invoiceId: inv.id,
        chain: inv.chain,
        asset: inv.asset,
        units: inv.units,
        txHash: inv.txHash,
      },
    });

    if (!credited.ok) {
      reply.code(400);
      return credited;
    }

    return { ok: true, invoice: inv, credits_remaining: credited.credits };
  });

  app.get('/v1/topup/pricing', async () => ({ ok: true, pricing: pricing() }));
}

module.exports = { registerTopupRoutes };
