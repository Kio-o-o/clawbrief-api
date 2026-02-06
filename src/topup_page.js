const QRCode = require('qrcode');

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTopupPage({ baseUrl }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClawBrief Topup</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; max-width: 880px; }
    input, select, button { font-size: 16px; padding: 10px; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 6px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 16px; }
    .muted { color: #6b7280; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .danger { color: #b91c1c; }
  </style>
</head>
<body>
  <h1>ClawBrief Topup</h1>
  <p class="muted">Create an invoice and pay with USDT/USDC on Solana. Use the memo when possible.</p>

  <div class="card">
    <div class="row">
      <label>API Key<br><input id="apiKey" placeholder="cb_..." size="42" /></label>
      <span class="muted" style="align-self:end">(saved in this browser)</span>
      <label>Asset<br>
        <select id="asset">
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
        </select>
      </label>
      <label>Amount<br><input id="units" type="number" min="1" step="1" value="5" style="width:120px" /></label>
      <button id="btnCreate">Create invoice</button>
    </div>
    <p class="muted">Base URL: <code>${esc(baseUrl)}</code></p>
    <p id="err" class="danger"></p>
  </div>

  <div id="out" class="card" style="display:none"></div>

<script>
const baseUrl = ${JSON.stringify(baseUrl)};
const LS_KEY = 'clawbrief_apiKey';

function setErr(s){
  document.getElementById('err').textContent = s || '';
}

async function api(path, opts){
  const r = await fetch(baseUrl + path, opts);
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) {
    const msg = j.message || j.error || ('HTTP '+r.status);
    throw new Error(msg);
  }
  return j;
}

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.appendChild(c);
  return e;
}

async function pollInvoice(apiKey, invoiceRef, out) {
  while (true) {
    await new Promise(r => setTimeout(r, 2500));
    try {
      const st = await api('/v1/topup/invoice/' + encodeURIComponent(invoiceRef), {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });
      const inv = st.invoice;
      const badge = document.getElementById('statusBadge');
      badge.textContent = inv.status;
      if (inv.status === 'CONFIRMED') {
        const p = document.getElementById('statusMsg');
        p.textContent = 'Confirmed. Credits should be available now.';
        break;
      }
    } catch (e) {
      // ignore transient
    }
  }
}

// Prefill apiKey from localStorage
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) document.getElementById('apiKey').value = saved;
} catch {}

document.getElementById('apiKey').addEventListener('change', () => {
  try { localStorage.setItem(LS_KEY, document.getElementById('apiKey').value.trim()); } catch {}
});

document.getElementById('btnCreate').addEventListener('click', async () => {
  setErr('');
  const apiKey = document.getElementById('apiKey').value.trim();
  try { localStorage.setItem(LS_KEY, apiKey); } catch {}
  const asset = document.getElementById('asset').value;
  const units = Number(document.getElementById('units').value);
  if (!apiKey) return setErr('Missing API key');
  if (!units || units <= 0) return setErr('Invalid amount');

  const out = document.getElementById('out');
  out.style.display = 'none';
  out.innerHTML = '';

  try {
    const created = await api('/v1/topup/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ units, chain: 'SOL', asset })
    });

    const inv = created.invoice;
    const payTo = created.payTo;

    const wrap = el('div');
    wrap.appendChild(el('h2', { text: 'Invoice' }));

    wrap.appendChild(el('p', { html: 'Status: <b id="statusBadge">'+inv.status+'</b>' }));
    wrap.appendChild(el('p', { id: 'statusMsg', class: 'muted', text: 'Waiting for payment…' }));

    wrap.appendChild(el('p', { html: 'Send <b>'+inv.units+' '+inv.asset+'</b> on <b>'+inv.chain+'</b> to:' }));
    wrap.appendChild(el('p', { class: 'mono', text: payTo.address }));

    wrap.appendChild(el('p', { html: 'Memo (recommended): <span class="mono">'+inv.memo+'</span>' }));

    // QR: solana pay URL (best-effort)
    const solanaPay = 'solana:' + payTo.address + '?amount=' + encodeURIComponent(inv.units) + '&spl-token=' + encodeURIComponent(inv.asset);
    // Note: not all wallets support parameters. This is still helpful as an address QR.

    const qr = el('img');
    qr.style.maxWidth = '260px';
    qr.style.border = '1px solid #e5e7eb';
    qr.style.borderRadius = '12px';
    qr.style.padding = '8px';

    // fetch qr from server helper endpoint
    const qrResp = await api('/topup/qr?text=' + encodeURIComponent(payTo.address), {});
    qr.src = qrResp.dataUrl;
    wrap.appendChild(qr);

    wrap.appendChild(el('p', { class: 'muted', text: 'Tip: if your wallet supports memo/notes, paste the memo exactly.' }));

    out.appendChild(wrap);
    out.style.display = 'block';

    pollInvoice(apiKey, inv.invoiceRef || inv.id || inv.invoiceRef, out);
  } catch (e) {
    setErr(e.message);
  }
});
</script>
</body>
</html>`;
}

async function qrDataUrl(text) {
  const dataUrl = await QRCode.toDataURL(String(text), { margin: 1, width: 260 });
  return dataUrl;
}

module.exports = { renderTopupPage, qrDataUrl };
