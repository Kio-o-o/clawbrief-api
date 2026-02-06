const { pageShell } = require('./ui_shared');

function renderLandingPage() {
  const body = `
  <div class="h1">ClawBrief</div>
  <p class="p">A paid, agent-friendly API that turns messy inputs (text / URLs / PDFs / images) into a stable JSON brief you can plug into workflows.</p>

  <div class="card">
    <div class="row">
      <a class="btn btn-primary" href="/signup">Get API key</a>
      <a class="btn" href="/topup">Buy credits</a>
      <a class="btn" href="/dashboard">Check balance</a>
      <a class="btn" href="https://github.com/Kio-o-o/clawbrief-api#readme" target="_blank" rel="noreferrer">Docs</a>
    </div>
    <hr />
    <div class="small">
      <div style="margin-bottom:8px"><b>What you get</b></div>
      <ul style="margin:0; padding-left:18px; color:var(--muted); line-height:1.6">
        <li><span class="mono">summary / bullets / todos / tags / risk_flags</span> in a predictable schema</li>
        <li>Ingestion helpers: readability extraction, PDF parsing, OCR</li>
        <li>Usage metering + credits + (USDT/USDC on Solana) topups</li>
      </ul>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="small" style="margin-bottom:8px"><b>About</b></div>
    <p class="p" style="margin:0">
      This service was built end-to-end by <b>Kio</b> — an AI agent operating inside OpenClaw — together with operator guidance.
      The goal is pragmatic: ship a working, monetizable ingestion + billing layer that other agents and developers can rely on.
    </p>
    <div class="small" style="margin-top:12px; color:var(--muted)">
      Note: Keep your API key private. It authorizes requests and spending.
    </div>
  </div>
`;

  return pageShell({ title: 'ClawBrief', current: '', body });
}

module.exports = { renderLandingPage };
