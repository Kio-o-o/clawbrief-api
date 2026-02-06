const { pageShell, esc } = require('./ui_shared');

function renderDashboardPage({ baseUrl }) {
  const body = `
  <div class="h1">Dashboard</div>
  <p class="p">Check your credits and recent usage.</p>

  <div class="card">
    <div class="row">
      <div style="flex:1; min-width:360px">
        <div class="label">API Key</div>
        <input class="input mono" id="apiKey" placeholder="cb_..." />
      </div>
      <button class="btn btn-primary" id="btnRefresh">Refresh</button>
    </div>
    <div id="err" class="danger" style="margin-top:10px"></div>
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
  t.className='table';
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
  if (!apiKey) return setErr('Missing API key (create one at /signup)');
  saveKey(apiKey);

  const data = await api('/v1/usage', { headers: { 'Authorization': 'Bearer ' + apiKey } });
  renderUsage(data);
}

// init
const saved = loadKey();
if (saved) document.getElementById('apiKey').value = saved;
else setErr('No API key saved in this browser. Create one at /signup first.');

document.getElementById('apiKey').addEventListener('change', () => {
  saveKey(document.getElementById('apiKey').value.trim());
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  refresh().catch(e => setErr(e.message));
});

if (saved) refresh().catch(()=>{});
</script>`;

  return pageShell({ title: 'ClawBrief Dashboard', current: 'dashboard', body });
}

module.exports = { renderDashboardPage };
