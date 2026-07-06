/**
 * iterator: shared browser-UI shell.
 *
 * Every step renders inside the same page produced by renderPage(): the same
 * `iterator / <step>` header, theme toggle, Cancel + primary button, the same
 * CSS variables, the same client helpers (esc, mdToHtml, cancel-on-unload,
 * post, and the Accept ↔ Send review primary-button flip driven by a
 * step-provided hasChanges() hook). A step's server.mjs only supplies a body
 * (step-specific markup) and clientJs (step-specific behavior).
 *
 * F8 fix lives here: embed() JSON-encodes the payload and escapes `<` so a
 * value containing `</script>` cannot terminate the embedded <script> block.
 */

import { RUN_ID } from './server.mjs';

/* ------------------------------------------------------------------ *
 * Server-side helpers
 * ------------------------------------------------------------------ */

/** Embed a value as safe inline-<script> JSON (escapes `<`, U+2028, U+2029). */
export function embed(obj) {
  return JSON.stringify(obj == null ? null : obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** HTML-escape a string for server-side interpolation. */
export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ *
 * Shared CSS
 * ------------------------------------------------------------------ */

export const BASE_CSS = `
[data-theme="dark"]{
  --bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;--text-muted:#8b949e;
  --text-code:#e6edf3;--add-bg:rgba(46,160,67,.15);--add-fg:#7ee787;--del-bg:rgba(248,81,73,.15);
  --del-fg:#f85149;--hunk-bg:rgba(56,139,253,.1);--hunk-fg:#79c0ff;--dot-green:#3fb950;
  --dot-yellow:#d29922;--dot-red:#f85149;--accent:#388bfd;--fb-bg:#1c2128;--green:#238636;
  --green-hover:#2ea043;--code-bg:#1c2128;--bg-green:rgba(46,160,67,.15);--bg-yellow:rgba(210,153,34,.15);
  --bg-red:rgba(248,81,73,.15);--bar-green:#238636;--bar-yellow:#9e6a03;--bar-red:#da3633;
  --drag-over:rgba(56,139,253,.12);
}
[data-theme="light"]{
  --bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;--text-muted:#57606a;
  --text-code:#1f2328;--add-bg:#dafbe1;--add-fg:#1a7f37;--del-bg:#ffebe9;--del-fg:#cf222e;
  --hunk-bg:#ddf4ff;--hunk-fg:#0969da;--dot-green:#1a7f37;--dot-yellow:#9a6700;--dot-red:#cf222e;
  --accent:#0969da;--fb-bg:#f0f6fc;--green:#1a7f37;--green-hover:#1f8b3b;--code-bg:#eff2f5;
  --bg-green:rgba(46,160,67,.1);--bg-yellow:rgba(210,153,34,.1);--bg-red:rgba(248,81,73,.1);
  --bar-green:#1a7f37;--bar-yellow:#9a6700;--bar-red:#cf222e;--drag-over:rgba(9,105,218,.08);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--text);min-height:100vh}
.it-header{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;
  border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:20;gap:12px}
.it-hl{display:flex;align-items:center;gap:8px;min-width:0}
.it-logo{font-weight:600;font-size:14px;white-space:nowrap}
.it-sub{font-size:12px;color:var(--text-muted);white-space:nowrap}
.tag{font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:12px;
  padding:2px 8px;color:var(--text-muted);font-family:monospace;white-space:nowrap}
.it-hr{display:flex;align-items:center;gap:8px;flex-shrink:0}
.it-btn{background:none;border:1px solid var(--border);color:var(--text);padding:6px 12px;
  border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit}
.it-btn:hover{border-color:var(--text-muted)}
.it-btn.cancel{color:var(--text-muted)}
.it-btn.primary{background:var(--green);border-color:var(--green);color:#fff;font-weight:600;
  font-size:14px;padding:8px 20px}
.it-btn.primary:hover{background:var(--green-hover)}
.it-btn.primary:disabled{opacity:.5;cursor:not-allowed}
.lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
  color:var(--text-muted);margin:18px 0 6px}
.empty{color:var(--text-muted);font-style:italic}
.md h1,.md h2,.md h3,.md h4{margin:10px 0 6px;line-height:1.3}
.md h1{font-size:18px}.md h2{font-size:16px}.md h3{font-size:14px}.md h4{font-size:13px}
.md h1:first-child,.md h2:first-child,.md h3:first-child,.md p:first-child{margin-top:0}
.md p{margin:6px 0}.md ul,.md ol{margin:6px 0 6px 22px}.md li{margin:2px 0}
.md code{background:var(--code-bg);border-radius:4px;padding:1px 5px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.md pre{background:var(--code-bg);border-radius:6px;padding:10px 12px;overflow-x:auto;margin:8px 0}
.md pre code{background:none;padding:0;font-size:12.5px}
.md a{color:var(--accent);text-decoration:none}.md a:hover{text-decoration:underline}
`;

/** Diff-table styles shared by the review and implement steps. */
export const DIFF_CSS = `
.fc{background:var(--surface);border:1px solid var(--border);border-radius:6px;
  margin-bottom:14px;overflow:hidden}
.fch{padding:8px 12px;background:var(--bg);border-bottom:1px solid var(--border);
  font-family:monospace;font-size:12px;color:var(--text);display:flex;
  align-items:center;justify-content:space-between}
table.dt{width:100%;border-collapse:collapse;font-family:ui-monospace,Menlo,monospace;
  font-size:12px;line-height:1.5}
td.ln{width:44px;text-align:right;padding:0 8px;color:var(--text-muted);user-select:none}
td.lp{width:16px;text-align:center;user-select:none}
td.lc{padding:0 8px;white-space:pre-wrap;word-break:break-all}
td.ci{width:20px;text-align:center;user-select:none;color:var(--accent)}
tr.addition td{background:var(--add-bg);color:var(--add-fg)}
tr.deletion td{background:var(--del-bg);color:var(--del-fg)}
tr.hunk-header td{background:var(--hunk-bg);color:var(--hunk-fg)}
tr.context td{color:var(--text-code)}
`;

/* ------------------------------------------------------------------ *
 * Shared client JS (runs in the browser; concatenated verbatim into the
 * page after `const D` and `const __PRIMARY` are defined). Contains no
 * `${` interpolation so it can be embedded safely.
 * ------------------------------------------------------------------ */

const SHARED_JS = `
// __RUN is this round's id (embedded by renderPage); echoing it lets the
// server ignore /cancel-/submit from tabs that belong to an earlier round.
function __q(path){ return path + (path.indexOf('?')>=0 ? '&' : '?') + 'r=' + __RUN; }
let __submitted = false;
function sendCancel(){ if(__submitted) return; __submitted = true;
  try{ navigator.sendBeacon(__q('/cancel'),'{}'); }catch(e){} }
window.addEventListener('pagehide', sendCancel);
async function cancelFlow(){ __submitted = true;
  try{ await fetch(__q('/cancel?now=1'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); }catch(e){}
  try{ window.close(); }catch(e){} }
function toggleTheme(){ document.documentElement.dataset.theme =
  document.documentElement.dataset.theme==='dark'?'light':'dark'; }
function esc(s){ return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Update the header primary button label from the step's hasChanges() hook.
function refresh(){ var btn=document.getElementById('primary'); if(!btn) return;
  var changed = (typeof hasChanges==='function') ? hasChanges() : false;
  btn.textContent = changed ? __PRIMARY.changed : __PRIMARY.idle; }
function primaryClick(){ if(typeof onPrimary==='function') onPrimary(); }

// POST a payload to /submit; used by every step's onPrimary and by inline
// round-trip actions (split/merge). Shows sending state on the primary button.
async function post(payload, okMsg){
  var btn=document.getElementById('primary');
  __submitted = true;
  if(btn){ btn.disabled=true; btn.dataset.prev=btn.textContent; btn.textContent='Sending…'; }
  try{
    await fetch(__q('/submit'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(btn) btn.textContent = '✓ ' + (okMsg||'Sent to Claude');
  }catch(e){
    __submitted=false;
    if(btn){ btn.disabled=false; if(typeof refresh==='function') refresh(); else btn.textContent=btn.dataset.prev||'Accept'; }
    alert('Could not reach local server: ' + e.message);
  }
}

// Minimal, dependency-free markdown -> HTML (headings, lists, code, inline).
function mdToHtml(src){
  if(!src || !src.trim()) return '<span class="empty">Empty.</span>';
  const escc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => escc(s)
    .replace(/\`([^\`]+)\`/g, (m,c)=>'<code>'+c+'</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(m,t,u){
      // Only linkify http(s)/mailto/relative targets — never javascript: etc.
      return /^(https?:|mailto:|[\\/.#])/i.test(u)
        ? '<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>' : m;
    });
  const lines = src.split('\\n');
  let html='', i=0, inList=false, listTag='';
  const closeList = () => { if(inList){ html += '</'+listTag+'>'; inList=false; } };
  while(i < lines.length){
    const line = lines[i];
    if(/^\\s*\`\`\`/.test(line)){
      closeList(); i++;
      let code='';
      while(i<lines.length && !/^\\s*\`\`\`/.test(lines[i])){ code += lines[i]+'\\n'; i++; }
      i++;
      html += '<pre><code>'+escc(code.replace(/\\n$/,''))+'</code></pre>';
      continue;
    }
    const h = line.match(/^(#{1,4})\\s+(.*)$/);
    if(h){ closeList(); const lvl=h[1].length; html += '<h'+lvl+'>'+inline(h[2])+'</h'+lvl+'>'; i++; continue; }
    const ul = line.match(/^\\s*[-*]\\s+(.*)$/);
    if(ul){ if(!inList||listTag!=='ul'){ closeList(); inList=true; listTag='ul'; html+='<ul>'; } html+='<li>'+inline(ul[1])+'</li>'; i++; continue; }
    const ol = line.match(/^\\s*\\d+\\.\\s+(.*)$/);
    if(ol){ if(!inList||listTag!=='ol'){ closeList(); inList=true; listTag='ol'; html+='<ol>'; } html+='<li>'+inline(ol[1])+'</li>'; i++; continue; }
    if(/^\\s*$/.test(line)){ closeList(); i++; continue; }
    closeList();
    let para=line; i++;
    while(i<lines.length && !/^\\s*$/.test(lines[i]) &&
      !/^(#{1,4}\\s|\\s*\`\`\`|\\s*[-*]\\s|\\s*\\d+\\.\\s)/.test(lines[i])){ para += ' '+lines[i]; i++; }
    html += '<p>'+inline(para)+'</p>';
  }
  closeList();
  return html;
}
`;

/* ------------------------------------------------------------------ *
 * Page assembly
 * ------------------------------------------------------------------ */

function header(subtitle, showPrimary, idleLabel) {
  return '<header class="it-header">\n' +
    '  <div class="it-hl">' +
    '<span class="it-logo">iterator</span>' +
    '<span class="it-sub">' + escHtml(subtitle) + '</span>' +
    '<span class="tag" id="branch"></span></div>\n' +
    '  <div class="it-hr">' +
    '<button class="it-btn" onclick="toggleTheme()">Toggle theme</button>' +
    '<button class="it-btn cancel" onclick="cancelFlow()">Cancel</button>' +
    (showPrimary
      ? '<button class="it-btn primary" id="primary" onclick="primaryClick()">' + escHtml(idleLabel) + '</button>'
      : '') +
    '</div>\n</header>\n';
}

/**
 * Build a full HTML page for a step.
 *
 * @param {object} o
 * @param {string} o.step            step name (used in header subtitle default)
 * @param {string} [o.subtitle]      header subtitle (default `/ <step>`)
 * @param {string} [o.branch]        branch tag text
 * @param {string} [o.title]         <title> suffix
 * @param {*}      o.data            payload embedded as `const D`
 * @param {string} o.body           step-specific body HTML
 * @param {string} o.clientJs       step-specific browser JS (defines hasChanges/onPrimary + renders)
 * @param {string} [o.css]          step-specific CSS appended after BASE_CSS
 * @param {string} [o.primaryIdle]  primary button label with no changes (default "Accept")
 * @param {string} [o.primaryChanged] primary button label with changes (default "Send review")
 * @param {boolean}[o.primary]      set false to omit the primary button
 */
export function renderPage(o) {
  const step = o.step || 'iterator';
  const subtitle = o.subtitle != null ? o.subtitle : ('/ ' + step);
  const branch = o.branch || 'HEAD';
  const title = o.title ? (step + ' — ' + o.title) : ('iterator — ' + step);
  const primary = { idle: o.primaryIdle || 'Accept', changed: o.primaryChanged || 'Send review' };
  const showPrimary = o.primary !== false;
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + escHtml(title) + '</title>\n<style>\n' + BASE_CSS + (o.css || '') + '\n</style>\n</head>\n<body>\n' +
    header(subtitle, showPrimary, primary.idle) +
    (o.body || '') + '\n' +
    '<script>\n' +
    'const D = ' + embed(o.data == null ? {} : o.data) + ';\n' +
    'const __RUN = ' + embed(RUN_ID) + ';\n' +
    'const __PRIMARY = ' + embed(primary) + ';\n' +
    'document.getElementById("branch").textContent = ' + embed(branch) + ';\n' +
    SHARED_JS + '\n' +
    (o.clientJs || '') + '\n' +
    '</script>\n</body>\n</html>';
}
