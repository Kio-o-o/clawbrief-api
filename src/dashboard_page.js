function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDashboardPage({ baseUrl }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClawBrief Dashboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; max-width: 980px; }
    input, button { font-size: 16px; padding: 10px; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 6px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 16px; }
    .muted { color: #6b7280; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .danger { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 14px; }
  </style>
</head>
<body>
  <h1>ClawBrief Dashboard</h1>
  <p class="muted">Check your credits and recent usage. API key is stored in this browser.</p>

  <div class="card">
    <div class="row">
      <label>API Key<br><input id="apiKey" placeholder="cb_..." size="46" /></label>
      <button id="btnSave">Save</button>
      <button id="btnRefresh">Refresh</button>
      <a href="/topup" style="align-self:end">Topup</a>
    </div>
    <p class="muted">Base URL: <code>${esc(baseUrl)}</code></p>
    <p id="err" class="danger"></p>
  </div>

  <div id="summary" class="card" style="display:none"></div>
  <div id="recent" class="card" style="display:none"></div>

<script>
const baseUrl = ${JSON.stringify(baseUrl)};
const LS_KEY = 'clawbrief_apiKey';

function setErr(s){ document.getElementById('err').textContent = s || ''; }

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

function loadKey(){
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
}
function saveKey(k){
  try { localStorage.setItem(LS_KEY, k); } catch {}
}

function renderUsage(data){
  const sum = document.getElementById('summary');
  const rec = document.getElementById('recent');
  sum.style.display='block';
  rec.style.display='block';

  const key = data.key;
  sum.innerHTML = '';
  sum.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Credits' }));
  const p = document.createElement('p');
  p.innerHTML = 'Remaining credits: <b>' + key.credits + '</b>';
  sum.appendChild(p);

  rec.innerHTML = '';
  rec.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Recent events' }));

  const t = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Time</th><th>Type</th><th>Cost</th><th>Endpoint</th></tr>';
  t.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const e of (data.recent || [])) {
    const tr = document.createElement('tr');
    const time = e.createdAt || e.created_at || '';
    tr.innerHTML = '<td class="mono">'+String(time).slice(0,19).replace('T',' ')+'</td>'+
      '<td>'+String(e.type||'')+'</td>'+
      '<td class="mono">'+String(e.cost)+'</td>'+
      '<td class="mono">'+String(e.endpoint||'')+'</td>';
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  rec.appendChild(t);
}

async function refresh(){
  setErr('');
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return setErr('Missing API key');
  saveKey(apiKey);

  const data = await api('/v1/usage', { headers: { 'Authorization': 'Bearer ' + apiKey } });
  renderUsage(data);
}

// init
const saved = loadKey();
if (saved) document.getElementById('apiKey').value = saved;

document.getElementById('btnSave').addEventListener('click', () => {
  saveKey(document.getElementById('apiKey').value.trim());
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  refresh().catch(e => setErr(e.message));
});

if (saved) refresh().catch(()=>{});
</script>
</body>
</html>`;
}

module.exports = { renderDashboardPage };
