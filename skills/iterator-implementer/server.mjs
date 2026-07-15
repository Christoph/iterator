#!/usr/bin/env node
/**
 * iterator: implementer server
 * Reads implementation-review data from stdin as JSON, starts a local HTTP
 * server, opens the review UI in the browser, blocks until the user submits,
 * prints the structured result JSON to stdout, then exits.
 *
 * Input:  { branch, feature: {name, description, implementationNotes}, diff: [{path,hunks}], summary }
 * Output: { type: "accept-commit" } | { type: "review-feedback", comment } | { type: "cancel" }
 */
import http from 'node:http';
import { exec } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => start(JSON.parse(raw || '{}')));

function start(data) {
  const port = parseInt(process.env.ITERATOR_PORT || '8888', 10);
  const html = buildHtml(data);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (req.method === 'POST' && req.url === '/submit') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(doneHtml());
        process.stdout.write(body + '\n');
        server.close();
      });
    } else if (req.method === 'POST' && req.url === '/cancel') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        res.writeHead(204); res.end();
        process.stdout.write(JSON.stringify({ type: 'cancel' }) + '\n');
        server.close();
      });
    } else {
      res.writeHead(404); res.end();
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    const opener = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${opener} "${url}"`);
    process.stderr.write(`iterator: implementer listening on ${url}\n`);
  });

  setTimeout(() => {
    process.stderr.write('iterator: timeout (2h), no submission\n');
    server.close(); process.exit(0);
  }, 7_200_000).unref();
}

function doneHtml(msg = 'Sent to Claude') {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117;color:#7ee787;
font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;
height:100vh;flex-direction:column;gap:12px}p{color:#8b949e;font-size:14px}</style></head>
<body><h2>✓ ${msg}</h2><p>You can close this tab.</p></body></html>`;
}

function buildHtml(data) {
  const json = JSON.stringify(data);
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iterator — implement — ${data.branch || 'HEAD'}</title>
  <style>
    [data-theme="dark"]{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;
      --text-muted:#8b949e;--text-code:#e6edf3;--add-bg:rgba(46,160,67,.15);--add-fg:#7ee787;
      --del-bg:rgba(248,81,73,.15);--del-fg:#f85149;--hunk-bg:rgba(56,139,253,.1);--hunk-fg:#79c0ff;
      --accent:#388bfd;--green:#238636;--green-hover:#2ea043;--code-bg:#1c2128}
    [data-theme="light"]{--bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;
      --text-muted:#57606a;--text-code:#1f2328;--add-bg:#dafbe1;--add-fg:#1a7f37;--del-bg:#ffebe9;
      --del-fg:#cf222e;--hunk-bg:#ddf4ff;--hunk-fg:#0969da;--accent:#0969da;--green:#1a7f37;
      --green-hover:#1f8b3b;--code-bg:#eff2f5}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:40px}
    header{display:flex;align-items:center;justify-content:space-between;
      padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);
      position:sticky;top:0;z-index:10;gap:12px}
    .hd-left{display:flex;align-items:center;gap:6px}
    .logo{font-weight:600;font-size:14px}.sub{font-size:12px;color:var(--text-muted);margin-left:6px}
    .tag{font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:12px;
      padding:2px 8px;color:var(--text-muted);font-family:monospace}
    .hd-right{display:flex;align-items:center;gap:8px}
    button.theme,button.cancel-btn{background:none;border:1px solid var(--border);color:var(--text);
      padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px}
    button.cancel-btn{color:var(--text-muted)}
    button.accept-btn{padding:8px 20px;background:var(--green);color:#fff;border:none;
      border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}
    button.accept-btn:hover{background:var(--green-hover)}
    button.accept-btn:disabled{opacity:.5;cursor:not-allowed}
    .main{max-width:900px;margin:0 auto;padding:24px 20px}
    h1{font-size:20px;font-weight:600;margin-bottom:6px}
    .desc{font-size:14px;color:var(--text-muted);margin-bottom:16px;line-height:1.5}
    .lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
      color:var(--text-muted);margin:18px 0 6px}
    .notes,.summary{background:var(--surface);border:1px solid var(--border);border-radius:6px;
      padding:12px 14px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
    .fc{background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:14px;overflow:hidden}
    .fch{padding:8px 12px;background:var(--bg);border-bottom:1px solid var(--border);
      font-family:monospace;font-size:12px;color:var(--text)}
    table.dt{width:100%;border-collapse:collapse;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.5}
    td.ln{width:44px;text-align:right;padding:0 8px;color:var(--text-muted);user-select:none}
    td.lp{width:16px;text-align:center;user-select:none}
    td.lc{padding:0 8px;white-space:pre-wrap;word-break:break-all}
    tr.addition td{background:var(--add-bg);color:var(--add-fg)}
    tr.deletion td{background:var(--del-bg);color:var(--del-fg)}
    tr.hunk-header td{background:var(--hunk-bg);color:var(--hunk-fg)}
    tr.context td{color:var(--text-code)}
    textarea.cmt{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;
      color:var(--text);font-size:13px;font-family:inherit;resize:vertical;min-height:80px;
      outline:none;padding:10px 12px;line-height:1.5}
    textarea.cmt:focus{border-color:var(--accent)}
  </style>
</head>
<body>
<header>
  <div class="hd-left">
    <span class="logo">iterator</span>
    <span class="sub">/ implement</span>
    <span class="tag" id="branch"></span>
  </div>
  <div class="hd-right">
    <button class="theme" onclick="toggleTheme()">Toggle theme</button>
    <button class="cancel-btn" onclick="cancelFlow()">Cancel</button>
    <button class="accept-btn" id="acceptbtn" onclick="submitReview()">Accept and commit</button>
  </div>
</header>
<div class="main">
  <h1 id="title"></h1>
  <div class="desc" id="desc"></div>
  <div id="notes-wrap"></div>
  <div id="summary-wrap"></div>
  <div class="lbl">Implementation diff</div>
  <div id="diff"></div>
  <div class="lbl">Comment</div>
  <textarea class="cmt" id="comment" placeholder="Add a comment to request changes — the button becomes Send review…" oninput="refresh()"></textarea>
</div>
<script>
let __submitted = false;
function sendCancel(){ if(__submitted) return; __submitted=true; try{ navigator.sendBeacon('/cancel','{}'); }catch(e){} }
window.addEventListener('pagehide', sendCancel);
async function cancelFlow(){ __submitted=true; try{ await fetch('/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); }catch(e){} try{ window.close(); }catch(e){} }

const D = ${json};
const feature = D.feature || {};
document.getElementById('branch').textContent = D.branch || 'HEAD';
document.getElementById('title').textContent = feature.name || 'Implemented feature';
document.getElementById('desc').textContent = feature.description || '';
if (feature.implementationNotes)
  document.getElementById('notes-wrap').innerHTML = '<div class="lbl">Implementation notes</div><div class="notes">'+esc(feature.implementationNotes)+'</div>';
if (D.summary)
  document.getElementById('summary-wrap').innerHTML = '<div class="lbl">Summary</div><div class="summary">'+esc(D.summary)+'</div>';
renderDiff();

function renderDiff(){
  const c = document.getElementById('diff');
  const files = D.diff || [];
  if (!files.length){ c.innerHTML = '<div class="summary" style="color:var(--text-muted)">No diff provided.</div>'; return; }
  files.forEach(file => {
    const card = document.createElement('div'); card.className='fc';
    card.innerHTML = '<div class="fch">'+esc(file.path)+'</div>';
    const tbl = document.createElement('table'); tbl.className='dt';
    (file.hunks||[]).forEach(h => {
      const hr = document.createElement('tr'); hr.className='hunk-header';
      hr.innerHTML = '<td class="ln"></td><td class="lp"></td><td class="lc">'+esc(h.header||'')+'</td>';
      tbl.appendChild(hr);
      (h.lines||[]).forEach(l => {
        const tr = document.createElement('tr'); tr.className=l.type||'context';
        const px = l.type==='addition'?'+':l.type==='deletion'?'-':' ';
        tr.innerHTML = '<td class="ln"></td><td class="lp">'+px+'</td><td class="lc">'+esc(l.content||'')+'</td>';
        tbl.appendChild(tr);
      });
    });
    card.appendChild(tbl); c.appendChild(card);
  });
}

function refresh(){
  const has = document.getElementById('comment').value.trim().length>0;
  document.getElementById('acceptbtn').textContent = has ? 'Send review' : 'Accept and commit';
}

async function submitReview(){
  const comment = document.getElementById('comment').value.trim();
  const btn = document.getElementById('acceptbtn');
  __submitted = true; btn.disabled = true; btn.textContent = 'Sending…';
  const payload = comment
    ? { type:'review-feedback', feature: feature.name, comment }
    : { type:'accept-commit', feature: feature.name };
  try {
    await fetch('/submit', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    btn.textContent = comment ? '✓ Review sent to Claude' : '✓ Accepted — Claude is committing';
  } catch(e){ __submitted=false; btn.disabled=false; refresh(); alert('Could not reach local server: '+e.message); }
}

function toggleTheme(){ document.documentElement.dataset.theme = document.documentElement.dataset.theme==='dark'?'light':'dark'; }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
</script>
</body>
</html>`;
}
