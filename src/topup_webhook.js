const crypto = require('node:crypto');
const { z } = require('zod');
const { getPrisma } = require('./db');
const billingDb = require('./billing_db');
const { creditsToppedUp } = require('./metrics');

const WEBHOOK_SECRET_HEADER = 'x-topup-webhook-secret';

function requireWebhookSecret(req, reply) {
  const secret = process.env.TOPUP_WEBHOOK_SECRET;
  if (!secret) {
    reply.code(500);
    return { ok: false, error: 'webhook_not_configured' };
  }
  const h = req.headers[WEBHOOK_SECRET_HEADER] || req.headers[WEBHOOK_SECRET_HEADER.toUpperCase()];
  if (!h || String(h) !== String(secret)) {
    reply.code(403);
    return { ok: false, error: 'forbidden' };
  }
  return null;
}

function mintAllowlist() {
  const out = {};
  const usdt = process.env.SOL_USDT_MINT;
  const usdc = process.env.SOL_USDC_MINT;
  if (usdt) out[String(usdt)] = 'USDT';
  if (usdc) out[String(usdc)] = 'USDC';
  return out;
}

function extractInvoiceRefFromRaw(raw) {
  // Best-effort: scan any string fields for our memo pattern.
  const s = JSON.stringify(raw);
  const m = s.match(/CLAWBRIEF:(inv_[A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function normalizeDecimalString(v) {
  // Keep as string for Prisma Decimal.
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return null;
}

function extractTokenTransfers(payload) {
  // Helius can send an array of events or a single event.
  const events = Array.isArray(payload) ? payload : [payload];
  const transfers = [];

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;

    const tokenTransfers = Array.isArray(ev.tokenTransfers) ? ev.tokenTransfers : [];
    for (const tt of tokenTransfers) {
      if (!tt || typeof tt !== 'object') continue;

      const mint = tt.mint || tt.tokenMint || tt.tokenAddress;
      const toAddress = tt.toUserAccount || tt.toTokenAccount || tt.toAccount || tt.destination || tt.to;
      const txHash = ev.signature || ev.transactionSignature || ev.txHash || tt.txHash;

      // Amount: prefer uiAmountString/uiAmount; fallback to tokenAmount
      let amount = null;
      const ta = tt.tokenAmount;
      if (ta && typeof ta === 'object') amount = ta.uiAmountString ?? ta.uiAmount ?? ta.amount ?? null;
      if (amount === null && typeof ta === 'number') amount = ta;
      if (amount === null) amount = tt.amount ?? tt.uiAmount ?? tt.uiAmountString ?? null;

      transfers.push({ mint, toAddress, txHash, amount, raw: { ev, tt } });
    }
  }

  return transfers;
}

async function handleIncomingPayment({ chain, mint, asset, toAddress, amountStr, txHash, raw, invoiceRefHint }) {
  const prisma = getPrisma();

  // idempotent insert by txHash
  const existing = await prisma.payment.findUnique({ where: { txHash } });
  if (existing) return { ok: true, payment: existing, deduped: true };

  const created = await prisma.payment.create({
    data: {
      chain,
      asset,
      mint,
      toAddress,
      amount: amountStr,
      txHash,
      invoiceRef: invoiceRefHint || null,
      raw,
      status: 'UNMATCHED',
    },
  });

  return { ok: true, payment: created, deduped: false };
}

async function tryAutoMatchAndCredit(paymentRow) {
  const prisma = getPrisma();

  // if already matched
  if (paymentRow.status === 'MATCHED' && paymentRow.invoiceRef) {
    return { ok: true, matched: true, invoiceRef: paymentRow.invoiceRef, already: true };
  }

  const windowHours = Number(process.env.TOPUP_MATCH_WINDOW_HOURS || 24);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  let inv = null;
  if (paymentRow.invoiceRef) {
    inv = await prisma.topupInvoice.findUnique({ where: { invoiceRef: paymentRow.invoiceRef } });
  }

  // fallback: exact match by amount + asset + pending + time window
  if (!inv) {
    const candidates = await prisma.topupInvoice.findMany({
      where: {
        status: 'PENDING',
        chain: paymentRow.chain,
        asset: paymentRow.asset,
        createdAt: { gte: since },
        // Prisma Decimal equality is ok with string
        units: paymentRow.amount,
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });

    if (candidates.length === 1) inv = candidates[0];
    else return { ok: true, matched: false, reason: 'ambiguous_or_missing_invoice' };
  }

  if (!inv || inv.status !== 'PENDING') return { ok: true, matched: false, reason: 'invoice_not_pending' };
  if (inv.txHash) return { ok: true, matched: false, reason: 'invoice_already_has_tx' };

  // Transaction: confirm invoice + credit + usage event + mark payment matched
  const result = await prisma.$transaction(async (tx) => {
    const updatedInvoice = await tx.topupInvoice.update({
      where: { invoiceRef: inv.invoiceRef },
      data: { status: 'CONFIRMED', txHash: paymentRow.txHash, confirmedAt: new Date() },
    });

    const apiKeyRow = await tx.apiKey.findUnique({ where: { id: updatedInvoice.apiKeyId } });
    const credited = await billingDb.credit({
      apiKeyRow,
      addCredits: updatedInvoice.credits,
      event: {
        endpoint: '/v1/topup/webhook/solana',
        type: 'topup_auto',
        invoiceId: updatedInvoice.invoiceRef,
        chain: updatedInvoice.chain,
        asset: updatedInvoice.asset,
        units: String(updatedInvoice.units),
        txHash: paymentRow.txHash,
      },
      invoiceRef: updatedInvoice.invoiceRef,
    });
    if (!credited.ok) throw new Error(`credit_failed:${credited.error}`);

    const updatedPayment = await tx.payment.update({
      where: { txHash: paymentRow.txHash },
      data: { status: 'MATCHED', invoiceRef: updatedInvoice.invoiceRef },
    });

    return { updatedInvoice, updatedPayment, creditsRemaining: credited.credits };
  });

  creditsToppedUp.labels(paymentRow.asset, paymentRow.chain).inc(Number(inv.credits || 0));

  return { ok: true, matched: true, invoiceRef: result.updatedInvoice.invoiceRef, creditsRemaining: result.creditsRemaining };
}

function registerTopupWebhookRoutes(app) {
  // Helius Solana webhook receiver: token transfers to our address.
  app.post('/v1/topup/webhook/solana', async (req, reply) => {
    const deny = requireWebhookSecret(req, reply);
    if (deny) return deny;

    const payTo = process.env.CRYPTO_PAY_ADDRESS;
    if (!payTo) {
      reply.code(500);
      return { ok: false, error: 'pay_address_not_configured' };
    }

    const allow = mintAllowlist();
    if (!Object.keys(allow).length) {
      reply.code(500);
      return { ok: false, error: 'mint_allowlist_not_configured' };
    }

    const payload = req.body;
    const invoiceRefHint = extractInvoiceRefFromRaw(payload);

    const transfers = extractTokenTransfers(payload);
    if (!transfers.length) {
      return { ok: true, ignored: true, reason: 'no_token_transfers' };
    }

    const results = [];

    for (const t of transfers) {
      const mint = t.mint ? String(t.mint) : '';
      const asset = allow[mint];
      if (!asset) continue;

      const toAddress = t.toAddress ? String(t.toAddress) : '';
      if (toAddress !== String(payTo)) continue;

      const txHash = t.txHash ? String(t.txHash) : null;
      if (!txHash) continue;

      const amountStr = normalizeDecimalString(t.amount);
      if (!amountStr) continue;

      const stored = await handleIncomingPayment({
        chain: 'SOL',
        mint,
        asset,
        toAddress,
        amountStr,
        txHash,
        raw: payload,
        invoiceRefHint,
      });

      const matched = await tryAutoMatchAndCredit(stored.payment);
      results.push({ txHash, stored: !stored.deduped, matched: !!matched.matched, invoiceRef: matched.invoiceRef || null, reason: matched.reason || null });
    }

    if (!results.length) {
      return { ok: true, ignored: true, reason: 'no_matching_transfers' };
    }

    return { ok: true, results };
  });

  // Admin: manually match a payment txHash to an invoiceRef and credit.
  app.post('/v1/admin/topup/match', async (req, reply) => {
    const { requireAdmin } = require('./admin');
    const deny = requireAdmin(req, reply);
    if (deny) return deny;

    const Body = z.object({ invoiceRef: z.string().min(6), txHash: z.string().min(10) });
    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_body' };
    }

    const { invoiceRef, txHash } = parsed.data;
    const prisma = getPrisma();

    const inv = await prisma.topupInvoice.findUnique({ where: { invoiceRef } });
    if (!inv) {
      reply.code(404);
      return { ok: false, error: 'invoice_not_found' };
    }

    const pay = await prisma.payment.findUnique({ where: { txHash } });
    if (!pay) {
      reply.code(404);
      return { ok: false, error: 'payment_not_found' };
    }

    if (pay.toAddress !== String(process.env.CRYPTO_PAY_ADDRESS)) {
      reply.code(400);
      return { ok: false, error: 'wrong_destination' };
    }

    // require exact match on asset/chain/amount
    if (pay.chain !== inv.chain || pay.asset !== inv.asset || String(pay.amount) !== String(inv.units)) {
      reply.code(400);
      return { ok: false, error: 'mismatch', details: { pay: { chain: pay.chain, asset: pay.asset, amount: String(pay.amount) }, inv: { chain: inv.chain, asset: inv.asset, units: String(inv.units) } } };
    }

    // set invoiceRef hint and let auto matcher do the transaction
    await prisma.payment.update({ where: { txHash }, data: { invoiceRef } });
    const matched = await tryAutoMatchAndCredit({ ...pay, invoiceRef, status: pay.status });
    return { ok: true, matched };
  });
}

module.exports = { registerTopupWebhookRoutes };
