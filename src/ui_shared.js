function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseCss() {
  return `
:root{
  --bg:#0b0f17;
  --panel:#0f1624;
  --panel2:#0c1322;
  --text:#e7eaf0;
  --muted:#9aa4b2;
  --border:rgba(255,255,255,.08);
  --accent:#7c3aed;
  --accent2:#22c55e;
  --danger:#ef4444;
  --shadow:0 20px 50px rgba(0,0,0,.35);
  --radius:14px;
}
*{box-sizing:border-box}
body{margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:radial-gradient(1200px 600px at 20% -10%, rgba(124,58,237,.25), transparent 60%), radial-gradient(1000px 600px at 90% 0%, rgba(34,197,94,.12), transparent 55%), var(--bg); color:var(--text);}
a{color:inherit; text-decoration:none}
.container{max-width:980px; margin:0 auto; padding:24px;}
.nav{position:sticky; top:0; backdrop-filter: blur(10px); background:rgba(11,15,23,.7); border-bottom:1px solid var(--border); z-index:10;}
.nav-inner{display:flex; gap:16px; align-items:center; justify-content:space-between; padding:14px 24px; max-width:980px; margin:0 auto;}
.brand{display:flex; gap:10px; align-items:center; font-weight:700; letter-spacing:.2px}
.badge{font-size:12px; color:var(--muted); border:1px solid var(--border); padding:2px 8px; border-radius:999px;}
.links{display:flex; gap:14px; align-items:center; color:var(--muted); font-size:14px}
.links a{padding:6px 10px; border-radius:10px}
.links a:hover{background:rgba(255,255,255,.06); color:var(--text)}
.btn{cursor:pointer; border:1px solid var(--border); background:rgba(255,255,255,.05); color:var(--text); padding:10px 12px; border-radius:12px; font-size:14px}
.btn:hover{background:rgba(255,255,255,.09)}
.btn-primary{background:linear-gradient(135deg, rgba(124,58,237,.95), rgba(99,102,241,.95)); border:none}
.btn-primary:hover{filter:brightness(1.05)}
.btn-ghost{background:transparent}
.card{background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)); border:1px solid var(--border); border-radius:var(--radius); padding:16px; box-shadow:var(--shadow);}
.h1{font-size:32px; margin:18px 0 6px}
.p{color:var(--muted); margin:0 0 14px; line-height:1.5}
.row{display:flex; gap:12px; flex-wrap:wrap; align-items:end}
.label{display:block; font-size:13px; color:var(--muted); margin-bottom:6px}
.input, select{width:100%; max-width:520px; font-size:16px; padding:12px 12px; border-radius:12px; border:1px solid var(--border); background:rgba(10,14,20,.55); color:var(--text); outline:none}
.input:focus, select:focus{border-color:rgba(124,58,237,.7); box-shadow:0 0 0 4px rgba(124,58,237,.15)}
.small{font-size:12px; color:var(--muted)}
.mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace}
.danger{color:var(--danger)}
.ok{color:var(--accent2)}
hr{border:none; border-top:1px solid var(--border); margin:14px 0}
.grid2{display:grid; grid-template-columns: 1fr; gap:16px}
@media (min-width: 840px){ .grid2{grid-template-columns: 1.1fr .9fr} }
.table{width:100%; border-collapse:collapse; font-size:13px}
.table th,.table td{padding:10px 8px; border-bottom:1px solid rgba(255,255,255,.06); color:var(--muted); text-align:left}
.table th{color:var(--text); font-weight:600}
`;
}

function navHtml({ current = '' } = {}) {
  const active = (k) => (k === current ? 'style="color:var(--text); background:rgba(255,255,255,.06)"' : '');
  return `
<div class="nav">
  <div class="nav-inner">
    <div class="brand">
      <span>ClawBrief</span>
      <span class="badge">beta</span>
    </div>
    <div class="links">
      <a ${active('signup')} href="/signup">Signup</a>
      <a ${active('topup')} href="/topup">Topup</a>
      <a ${active('dashboard')} href="/dashboard">Dashboard</a>
      <a href="https://github.com/Kio-o-o/clawbrief-api#readme" target="_blank" rel="noreferrer">Docs</a>
    </div>
    <button class="btn btn-ghost" id="btnClear">Clear saved key</button>
  </div>
</div>
<script>
  (function(){
    const LS_KEY='clawbrief_apiKey';
    const b=document.getElementById('btnClear');
    if(!b) return;
    b.addEventListener('click', ()=>{
      try{ localStorage.removeItem(LS_KEY); }catch{}
      alert('Saved API key cleared in this browser.');
      location.reload();
    });
  })();
</script>
`;
}

function pageShell({ title, current, body, extraHead = '' }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>${baseCss()}</style>
  ${extraHead}
</head>
<body>
  ${navHtml({ current })}
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

module.exports = { esc, pageShell };
