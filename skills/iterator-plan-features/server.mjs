#!/usr/bin/env node
/**
 * iterator: plan-features server
 * Reads feature plan data from stdin as JSON, starts a local HTTP server,
 * opens the planning UI in the browser, waits for the user to submit adjustments,
 * prints the structured adjustment JSON to stdout, then exits.
 *
 * Usage: echo '<json>' | node server.mjs
 * Output: adjustments JSON object to stdout
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
      // sent by the browser Cancel button or when the tab is closed
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
    process.stderr.write(`iterator: plan-features listening on ${url}\n`);
  });

  setTimeout(() => {
    process.stderr.write('iterator: timeout (2h), no adjustments received\n');
    server.close(); process.exit(0);
  }, 7_200_000).unref();
}

function doneHtml(msg = 'Sent to Claude') {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#7ee787;font-family:-apple-system,sans-serif;
  display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px}
p{color:#8b949e;font-size:14px}</style></head>
<body><h2>✓ ${msg}</h2><p>You can close this tab.</p></body></html>`;
}

function buildHtml(data) {
  if (data.mode === 'plan-review') return buildPlanReviewHtml(data);
  return buildFeaturePlanHtml(data);
}

// Shared browser snippet: POST a cancel event when the tab is closed so a
// closed tab never leaves the flow hanging. Guarded so an explicit
// Accept/Send/Cancel submit does not also fire a cancel.
const CANCEL_ON_UNLOAD = `
let __submitted = false;
function sendCancel() {
  if (__submitted) return;
  __submitted = true;
  try { navigator.sendBeacon('/cancel', '{}'); } catch(e) {}
}
window.addEventListener('pagehide', sendCancel);
async function cancelFlow() {
  __submitted = true;
  try { await fetch('/cancel', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); } catch(e) {}
  try { window.close(); } catch(e) {}
}`;

function buildPlanReviewHtml(data) {
  const json = JSON.stringify(data);
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iterator — plan review — ${data.branch || 'HEAD'}</title>
  <style>
    [data-theme="dark"]{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;
      --text-muted:#8b949e;--accent:#388bfd;--green:#238636;--green-hover:#2ea043;--fb-bg:#1c2128;
      --code-bg:#1c2128}
    [data-theme="light"]{--bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;
      --text-muted:#57606a;--accent:#0969da;--green:#1a7f37;--green-hover:#1f8b3b;--fb-bg:#f0f6fc;
      --code-bg:#eff2f5}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:40px}
    header{display:flex;align-items:center;justify-content:space-between;
      padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);
      position:sticky;top:0;z-index:10;gap:12px}
    .hd-left{display:flex;align-items:center;gap:6px;flex:1;min-width:0}
    .logo{font-weight:600;font-size:14px;white-space:nowrap}
    .sub{font-size:12px;color:var(--text-muted);margin-left:6px;white-space:nowrap}
    .tag{font-size:12px;background:var(--bg);border:1px solid var(--border);
      border-radius:12px;padding:2px 8px;color:var(--text-muted);font-family:monospace;white-space:nowrap}
    .hd-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
    button.theme{background:none;border:1px solid var(--border);color:var(--text);
      padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px}
    button.cancel-btn{padding:6px 14px;background:none;border:1px solid var(--border);
      color:var(--text-muted);border-radius:6px;font-size:13px;cursor:pointer}
    button.cancel-btn:hover{border-color:var(--text-muted);color:var(--text)}
    button.approve-btn{padding:8px 20px;background:var(--green);color:#fff;border:none;
      border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;
      transition:background .15s,opacity .15s}
    button.approve-btn:hover{background:var(--green-hover)}
    button.approve-btn:disabled{opacity:.5;cursor:not-allowed}
    .main{max-width:760px;margin:0 auto;padding:28px 20px}
    h1{font-size:20px;font-weight:600;margin-bottom:6px}
    .hint{font-size:13px;color:var(--text-muted);margin-bottom:28px;line-height:1.5}
    .section{margin-bottom:20px}
    .shead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    .slabel{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
      color:var(--text-muted)}
    .cmt-btn{background:none;border:1px solid var(--border);border-radius:6px;
      color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 8px;
      display:inline-flex;align-items:center;gap:5px;line-height:1}
    .cmt-btn:hover{color:var(--text);border-color:var(--text-muted)}
    .cmt-btn .badge{background:var(--accent);color:#fff;border-radius:8px;
      padding:0 6px;font-size:10px;font-weight:600}
    .sbody{background:var(--surface);border:1px solid var(--border);border-radius:6px;
      padding:12px 14px;font-size:14px;line-height:1.6;color:var(--text);
      min-height:48px;cursor:text;word-break:break-word}
    .sbody:hover{border-color:var(--text-muted)}
    .sbody .empty{color:var(--text-muted);font-style:italic}
    /* rendered markdown */
    .sbody h1,.sbody h2,.sbody h3,.sbody h4{margin:10px 0 6px;line-height:1.3}
    .sbody h1{font-size:18px}.sbody h2{font-size:16px}.sbody h3{font-size:14px}.sbody h4{font-size:13px}
    .sbody h1:first-child,.sbody h2:first-child,.sbody h3:first-child,.sbody p:first-child{margin-top:0}
    .sbody p{margin:6px 0}
    .sbody ul,.sbody ol{margin:6px 0 6px 22px}
    .sbody li{margin:2px 0}
    .sbody code{background:var(--code-bg);border-radius:4px;padding:1px 5px;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
    .sbody pre{background:var(--code-bg);border-radius:6px;padding:10px 12px;
      overflow-x:auto;margin:8px 0}
    .sbody pre code{background:none;padding:0;font-size:12.5px}
    .sbody a{color:var(--accent);text-decoration:none}
    .sbody a:hover{text-decoration:underline}
    textarea.seditor{width:100%;padding:12px 14px;background:var(--surface);
      border:1px solid var(--accent);border-radius:6px;color:var(--text);
      font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
      resize:vertical;min-height:120px;outline:none;line-height:1.5}
    /* dependencies panel */
    .deps-panel{margin-bottom:20px}
    .dep-chips{display:flex;flex-wrap:wrap;gap:8px;background:var(--surface);
      border:1px solid var(--border);border-radius:6px;padding:12px 14px;align-items:center}
    .dchip{display:inline-flex;align-items:center;gap:6px;background:var(--bg);
      border:1px solid var(--border);border-radius:12px;padding:3px 6px 3px 10px;
      font-size:12px;color:var(--accent)}
    .dchip button{background:none;border:none;color:var(--text-muted);cursor:pointer;
      font-size:14px;line-height:1;padding:0 2px}
    .dchip button:hover{color:var(--del-fg,#f85149)}
    .dep-empty{color:var(--text-muted);font-style:italic;font-size:13px}
    input.dadd{flex:1;min-width:160px;background:none;border:none;outline:none;
      color:var(--text);font-size:13px;font-family:inherit;padding:4px}
    input.dadd::placeholder{color:var(--text-muted)}
    .comment-section{margin-top:32px;padding-top:24px;border-top:1px solid var(--border)}
    .comment-section .slabel{margin-bottom:8px}
    textarea.comment-box{width:100%;padding:10px 12px;background:var(--surface);
      border:1px solid var(--border);border-radius:6px;color:var(--text);
      font-size:13px;font-family:inherit;resize:vertical;min-height:80px;outline:none;
      line-height:1.5}
    textarea.comment-box:focus{border-color:var(--accent)}
    textarea.comment-box:hover:not(:focus){border-color:var(--text-muted)}
    /* comment side panel */
    .cscrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:150;
      opacity:0;pointer-events:none;transition:opacity .2s}
    .cscrim.open{opacity:1;pointer-events:auto}
    .cpanel{position:fixed;top:0;right:0;width:360px;max-width:90vw;height:100vh;
      background:var(--fb-bg);border-left:1px solid var(--border);z-index:200;
      transform:translateX(100%);transition:transform .2s;display:flex;flex-direction:column}
    .cpanel.open{transform:none}
    .cph{display:flex;align-items:center;justify-content:space-between;
      padding:14px 16px;border-bottom:1px solid var(--border)}
    .cph .ct{font-size:14px;font-weight:600}
    .cph .cs{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
    .cph button{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px}
    .cpbody{flex:1;overflow-y:auto;padding:12px 16px}
    .cpitem{background:var(--surface);border:1px solid var(--border);border-radius:6px;
      padding:8px 10px;margin-bottom:8px;font-size:13px;line-height:1.5;
      display:flex;justify-content:space-between;gap:8px}
    .cpitem button{background:none;border:none;color:var(--text-muted);cursor:pointer;
      font-size:13px;flex-shrink:0}
    .cpitem button:hover{color:var(--del-fg,#f85149)}
    .cp-empty{color:var(--text-muted);font-style:italic;font-size:13px;padding:8px 0}
    .cpadd{padding:12px 16px;border-top:1px solid var(--border)}
    .cpadd textarea{width:100%;background:var(--surface);border:1px solid var(--border);
      border-radius:6px;color:var(--text);font-size:13px;font-family:inherit;
      resize:vertical;min-height:70px;outline:none;padding:8px 10px;line-height:1.5}
    .cpadd textarea:focus{border-color:var(--accent)}
    .cpadd button{margin-top:8px;width:100%;padding:8px;background:var(--accent);
      color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500}
    .cpadd button:hover{opacity:.9}
  </style>
</head>
<body>
<header>
  <div class="hd-left">
    <span class="logo">iterator</span>
    <span class="sub">/ plan review</span>
    <span class="tag" id="branch"></span>
  </div>
  <div class="hd-right">
    <button class="theme" onclick="toggleTheme()">Toggle theme</button>
    <button class="cancel-btn" onclick="cancelFlow()">Cancel</button>
    <button class="approve-btn" id="approvebtn" onclick="approvePlan()">Accept</button>
  </div>
</header>
<div class="main">
  <h1 id="title"></h1>
  <p class="hint">Each section is rendered markdown — <strong>click any section to edit</strong> (save with blur or ⌘/Ctrl+Enter). Use the 💬 icon to leave a comment on a section, and confirm the <strong>dependencies</strong> below. When everything looks right click <strong>Approve Plan</strong>; if you edit anything or add a comment the button becomes <strong>Send Review</strong> so Claude can revise first.</p>
  <div class="deps-panel">
    <div class="shead"><span class="slabel">Dependencies</span></div>
    <div class="dep-chips" id="dep-chips"></div>
  </div>
  <div id="sections"></div>
  <div class="comment-section">
    <div class="slabel">Global comment (optional)</div>
    <textarea class="comment-box" id="global-comment"
      placeholder="Any overall feedback or changes you'd like Claude to incorporate before finalizing the plan…"
      oninput="refresh()"></textarea>
  </div>
</div>

<div class="cscrim" id="cscrim" onclick="closeComments()"></div>
<aside class="cpanel" id="cpanel">
  <div class="cph">
    <div>
      <div class="cs">Comment thread</div>
      <div class="ct" id="cp-title">Section</div>
    </div>
    <button onclick="closeComments()" title="Close">✕</button>
  </div>
  <div class="cpbody" id="cp-body"></div>
  <div class="cpadd">
    <textarea id="cp-input" placeholder="Add a comment for Claude about this section…"
      onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();addComment()}"></textarea>
    <button onclick="addComment()">Add comment</button>
  </div>
</aside>

<script>
${CANCEL_ON_UNLOAD}
const D = ${json};
const SECTION_KEYS = ['goal','architecture','keyDecisions','productFit'];
const SECTION_LABELS = {goal:'Goal',architecture:'Architecture',
  keyDecisions:'Key Decisions',productFit:'Product Fit'};

// mutable state
const sections = {};
SECTION_KEYS.forEach(k => sections[k] = (D.plan && D.plan[k]) || '');
const ORIG_SECTIONS = JSON.stringify(sections);
let deps = Array.isArray(D.dependencies) ? D.dependencies.slice() : [];
const ORIG_DEPS = JSON.stringify(deps);
const comments = {};           // key -> [strings]
SECTION_KEYS.forEach(k => comments[k] = []);
let activeKey = null;

document.getElementById('branch').textContent = D.branch || 'HEAD';
document.getElementById('title').textContent = D.title || 'Plan Review';

renderSections();
renderDeps();
refresh();

/* ---------- sections ---------- */
function renderSections() {
  const container = document.getElementById('sections');
  container.innerHTML = '';
  SECTION_KEYS.forEach(key => {
    const div = document.createElement('div');
    div.className = 'section';
    div.dataset.key = key;
    const badge = comments[key].length ? '<span class="badge">'+comments[key].length+'</span>' : '';
    div.innerHTML =
      '<div class="shead">'+
        '<span class="slabel">'+esc(SECTION_LABELS[key])+'</span>'+
        '<button class="cmt-btn" onclick="openComments(\\''+key+'\\')">💬 Comment '+badge+'</button>'+
      '</div>'+
      '<div class="sbody" data-key="'+key+'" onclick="editSection(\\''+key+'\\')">'+mdToHtml(sections[key])+'</div>';
    container.appendChild(div);
  });
}

function editSection(key) {
  const body = document.querySelector('.sbody[data-key="'+key+'"]');
  if (!body) return;
  const ta = document.createElement('textarea');
  ta.className = 'seditor';
  ta.value = sections[key] || '';
  ta.addEventListener('blur', () => saveSection(key, ta.value));
  ta.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); ta.blur(); }
  });
  body.replaceWith(ta);
  ta.focus();
  const v = ta.value; ta.value = ''; ta.value = v;   // move cursor to end
}

function saveSection(key, val) {
  sections[key] = val.trim();
  renderSections();
  refresh();
}

/* ---------- dependencies ---------- */
function renderDeps() {
  const el = document.getElementById('dep-chips');
  el.innerHTML = '';
  deps.forEach((d, i) => {
    const chip = document.createElement('span');
    chip.className = 'dchip';
    chip.innerHTML = esc(d) + ' <button title="Remove" onclick="removeDep('+i+')">×</button>';
    el.appendChild(chip);
  });
  const input = document.createElement('input');
  input.className = 'dadd';
  input.placeholder = deps.length ? 'Add dependency…' : 'No dependencies — add one if the plan needs it…';
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addDep(input.value); input.value = ''; }
  });
  el.appendChild(input);
}

function addDep(val) {
  val = (val || '').trim();
  if (!val) return;
  deps.push(val);
  renderDeps();
  refresh();
}

function removeDep(i) {
  deps.splice(i, 1);
  renderDeps();
  refresh();
}

/* ---------- comments ---------- */
function openComments(key) {
  activeKey = key;
  document.getElementById('cp-title').textContent = SECTION_LABELS[key];
  renderComments();
  document.getElementById('cscrim').classList.add('open');
  document.getElementById('cpanel').classList.add('open');
  document.getElementById('cp-input').focus();
}

function closeComments() {
  activeKey = null;
  document.getElementById('cscrim').classList.remove('open');
  document.getElementById('cpanel').classList.remove('open');
}

function renderComments() {
  const body = document.getElementById('cp-body');
  const list = comments[activeKey] || [];
  if (!list.length) {
    body.innerHTML = '<div class="cp-empty">No comments yet. Add one below.</div>';
    return;
  }
  body.innerHTML = list.map((c, i) =>
    '<div class="cpitem"><span>'+esc(c)+'</span>'+
    '<button title="Delete" onclick="deleteComment('+i+')">×</button></div>'
  ).join('');
}

function addComment() {
  const input = document.getElementById('cp-input');
  const val = input.value.trim();
  if (!val || !activeKey) return;
  comments[activeKey].push(val);
  input.value = '';
  renderComments();
  renderSections();
  refresh();
}

function deleteComment(i) {
  comments[activeKey].splice(i, 1);
  renderComments();
  renderSections();
  refresh();
}

function collectComments() {
  const out = [];
  SECTION_KEYS.forEach(k => comments[k].forEach(text => out.push({section: k, text})));
  return out;
}

/* ---------- submit ---------- */
function hasChanges() {
  if (document.getElementById('global-comment').value.trim()) return true;
  if (collectComments().length) return true;
  if (JSON.stringify(sections) !== ORIG_SECTIONS) return true;
  if (JSON.stringify(deps) !== ORIG_DEPS) return true;
  return false;
}

function refresh() {
  document.getElementById('approvebtn').textContent = hasChanges() ? 'Send review' : 'Accept';
}

async function approvePlan() {
  const btn = document.getElementById('approvebtn');
  const changed = hasChanges();
  __submitted = true;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const payload = {
    type: changed ? 'plan-feedback' : 'plan-approved',
    branch: D.branch || 'HEAD',
    sections: {...sections},
    dependencies: deps,
    comments: collectComments(),
    comment: document.getElementById('global-comment').value.trim(),
  };
  try {
    await fetch('/submit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    btn.textContent = changed ? '✓ Review sent to Claude' : '✓ Plan approved';
  } catch(e) {
    btn.disabled = false;
    btn.textContent = changed ? 'Send Review' : 'Approve Plan';
    alert('Could not reach local server: ' + e.message);
  }
}

/* ---------- helpers ---------- */
function toggleTheme() {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// minimal, dependency-free markdown → HTML
function mdToHtml(src) {
  if (!src || !src.trim()) return '<span class="empty">Empty — click to add.</span>';
  const escc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => escc(s)
    .replace(/\`([^\`]+)\`/g, (m,c)=>'<code>'+c+'</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = src.split('\\n');
  let html = '', i = 0, inList = false, listTag = '';
  const closeList = () => { if (inList) { html += '</'+listTag+'>'; inList = false; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\\s*\`\`\`/.test(line)) {
      closeList(); i++;
      let code = '';
      while (i < lines.length && !/^\\s*\`\`\`/.test(lines[i])) { code += lines[i] + '\\n'; i++; }
      i++;
      html += '<pre><code>'+escc(code.replace(/\\n$/,''))+'</code></pre>';
      continue;
    }
    const h = line.match(/^(#{1,4})\\s+(.*)$/);
    if (h) { closeList(); const lvl = h[1].length; html += '<h'+lvl+'>'+inline(h[2])+'</h'+lvl+'>'; i++; continue; }
    const ul = line.match(/^\\s*[-*]\\s+(.*)$/);
    if (ul) { if (!inList || listTag!=='ul'){ closeList(); inList=true; listTag='ul'; html+='<ul>'; } html+='<li>'+inline(ul[1])+'</li>'; i++; continue; }
    const ol = line.match(/^\\s*\\d+\\.\\s+(.*)$/);
    if (ol) { if (!inList || listTag!=='ol'){ closeList(); inList=true; listTag='ol'; html+='<ol>'; } html+='<li>'+inline(ol[1])+'</li>'; i++; continue; }
    if (/^\\s*$/.test(line)) { closeList(); i++; continue; }
    closeList();
    let para = line; i++;
    while (i < lines.length && !/^\\s*$/.test(lines[i]) &&
           !/^(#{1,4}\\s|\\s*\`\`\`|\\s*[-*]\\s|\\s*\\d+\\.\\s)/.test(lines[i])) { para += ' ' + lines[i]; i++; }
    html += '<p>'+inline(para)+'</p>';
  }
  closeList();
  return html;
}
</script>
</body>
</html>`;
}

function buildFeaturePlanHtml(data) {
  const json = JSON.stringify(data);
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iterator — features — ${data.branch || 'HEAD'}</title>
  <style>
    [data-theme="dark"]{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;
      --text-muted:#8b949e;--add-fg:#7ee787;--del-fg:#f85149;--dot-green:#3fb950;
      --dot-yellow:#d29922;--dot-red:#f85149;--accent:#388bfd;--green:#238636;--green-hover:#2ea043;
      --bg-green:rgba(46,160,67,.15);--bg-yellow:rgba(210,153,34,.15);--bg-red:rgba(248,81,73,.15);
      --bar-green:#238636;--bar-yellow:#9e6a03;--bar-red:#da3633;--code-bg:#1c2128;
      --drag-over:rgba(56,139,253,.12)}
    [data-theme="light"]{--bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;
      --text-muted:#57606a;--dot-green:#1a7f37;--dot-yellow:#9a6700;--dot-red:#cf222e;
      --accent:#0969da;--green:#1a7f37;--green-hover:#1f8b3b;--bg-green:rgba(46,160,67,.1);
      --bg-yellow:rgba(210,153,34,.1);--bg-red:rgba(248,81,73,.1);--bar-green:#1a7f37;
      --bar-yellow:#9a6700;--bar-red:#cf222e;--code-bg:#eff2f5;--drag-over:rgba(9,105,218,.08)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:60px}
    header{display:flex;align-items:center;justify-content:space-between;
      padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);
      position:sticky;top:0;z-index:10;gap:12px}
    .hd-left{display:flex;align-items:center;gap:6px;min-width:0}
    .logo{font-weight:600;font-size:14px}
    .sub{font-size:12px;color:var(--text-muted);margin-left:6px}
    .tag{font-size:12px;background:var(--bg);border:1px solid var(--border);
      border-radius:12px;padding:2px 8px;color:var(--text-muted);font-family:monospace}
    .hd-right{display:flex;align-items:center;gap:8px}
    button.theme,button.cancel-btn{background:none;border:1px solid var(--border);color:var(--text);
      padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px}
    button.cancel-btn{color:var(--text-muted)}
    button.cancel-btn:hover{border-color:var(--text-muted);color:var(--text)}
    button.accept-btn{padding:8px 20px;background:var(--green);color:#fff;border:none;
      border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}
    button.accept-btn:hover{background:var(--green-hover)}
    button.accept-btn:disabled{opacity:.5;cursor:not-allowed}
    .sumbar{padding:14px 20px;display:flex;align-items:center;gap:24px;
      border-bottom:1px solid var(--border);background:var(--surface);flex-wrap:wrap}
    .ss{display:flex;flex-direction:column;gap:2px}
    .ssl{font-size:11px;text-transform:uppercase;color:var(--text-muted)}
    .ssv{font-size:18px;font-weight:600}
    .wrap{max-width:920px;margin:0 auto;padding:20px}
    .sec-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
      color:var(--text-muted);margin:18px 0 12px}
    .cyclewarn{background:rgba(248,81,73,.1);border:1px solid var(--dot-red);border-radius:6px;
      padding:10px 14px;font-size:13px;color:var(--dot-red);margin-bottom:12px}
    /* graph */
    .graph{background:var(--surface);border:1px solid var(--border);border-radius:8px;
      padding:12px;overflow-x:auto}
    .graph svg{display:block}
    .gnode rect{fill:var(--bg);stroke:var(--border);rx:6}
    .gnode.done rect{stroke:var(--dot-green)}
    .gnode text{fill:var(--text);font-size:12px;font-family:-apple-system,sans-serif}
    .gedge{stroke:var(--text-muted);stroke-width:1.5;fill:none;opacity:.6;marker-end:url(#arrow)}
    /* cards */
    .fc{background:var(--surface);border:1px solid var(--border);border-radius:8px;
      margin-bottom:16px;overflow:hidden;transition:border-color .15s,background .15s}
    .fc.drag-over{background:var(--drag-over);border-color:var(--accent)}
    .fc.done{opacity:.75}
    .fc.merge-target{cursor:pointer;border-style:dashed;border-color:var(--accent)}
    .fch{display:flex;align-items:center;justify-content:space-between;
      padding:12px 16px;border-bottom:1px solid var(--border)}
    .fchl{display:flex;align-items:center;gap:10px}
    .fctitle{font-size:14px;font-weight:600;border:1px solid transparent;border-radius:3px;
      padding:1px 4px;background:none;color:var(--text);font-family:inherit;min-width:80px}
    .fctitle:hover{border-color:var(--border)}
    .fctitle:focus{border-color:var(--accent);outline:none}
    .chip{font-size:11px;border-radius:10px;padding:2px 8px}
    .cg{background:var(--bg-green);color:var(--dot-green)}
    .cy{background:var(--bg-yellow);color:var(--dot-yellow)}
    .cr{background:var(--bg-red);color:var(--dot-red)}
    .donechip{background:var(--bg-green);color:var(--dot-green);font-size:11px;border-radius:10px;padding:2px 8px}
    .card-btns{display:flex;gap:6px}
    button.cb{font-size:11px;padding:3px 8px;border:1px solid var(--border);
      border-radius:4px;background:none;color:var(--text-muted);cursor:pointer}
    button.cb:hover{color:var(--text);border-color:var(--text-muted)}
    button.cb.split:hover{color:var(--dot-yellow);border-color:var(--dot-yellow)}
    button.cb.merge-sel{background:var(--accent);border-color:var(--accent);color:#fff}
    .fcb{padding:12px 16px}
    .fcdesc{font-size:13px;color:var(--text);margin-bottom:8px;border:1px solid transparent;
      border-radius:3px;padding:2px 4px;line-height:1.4}
    .fcdesc:hover{border-color:var(--border)}
    .fcdesc:focus{border-color:var(--accent);outline:none}
    .lbl{font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;margin:10px 0 3px}
    .notes{font-size:12px;color:var(--text-muted);line-height:1.5}
    .deps{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .dep{background:var(--bg);border:1px solid var(--border);border-radius:10px;
      padding:1px 8px;font-size:11px;color:var(--accent)}
    .files{display:flex;flex-wrap:wrap;gap:5px}
    .fchip{font-size:11px;font-family:monospace;background:var(--bg);
      border:1px solid var(--border);border-radius:3px;padding:2px 7px;
      cursor:grab;user-select:none;color:var(--text-muted)}
    .fchip:hover{border-color:var(--accent);color:var(--text)}
    pre.snip{background:var(--code-bg);border-radius:6px;padding:10px 12px;overflow-x:auto;
      margin:4px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5}
    .owarn{background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.4);
      border-radius:4px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:var(--dot-red)}
    textarea.cmt{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;
      color:var(--text);font-size:12px;font-family:inherit;resize:vertical;min-height:52px;
      outline:none;padding:8px 10px;line-height:1.5}
    textarea.cmt:focus{border-color:var(--accent)}
  </style>
</head>
<body>
<header>
  <div class="hd-left">
    <span class="logo">iterator</span>
    <span class="sub">/ features</span>
    <span class="tag" id="branch"></span>
  </div>
  <div class="hd-right">
    <button class="theme" onclick="toggleTheme()">Toggle theme</button>
    <button class="cancel-btn" onclick="cancelFlow()">Cancel</button>
    <button class="accept-btn" id="acceptbtn" onclick="accept()">Accept</button>
  </div>
</header>
<div class="sumbar">
  <div class="ss"><div class="ssl">Features</div><div class="ssv" id="s-cnt">0</div></div>
  <div class="ss"><div class="ssl">Est. lines</div><div class="ssv" id="s-total">0</div></div>
  <div class="ss"><div class="ssl">Oversized</div><div class="ssv" id="s-over" style="color:var(--dot-red)">0</div></div>
  <div class="ss"><div class="ssl">Done</div><div class="ssv" id="s-done">0</div></div>
</div>
<div class="wrap">
  <div id="cyclewarn"></div>
  <div class="sec-title">Dependency graph</div>
  <div class="graph" id="graph"></div>
  <div class="sec-title">Features</div>
  <div id="cards"></div>
</div>
<script>
${CANCEL_ON_UNLOAD}
const D = ${json};
const S = {
  features: JSON.parse(JSON.stringify(D.features || [])),
  moves: [], renames: [], descUpdates: [], comments: {}, mergeSel: null,
};
document.getElementById('branch').textContent = D.branch || 'HEAD';
renderAll();

function renderAll(){ updateSummary(); renderGraph(); renderCards(); refresh(); }
function estLines(c){ return c.linesEstimate || 0; }
function sizeClass(c){ const t = estLines(c); return t<=100?'cg':t<=200?'cy':'cr'; }
function sizeLabel(c){ const t = estLines(c); return (t<=100?'small':t<=200?'medium':'large'); }

function updateSummary(){
  const cs = S.features;
  const total = cs.reduce((s,c)=>s+estLines(c),0);
  document.getElementById('s-cnt').textContent = cs.length;
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-over').textContent = cs.filter(c=>estLines(c)>200).length;
  document.getElementById('s-done').textContent = cs.filter(c=>c.status==='done').length;
}

// topological level via longest path from roots; also detects cycles
function computeLevels(){
  const by = {}; S.features.forEach(c=>by[c.name]=c);
  const level = {}, state = {}; let cycle = false;
  function lv(name){
    if (level[name]!=null) return level[name];
    if (state[name]==='visiting'){ cycle = true; return 0; }
    state[name]='visiting';
    let m = 0;
    ((by[name]&&by[name].dependsOn)||[]).forEach(d=>{ if(by[d]) m=Math.max(m, lv(d)+1); });
    state[name]='done';
    return level[name]=m;
  }
  S.features.forEach(c=>lv(c.name));
  return { level, cycle };
}

function renderGraph(){
  const g = document.getElementById('graph');
  const cw = document.getElementById('cyclewarn');
  if (!S.features.length){ g.innerHTML='<span style="color:var(--text-muted);font-size:13px">No features yet.</span>'; cw.innerHTML=''; return; }
  const { level, cycle } = computeLevels();
  cw.innerHTML = cycle ? '<div class="cyclewarn">⚠️ Dependency cycle detected — the implementer cannot order these. Fix depends-on before accepting.</div>' : '';
  const byLevel = {};
  S.features.forEach(c=>{ const l=level[c.name]||0; (byLevel[l]=byLevel[l]||[]).push(c); });
  const levels = Object.keys(byLevel).map(Number).sort((a,b)=>a-b);
  const NW=150, NH=34, GAPX=70, GAPY=18;
  const pos = {};
  let maxRows = 0;
  levels.forEach((l,ci)=>{ byLevel[l].forEach((c,ri)=>{ pos[c.name]={x:ci*(NW+GAPX)+10, y:ri*(NH+GAPY)+10}; }); maxRows=Math.max(maxRows, byLevel[l].length); });
  const W = levels.length*(NW+GAPX)+10;
  const H = maxRows*(NH+GAPY)+10;
  let edges='';
  S.features.forEach(c=>{ ((c.dependsOn)||[]).forEach(d=>{ if(pos[d]&&pos[c.name]){
    const x1=pos[d].x+NW, y1=pos[d].y+NH/2, x2=pos[c.name].x, y2=pos[c.name].y+NH/2;
    const mx=(x1+x2)/2;
    edges+='<path class="gedge" d="M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2+'"/>';
  }}); });
  let nodes='';
  S.features.forEach(c=>{ const p=pos[c.name]; const done=c.status==='done';
    nodes+='<g class="gnode'+(done?' done':'')+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+NW+'" height="'+NH+'" rx="6"/>'+
      '<text x="'+(p.x+10)+'" y="'+(p.y+NH/2+4)+'">'+(done?'✓ ':'')+esc(clip(c.name,20))+'</text></g>';
  });
  g.innerHTML = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'+
    '<path d="M0 0 L8 4 L0 8 z" fill="var(--text-muted)"/></marker></defs>'+edges+nodes+'</svg>';
}

function renderCards(){
  const c = document.getElementById('cards'); c.innerHTML='';
  S.features.forEach(ch => c.appendChild(makeCard(ch)));
}

function makeCard(c){
  const t = estLines(c);
  const done = c.status==='done';
  const isSel = S.mergeSel===c.name;
  const isTgt = S.mergeSel && S.mergeSel!==c.name;
  const card = document.createElement('div');
  card.className='fc'+(done?' done':'')+(isTgt?' merge-target':'');
  card.dataset.feature = c.name;
  if (isTgt) card.addEventListener('click', e=>{ if(e.target.closest('button,input,textarea,.fchip'))return; completeMerge(c.name); });
  card.addEventListener('dragover', e=>{e.preventDefault();card.classList.add('drag-over')});
  card.addEventListener('dragleave', ()=>card.classList.remove('drag-over'));
  card.addEventListener('drop', e=>{ e.preventDefault(); card.classList.remove('drag-over');
    const {file,from}=JSON.parse(e.dataTransfer.getData('text/plain')); if(from!==c.name) moveFile(file,from,c.name); });

  const snippets = (c.snippets||[]).map(s=>'<pre class="snip">'+esc(typeof s==='string'?s:s.code||'')+'</pre>').join('');
  const files = (c.files||[]).map(f=>'<div class="fchip" draggable="true" ondragstart="dragStart(event,'+JSON.stringify(f).replace(/"/g,'&quot;')+','+JSON.stringify(c.name).replace(/"/g,'&quot;')+')">'+esc(f)+'</div>').join('');
  const deps = (c.dependsOn||[]).length ? '<div class="deps">'+c.dependsOn.map(d=>'<span class="dep">'+esc(d)+'</span>').join('')+'</div>' : '<div class="notes">none</div>';

  card.innerHTML =
    '<div class="fch"><div class="fchl">'+
      '<input class="fctitle" value="'+esc(c.name)+'" data-orig="'+esc(c.name)+'" '+
        'onblur="renameFeature(this.dataset.orig,this.value.trim())" onkeydown="if(event.key===\\'Enter\\')this.blur()"'+(done?' disabled':'')+'>'+
      '<span class="chip '+sizeClass(c)+'">'+sizeLabel(c)+' · ~'+t+' lines</span>'+
      (done?'<span class="donechip">✓ done</span>':'')+
    '</div><div class="card-btns">'+
      (done?'':'<button class="cb split" onclick="splitFeature(\\''+esc(c.name)+'\\')">Split</button>'+
      '<button class="cb '+(isSel?'merge-sel':'')+'" onclick="toggleMerge(\\''+esc(c.name)+'\\')">'+(isSel?'Cancel':'Merge with…')+'</button>')+
    '</div></div>'+
    '<div class="fcb">'+
      (t>200?'<div class="owarn">⚠️ ~'+t+' lines — exceeds the ~200-line guideline. Consider Split.</div>':'')+
      '<div class="fcdesc" contenteditable="'+(!done)+'" onblur="updateDesc(\\''+esc(c.name)+'\\',this.textContent.trim())">'+esc(c.description||'')+'</div>'+
      (c.implementationNotes?'<div class="lbl">Implementation notes</div><div class="notes">'+esc(c.implementationNotes)+'</div>':'')+
      '<div class="lbl">Depends on</div>'+deps+
      (snippets?'<div class="lbl">Relevant snippets</div>'+snippets:'')+
      (files?'<div class="lbl">Files</div><div class="files">'+files+'</div>':'')+
      (done?'':'<div class="lbl">Comment</div><textarea class="cmt" placeholder="Comment on this feature for Claude…" oninput="setComment(\\''+esc(c.name)+'\\',this.value)">'+esc(S.comments[c.name]||'')+'</textarea>')+
    '</div>';
  return card;
}

function dragStart(e,file,from){ e.dataTransfer.setData('text/plain', JSON.stringify({file,from})); }

function moveFile(file,from,to){
  const a=S.features.find(c=>c.name===from), b=S.features.find(c=>c.name===to);
  if(!a||!b) return;
  a.files=(a.files||[]).filter(f=>f!==file); b.files=[...(b.files||[]),file];
  S.moves.push({file,from,to}); renderAll();
}
function renameFeature(oldName,newName){
  if(!newName||newName===oldName) return;
  const c=S.features.find(c=>c.name===oldName); if(!c) return;
  c.name=newName;
  S.features.forEach(x=>{ if(x.dependsOn) x.dependsOn=x.dependsOn.map(d=>d===oldName?newName:d); });
  if(S.comments[oldName]){ S.comments[newName]=S.comments[oldName]; delete S.comments[oldName]; }
  S.renames.push({from:oldName,to:newName}); renderAll();
}
function updateDesc(name,desc){
  const c=S.features.find(c=>c.name===name); if(!c||desc===c.description) return;
  c.description=desc; S.descUpdates.push({feature:name,description:desc}); refresh();
}
function setComment(name,val){ val=val.trim(); if(val) S.comments[name]=val; else delete S.comments[name]; refresh(); }

function splitFeature(name){
  const c=S.features.find(c=>c.name===name); if(!c) return;
  if(!confirm('Split "'+name+'"? Claude will split it into ~200-line features and reopen this view.')) return;
  __submitted=true;
  post({type:'split-request', branch:D.branch||'HEAD', feature:name, content:JSON.stringify(c)}, 'Splitting — Claude is working…');
}
function toggleMerge(name){ S.mergeSel = S.mergeSel===name?null:name; renderCards(); }
function completeMerge(target){
  const a=S.mergeSel; if(!a||a===target){ S.mergeSel=null; renderCards(); return; }
  if(!confirm('Merge "'+a+'" and "'+target+'"? Claude will combine them and reopen this view.')) return;
  __submitted=true;
  post({type:'merge-request', branch:D.branch||'HEAD', features:[a,target]}, 'Merging — Claude is working…');
}

function collectComments(){ return Object.entries(S.comments).map(([feature,comment])=>({feature,comment})); }
function hasChanges(){ return S.moves.length||S.renames.length||S.descUpdates.length||collectComments().length; }
function refresh(){ document.getElementById('acceptbtn').textContent = hasChanges()?'Send review':'Accept'; }

function accept(){
  __submitted=true;
  if(hasChanges()){
    post({type:'plan-adjustments', branch:D.branch||'HEAD', moves:S.moves, renames:S.renames,
      descUpdates:S.descUpdates, comments:collectComments()}, 'Sent — Claude is updating FEATURES.md');
  } else {
    post({type:'plan-approved', branch:D.branch||'HEAD'}, 'Features accepted — run /iterator-implementer to build them');
  }
}

async function post(obj, okMsg){
  const btn=document.getElementById('acceptbtn'); btn.disabled=true; btn.textContent='Sending…';
  try{ await fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
    btn.textContent='✓ '+okMsg;
  }catch(e){ __submitted=false; btn.disabled=false; refresh(); alert('Could not reach local server: '+e.message); }
}

function toggleTheme(){ document.documentElement.dataset.theme = document.documentElement.dataset.theme==='dark'?'light':'dark'; }
function clip(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
</script>
</body>
</html>`;
}
