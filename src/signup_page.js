const { pageShell, esc } = require('./ui_shared');

function renderSignupPage({ baseUrl }) {
  const body = `
  <div class="h1">Get an API key</div>
  <p class="p">Create a new API key with <b>0 credits</b>. We store it in this browser (localStorage) and you can download a backup.</p>

  <div class="card">
    <div class="row">
      <div style="flex:1; min-width:220px">
        <div class="label">Name (optional)</div>
        <input class="input" id="name" placeholder="my-bot" />
      </div>
      <button class="btn btn-primary" id="btn">Create API key</button>
      <a class="btn" href="/topup">Topup</a>
      <a class="btn" href="/dashboard">Dashboard</a>
    </div>
    <div class="small" style="margin-top:10px">Base URL: <span class="mono">${esc(baseUrl)}</span></div>
    <div id="msg" class="small" style="margin-top:10px"></div>
    <div id="err" class="danger" style="margin-top:8px"></div>
  </div>

  <div id="out" class="card" style="display:none"></div>

<script>
const baseUrl = ${JSON.stringify(baseUrl)};
const LS_KEY = 'clawbrief_apiKey';

function setMsg(s){ document.getElementById('msg').textContent = s || ''; }
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

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function solvePow(id, difficulty) {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  const start = Date.now();
  while (true) {
    const n = String(nonce++);
    const h = await sha256Hex(id + '.' + n);
    if (h.startsWith(prefix)) return { nonce: n, tookMs: Date.now()-start };
    if (nonce % 250 === 0) {
      setMsg('Solving PoW… tried ' + nonce + ' nonces');
      await new Promise(r=>setTimeout(r, 0));
    }
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

document.getElementById('btn').addEventListener('click', async () => {
  setErr('');
  setMsg('');
  const name = document.getElementById('name').value.trim();
  const out = document.getElementById('out');
  out.style.display = 'none';
  out.innerHTML='';

  try {
    setMsg('Requesting challenge…');
    const c = await api('/v1/public/pow', {});
    const token = c.challenge.token;
    const id = c.challenge.id;
    const difficulty = Number(c.challenge.difficulty || 3);

    if (!id) throw new Error('Missing challenge id');

    setMsg('Solving PoW…');
    const solved = await solvePow(id, difficulty);

    setMsg('Creating key…');
    const created = await api('/v1/public/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, pow: { token, nonce: solved.nonce } })
    });

    const key = created.key.apiKey;
    try { localStorage.setItem(LS_KEY, key); } catch {}

    out.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Your API key' }));
    const p = document.createElement('p');
    p.className='mono';
    p.textContent = key;
    out.appendChild(p);

    const row = document.createElement('div');
    row.className='row';

    const btnCopy = document.createElement('button');
    btnCopy.className='btn';
    btnCopy.textContent='Copy';
    btnCopy.onclick = async () => { await navigator.clipboard.writeText(key); setMsg('Copied.'); };

    const btnDl = document.createElement('button');
    btnDl.className='btn';
    btnDl.textContent='Download backup';
    btnDl.onclick = () => downloadText('clawbrief_apikey.txt', key + "\\n");

    const btnTopup = document.createElement('a');
    btnTopup.className='btn';
    btnTopup.textContent='Go to Topup';
    btnTopup.href = '/topup';

    const btnDash = document.createElement('a');
    btnDash.className='btn';
    btnDash.textContent='Go to Dashboard';
    btnDash.href = '/dashboard';

    row.appendChild(btnCopy);
    row.appendChild(btnDl);
    row.appendChild(btnTopup);
    row.appendChild(btnDash);
    out.appendChild(row);

    const tip = document.createElement('p');
    tip.className='small';
    tip.textContent = 'Saved in this browser (localStorage). Also keep a backup.';
    out.appendChild(tip);

    out.style.display='block';
    setMsg('Done.');
  } catch (e) {
    setErr(e.message);
  }
});
</script>`;

  return pageShell({ title: 'ClawBrief Signup', current: 'signup', body });
}

module.exports = { renderSignupPage };
