const { nanoid } = require('nanoid');

// Manual crypto topup flow (MVP):
// - Create an invoice for an API key.
// - User pays to a configured address.
// - Human/admin confirms on-chain and credits.

function pricing() {
  // Credits per 1 USDC/USDT (v0). Tune later.
  return {
    creditsPerUnit: Number(process.env.CREDITS_PER_USD || 100),
    minUnits: Number(process.env.MIN_TOPUP_USD || 5),
  };
}

function buildInvoice({ asset = 'USDC', chain = 'SOL', units }) {
  const { creditsPerUnit, minUnits } = pricing();
  const u = Number(units);
  if (!u || u < minUnits) {
    return { ok: false, error: 'min_topup', minUnits };
  }

  const invoiceRef = `inv_${nanoid(12)}`;
  const invoice = {
    invoiceRef,
    asset: asset.toUpperCase(),
    chain: chain.toUpperCase(),
    units: u,
    credits: Math.floor(u * creditsPerUnit),
    status: 'PENDING',
    created_at: new Date().toISOString(),
    memo: `CLAWBRIEF:${invoiceRef}`,
  };

  return {
    ok: true,
    invoice,
    payTo: {
      address: process.env.CRYPTO_PAY_ADDRESS || null,
      chain: invoice.chain,
      asset: invoice.asset,
    },
  };
}

module.exports = { buildInvoice, pricing };
