const QRCode = require('qrcode');
const { pageShell, esc } = require('./ui_shared');

function renderTopupPage({ baseUrl }) {
  const body = `
  <div class="h1">Top up credits</div>
  <p class="p">Create an invoice and pay with USDT/USDC on Solana. Use the memo when possible.</p>

  <div class="card">
    <div class="form-grid">
      <div>
        <div class="label">API Key</div>
        <input class="input mono" id="apiKey" placeholder="cb_..." />
        <div class="small" style="margin-top:6px">Saved locally in this browser (localStorage).</div>
      </div>

      <div>
        <div class="label">Asset</div>
        <select id="asset">
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
        </select>
      </div>

      <div>
        <div class="label">Amount</div>
        <input class="input" id="units" type="number" min="1" step="1" value="5" />
      </div>

      <div class="row" style="justify-content:flex-end">
        <button class="btn btn-primary" id="btnCreate">Create invoice</button>
        <a class="btn" href="/dashboard">Dashboard</a>
      </div>
    </div>

    <div class="small" style="margin-top:10px">Base URL: <span class="mono">${esc(baseUrl)}</span></div>
    <div id="err" class="danger" style="margin-top:10px"></div>
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

async function pollInvoice(apiKey, invoiceRef) {
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
        p.textContent = 'Confirmed. Credits are now available.';
        break;
      }
    } catch (e) {
      // ignore transient
    }
  }
}

function loadKey(){
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
}
function saveKey(k){
  try { localStorage.setItem(LS_KEY, k); } catch {}
}

// init
const saved = loadKey();
if (saved) document.getElementById('apiKey').value = saved;

document.getElementById('apiKey').addEventListener('change', () => {
  saveKey(document.getElementById('apiKey').value.trim());
});

if (!saved) {
  setErr('No API key saved in this browser. Create one at /signup first.');
}

document.getElementById('btnCreate').addEventListener('click', async () => {
  setErr('');
  const apiKey = document.getElementById('apiKey').value.trim();
  const asset = document.getElementById('asset').value;
  const units = Number(document.getElementById('units').value);
  if (!apiKey) return setErr('Missing API key (create one at /signup)');
  if (!units || units <= 0) return setErr('Invalid amount');

  saveKey(apiKey);

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
    wrap.appendChild(el('p', { id: 'statusMsg', class: 'small', text: 'Waiting for payment…' }));

    wrap.appendChild(el('p', { html: 'Send <b>'+inv.units+' '+inv.asset+'</b> on <b>'+inv.chain+'</b> to:' }));
    wrap.appendChild(el('p', { class: 'mono', text: payTo.address }));

    wrap.appendChild(el('p', { html: 'Memo (recommended): <span class="mono">'+inv.memo+'</span>' }));

    // Address QR
    const qr = el('img');
    qr.style.maxWidth = '260px';
    qr.style.border = '1px solid rgba(255,255,255,.12)';
    qr.style.borderRadius = '12px';
    qr.style.padding = '8px';
    const qrResp = await api('/topup/qr?text=' + encodeURIComponent(payTo.address), {});
    qr.src = qrResp.dataUrl;

    // Solana Pay URI QR (amount + token) (wallet support varies)
    const mintMap = {
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    };
    const mint = mintMap[String(inv.asset||'').toUpperCase()];

    const grid = el('div');
    grid.className = 'grid2';

    const left = el('div');
    left.appendChild(el('div', { class: 'small', text: 'Address QR' }));
    left.appendChild(qr);

    const right = el('div');
    right.appendChild(el('div', { class: 'small', text: 'Solana Pay QR (amount + token) — optional' }));

    if (mint) {
      const uri = 'solana:' + payTo.address + '?amount=' + encodeURIComponent(inv.units) + '&spl-token=' + encodeURIComponent(mint);
      const qr2 = el('img');
      qr2.style.maxWidth = '260px';
      qr2.style.border = '1px solid rgba(255,255,255,.12)';
      qr2.style.borderRadius = '12px';
      qr2.style.padding = '8px';
      const qr2Resp = await api('/topup/qr?text=' + encodeURIComponent(uri), {});
      qr2.src = qr2Resp.dataUrl;
      right.appendChild(qr2);
      right.appendChild(el('p', { class: 'small', text: 'You may still need to paste the memo manually.' }));
    } else {
      right.appendChild(el('p', { class: 'small', text: 'Unsupported asset for Solana Pay QR.' }));
    }

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);

    wrap.appendChild(el('p', { class: 'small', text: 'Tip: if your wallet supports memo/notes, paste the memo exactly.' }));

    out.appendChild(wrap);
    out.style.display = 'block';

    pollInvoice(apiKey, inv.invoiceRef || inv.id || inv.invoiceRef);
  } catch (e) {
    setErr(e.message);
  }
});
</script>`;

  return pageShell({ title: 'ClawBrief Topup', current: 'topup', body });
}

async function qrDataUrl(text) {
  const dataUrl = await QRCode.toDataURL(String(text), { margin: 1, width: 260 });
  return dataUrl;
}

module.exports = { renderTopupPage, qrDataUrl };
