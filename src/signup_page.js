function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSignupPage({ baseUrl }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClawBrief Signup</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; max-width: 880px; }
    input, button { font-size: 16px; padding: 10px; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 6px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 16px; }
    .muted { color: #6b7280; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .danger { color: #b91c1c; }
    .ok { color: #065f46; }
  </style>
</head>
<body>
  <h1>Get an API Key</h1>
  <p class="muted">This creates a new API key with <b>0 credits</b>. You can top up after creation.</p>

  <div class="card">
    <div class="row">
      <label>Name (optional)<br><input id="name" placeholder="my-bot" size="22" /></label>
      <button id="btn">Create API key</button>
    </div>
    <p class="muted">Base URL: <code>${esc(baseUrl)}</code></p>
    <p id="msg" class="muted"></p>
    <p id="err" class="danger"></p>
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
    if (nonce % 200 === 0) {
      setMsg('Solving PoW… tried ' + nonce + ' nonces');
      // yield
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
    const difficulty = Number(c.challenge.difficulty || 4);

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
    localStorage.setItem(LS_KEY, key);

    out.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Your API key' }));
    const p = document.createElement('p');
    p.className='mono';
    p.textContent = key;
    out.appendChild(p);

    const row = document.createElement('div');
    row.className='row';

    const btnCopy = document.createElement('button');
    btnCopy.textContent='Copy';
    btnCopy.onclick = async () => { await navigator.clipboard.writeText(key); setMsg('Copied.'); };

    const btnDl = document.createElement('button');
    btnDl.textContent='Download backup';
    btnDl.onclick = () => downloadText('clawbrief_apikey.txt', key + "\\n");

    const btnTopup = document.createElement('button');
    btnTopup.textContent='Go to Topup';
    btnTopup.onclick = () => { window.location.href = '/topup'; };

    row.appendChild(btnCopy);
    row.appendChild(btnDl);
    row.appendChild(btnTopup);
    out.appendChild(row);

    const tip = document.createElement('p');
    tip.className='muted';
    tip.textContent = 'This key is saved in this browser (localStorage). Also keep a backup.';
    out.appendChild(tip);

    out.style.display='block';
    setMsg('Done.');
  } catch (e) {
    setErr(e.message);
  }
});
</script>
</body>
</html>`;
}

module.exports = { renderSignupPage };
