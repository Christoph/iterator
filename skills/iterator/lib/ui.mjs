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

import { RUN_ID } from "./server.mjs";

/* ------------------------------------------------------------------ *
 * Server-side helpers
 * ------------------------------------------------------------------ */

/** Embed a value as safe inline-<script> JSON (escapes `<`, U+2028, U+2029). */
export function embed(obj) {
	return JSON.stringify(obj == null ? null : obj)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

/** HTML-escape a string for server-side interpolation. */
export function escHtml(s) {
	return String(s == null ? "" : s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ *
 * Shared CSS
 * ------------------------------------------------------------------ */

// "ink & ember": editorial serif display + system UI body + terminal mono
// micro-labels over warm charcoal (dark) / warm paper (light), with an ember
// copper accent. Every pre-existing variable NAME is preserved so the step
// views inherit the redesign without edits; new tokens are additive.
export const BASE_CSS = `
:root{
  --font-display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --font-ui:"Avenir Next",Avenir,"Segoe UI Variable","Segoe UI",system-ui,-apple-system,sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --fs-xs:11px;--fs-sm:13px;--fs-md:15.5px;--fs-lg:19px;--fs-xl:23px;--fs-2xl:27.5px;
  --fs-mono:12.5px;
  --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:20px;--sp-6:24px;
  --radius-sm:6px;--radius-card:10px;
}
[data-theme="dark"]{
  --bg:#16151a;--surface:#1e1d23;--border:#37343d;--text:#e8e6e1;--text-muted:#a4a099;
  --text-code:#efede8;--add-bg:rgba(87,171,106,.14);--add-fg:#8fd19e;--del-bg:rgba(229,105,94,.13);
  --del-fg:#f2aba3;--hunk-bg:rgba(224,138,78,.12);--hunk-fg:#e9ab7c;--dot-green:#57ab6a;
  --dot-yellow:#d4a13c;--dot-red:#e5695e;--accent:#e08a4e;--accent-soft:rgba(224,138,78,.15);
  --accent-fg:#16151a;--fb-bg:#232228;--green:#57ab6a;
  --green-hover:#69bd7c;--code-bg:#232228;--bg-green:rgba(87,171,106,.14);--bg-yellow:rgba(212,161,60,.14);
  --bg-red:rgba(229,105,94,.13);--bar-green:#57ab6a;--bar-yellow:#d4a13c;--bar-red:#e5695e;
  --drag-over:rgba(224,138,78,.12);--focus-ring:#e08a4e;
  --shadow-card:0 1px 3px rgba(0,0,0,.3);--shadow-raise:0 4px 12px rgba(0,0,0,.35);
}
[data-theme="light"]{
  --bg:#f7f5f1;--surface:#fffdfa;--border:#e0dbd2;--text:#2b2925;--text-muted:#6f6a61;
  --text-code:#2b2925;--add-bg:rgba(87,171,106,.16);--add-fg:#1d5f31;--del-bg:rgba(229,105,94,.14);
  --del-fg:#9c2f24;--hunk-bg:rgba(179,90,31,.1);--hunk-fg:#8a4517;--dot-green:#2f7d43;
  --dot-yellow:#8a6414;--dot-red:#b3382c;--accent:#b35a1f;--accent-soft:rgba(179,90,31,.12);
  --accent-fg:#fff;--fb-bg:#f2efe9;--green:#2f7d43;
  --green-hover:#38914f;--code-bg:#efece6;--bg-green:rgba(87,171,106,.12);--bg-yellow:rgba(212,161,60,.14);
  --bg-red:rgba(229,105,94,.12);--bar-green:#2f7d43;--bar-yellow:#8a6414;--bar-red:#b3382c;
  --drag-over:rgba(179,90,31,.08);--focus-ring:#b35a1f;
  --shadow-card:0 1px 3px rgba(43,41,37,.08);--shadow-raise:0 4px 12px rgba(43,41,37,.12);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-ui);font-size:var(--fs-md);
  background:var(--bg);color:var(--text);min-height:100vh}
:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.it-header{display:flex;align-items:center;justify-content:space-between;padding:10px var(--sp-5);
  border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:20;gap:var(--sp-3)}
.it-hl{display:flex;align-items:center;gap:var(--sp-2);min-width:0}
.it-logo{font-family:var(--font-display);font-style:italic;font-weight:600;
  font-size:var(--fs-lg);letter-spacing:.01em;white-space:nowrap}
.it-sub{font-size:var(--fs-sm);color:var(--text-muted);white-space:nowrap}
.tag{font-size:var(--fs-xs);background:var(--bg);border:1px solid var(--border);border-radius:12px;
  padding:2px var(--sp-2);color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap}
.it-hr{display:flex;align-items:center;gap:var(--sp-2);flex-shrink:0}
.it-btn{background:none;border:1px solid var(--border);color:var(--text);padding:6px var(--sp-3);
  border-radius:var(--radius-sm);cursor:pointer;font-size:var(--fs-sm);font-family:inherit}
.it-btn:hover{border-color:var(--text-muted)}
.it-btn.cancel{color:var(--text-muted)}
.it-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg);
  font-weight:600;font-size:var(--fs-sm);padding:8px var(--sp-5)}
.it-btn.primary:hover{filter:brightness(1.06)}
.it-btn.primary:active{transform:translateY(1px);filter:brightness(.96)}
.it-btn.primary:disabled{opacity:.5;cursor:not-allowed}
.lbl{font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  font-family:var(--font-mono);color:var(--text-muted);margin:18px 0 6px}
.empty{color:var(--text-muted);font-style:italic}
/* Constrain unbounded history feeds without hiding their contents. Views add
   this to the list itself so headings and controls remain outside the scroll. */
.bounded-list{max-block-size:420px;overflow-y:auto;overscroll-behavior:contain;padding-right:var(--sp-2)}
.md h1,.md h2,.md h3,.md h4{margin:10px 0 6px;line-height:1.3;font-family:var(--font-display)}
.md h1{font-size:var(--fs-xl)}.md h2{font-size:var(--fs-lg)}.md h3{font-size:16px}.md h4{font-size:var(--fs-sm)}
.md h1:first-child,.md h2:first-child,.md h3:first-child,.md p:first-child{margin-top:0}
.md p{margin:6px 0}.md ul,.md ol{margin:6px 0 6px 22px}.md li{margin:2px 0}
.md code{background:var(--code-bg);border-radius:4px;padding:1px 5px;
  font-family:var(--font-mono);font-size:var(--fs-mono)}
.md pre{background:var(--code-bg);border-radius:var(--radius-sm);padding:10px var(--sp-3);overflow-x:auto;margin:8px 0}
.md pre code{background:none;padding:0;font-size:var(--fs-mono)}
.md a{color:var(--accent);text-decoration:none}.md a:hover{text-decoration:underline}
/* Read-only mode while the agent works (session shell posts iterator-ro):
   mutating controls go inert; browsing (rail, search, read/modal) stays live. */
body.iterator-ro [data-action],body.iterator-ro #primary,body.iterator-ro textarea,
body.iterator-ro button.kbtn,body.iterator-ro button.act{pointer-events:none;opacity:.45}
body.iterator-ro .rail button,body.iterator-ro .rail input,body.iterator-ro [data-open],
body.iterator-ro .mclose{pointer-events:auto;opacity:1}
body.iterator-ro::before{content:"read-only — agent working";position:fixed;top:0;left:50%;
  transform:translateX(-50%);z-index:100;font-family:var(--font-mono);font-size:var(--fs-xs);
  color:var(--dot-yellow);background:var(--bg-yellow);border:1px solid var(--dot-yellow);
  border-top:none;border-radius:0 0 6px 6px;padding:2px 10px}
`;

/** Diff-table styles shared by the review and implement steps. */
export const DIFF_CSS = `
.fc{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);
  box-shadow:var(--shadow-card);margin-bottom:14px;overflow:hidden}
.fch{padding:var(--sp-2) var(--sp-3);background:var(--bg);border-bottom:1px solid var(--border);
  font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text);display:flex;
  align-items:center;justify-content:space-between}
table.dt{width:100%;border-collapse:collapse;font-family:var(--font-mono);
  font-size:var(--fs-xs);line-height:1.5}
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

// Read-only mode: while the agent works, the session shell posts
// { iterator:'working', working:bool } into this iframe — non-Work tabs stay
// viewable but their mutating controls go inert (see BASE_CSS .iterator-ro).
window.addEventListener('message', function(e){
  if(e.source !== window.parent || !e.data || e.data.iterator !== 'working') return;
  document.body.classList.toggle('iterator-ro', !!e.data.working);
});

// Update the header primary button label from the step's hasChanges() hook.
function refresh(){ var btn=document.getElementById('primary'); if(!btn) return;
  var changed = (typeof hasChanges==='function') ? hasChanges() : false;
  btn.textContent = changed ? __PRIMARY.changed : __PRIMARY.idle; }
function primaryClick(){ if(typeof onPrimary==='function') onPrimary(); }

// POST a payload to /submit; used by every step's onPrimary and by inline
// round-trip actions (split/merge). Shows sending state on the primary button.
async function post(payload, okMsg){
  if(document.body.classList.contains('iterator-ro')){
    alert('Claude is working — actions are disabled until it finishes.');
    return;
  }
  var btn=document.getElementById('primary');
  __submitted = true;
  if(btn){ btn.disabled=true; btn.dataset.prev=btn.textContent; btn.textContent='Sending…'; }
  try{
    var res = await fetch(__q('/submit'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.status === 409){
      // Busy (agent working) or stale round — the action was NOT accepted.
      __submitted = false;
      if(btn){ btn.disabled=false; if(typeof refresh==='function') refresh(); else btn.textContent=btn.dataset.prev||'Accept'; }
      alert('Not sent — Claude is still working (or this view is stale). Try again when the dashboard refreshes.');
      return;
    }
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

function header(subtitle, showPrimary, idleLabel, showCancel) {
	return (
		'<header class="it-header">\n' +
		'  <div class="it-hl">' +
		'<span class="it-logo">iterator</span>' +
		'<span class="it-sub">' +
		escHtml(subtitle) +
		"</span>" +
		'<span class="tag" id="branch"></span></div>\n' +
		'  <div class="it-hr">' +
		(showCancel
			? '<button class="it-btn cancel" onclick="cancelFlow()" title="Close this step without answering — Claude stops this flow">Cancel</button>'
			: "") +
		(showPrimary
			? '<button class="it-btn primary" id="primary" onclick="primaryClick()">' +
				escHtml(idleLabel) +
				"</button>"
			: "") +
		"</div>\n</header>\n"
	);
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
 * @param {boolean}[o.cancel]       set false to omit the header Cancel button
 *   (idle dashboard tabs, where no round is pending and /cancel is a no-op)
 */
export function renderPage(o) {
	const step = o.step || "iterator";
	const subtitle = o.subtitle != null ? o.subtitle : "/ " + step;
	const branch = o.branch || "HEAD";
	const title = o.title ? step + " — " + o.title : "iterator — " + step;
	const primary = {
		idle: o.primaryIdle || "Accept",
		changed: o.primaryChanged || "Send review",
	};
	const showPrimary = o.primary !== false;
	return (
		'<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n' +
		'<meta charset="UTF-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
		"<title>" +
		escHtml(title) +
		"</title>\n<style>\n" +
		BASE_CSS +
		(o.css || "") +
		"\n</style>\n</head>\n<body>\n" +
		header(subtitle, showPrimary, primary.idle, o.cancel !== false) +
		(o.body || "") +
		"\n" +
		"<script>\n" +
		"const D = " +
		embed(o.data == null ? {} : o.data) +
		";\n" +
		"const __RUN = " +
		embed(RUN_ID) +
		";\n" +
		"const __PRIMARY = " +
		embed(primary) +
		";\n" +
		'document.getElementById("branch").textContent = ' +
		embed(branch) +
		";\n" +
		SHARED_JS +
		"\n" +
		(o.clientJs || "") +
		"\n" +
		"</script>\n</body>\n</html>"
	);
}
