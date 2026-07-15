/**
 * iterator: Knowledge view — the OKF memory plane on the shared shell
 * (../ui.mjs, ../server.mjs). The place a user checks what the project is
 * based on: decisions first, then architecture/patterns/pitfalls/setup, the
 * design constants panel, pointer/staleness status, and a free-text "ask the
 * agent" box. Browsing is client-side: an area nav rail, live search, and a
 * centered modal that renders each concept's full body with the revise
 * controls alongside.
 *
 *   input:  the `gather --step knowledge` payload —
 *     { step:"knowledge", branch, project, bundlePath,
 *       memory: { initialized, okfVersion, lastMemorizedCommit,
 *                 conceptCount, staleCount, unmemorizedCommitCount },
 *       areas:    [{ id, title, description, count }],
 *       memories: [{ id, slug, path, area, type, title, description,
 *                    status, files, stale, body }],
 *       design: { title, description, path, register,
 *                 sections: { direction, typography, color, spacing,
 *                             elements, responsive, signature } } | null,
 *       formatStale }
 *   output: one JSON line to stdout —
 *     { type:"action", action:"iterator-init"|"iterator-consolidate"|"iterator-memorize"
 *         |"refresh-format"|"design"|"draft-memory"|"draft-memory-prompt"
 *         |"update-memory"|"close", target: "<area or concept id>"|null,
 *       prompt: "<free text>" }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage, escHtml } from "../ui.mjs";

const CSS = `
.wrap{max-width:960px;margin:0 auto;padding:var(--sp-5)}
.panel{border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);background:var(--surface);padding:var(--sp-4);margin:0 0 18px}
.hero{display:grid;gap:14px}.hero h2,.panel h2{font-family:var(--font-display);font-size:var(--fs-lg);margin:0 0 4px}.hero p,.hint,.muted{color:var(--text-muted)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.metrics div{border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg)}
.metrics strong{display:block;font-family:var(--font-display);font-size:var(--fs-lg)}.metrics span{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.metrics .warn strong{color:var(--dot-yellow)}
.attention{border:1px solid var(--dot-yellow);background:var(--bg-yellow);border-radius:var(--radius-sm);
  padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:var(--fs-sm);color:var(--dot-yellow)}
.attention button{border-color:var(--dot-yellow);color:var(--dot-yellow);background:transparent}
.actions,.card-actions,.section-head{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap}
.section-head{justify-content:space-between}
button.kbtn,.actions button,.card-actions button,.attention button{font-size:var(--fs-sm);padding:4px var(--sp-3);
  border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text);font-family:inherit}
.actions button:hover,.card-actions button:hover,button.kbtn:hover{border-color:var(--accent);color:var(--accent)}
.rail{position:sticky;top:0;z-index:10;background:var(--bg);display:flex;gap:6px;align-items:center;
  flex-wrap:wrap;padding:8px 0 10px;margin-bottom:6px;border-bottom:1px solid var(--border)}
.rail button{font-family:var(--font-mono);font-size:var(--fs-xs);border-radius:12px;padding:3px 12px;
  border:1px solid var(--border);background:var(--surface);color:var(--text-muted);cursor:pointer}
.rail button.sel{border-color:var(--accent);color:var(--accent);background:var(--code-bg)}
.rail button .cnt{opacity:.7;margin-left:4px}
.rail input{flex:1;min-width:180px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-size:var(--fs-sm);padding:5px 12px;outline:none;font-family:inherit}
.rail input:focus{border-color:var(--accent)}
.memory-card{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);padding:var(--sp-3);margin-bottom:var(--sp-3)}
.memory-card.pinned{border-left:3px solid var(--accent)}
.memory-card h3{margin:0;font-size:var(--fs-md);cursor:pointer}
.memory-card h3:hover{color:var(--accent)}
.memory-card p{color:var(--text-muted);font-size:var(--fs-sm);margin:5px 0}
.card-head{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap}
.status{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-radius:12px;padding:2px var(--sp-2);border:1px solid var(--border);color:var(--text-muted)}
.badge-stale{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.5px;border-radius:4px;padding:2px 6px;
  background:var(--bg-yellow);color:var(--dot-yellow);border:1px solid var(--dot-yellow);text-transform:uppercase}
.area-tag{font-family:var(--font-mono);font-size:10px;border-radius:4px;padding:2px 6px;background:var(--code-bg);color:var(--accent)}
.meta{font-size:var(--fs-xs);color:var(--text-muted);margin:5px 0}
.meta code{font-size:var(--fs-xs);margin-right:4px;background:var(--code-bg);border-radius:4px;padding:1px 5px;font-family:var(--font-mono)}
.design-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--sp-3);margin-top:10px}
.design-sec{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);padding:var(--sp-3)}
.design-sec h4{margin:0 0 6px;font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.design-sec .md{font-size:var(--fs-sm);line-height:1.6}
.swatches{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.swatch{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:var(--fs-xs);border:1px solid var(--border);border-radius:12px;padding:2px 8px;background:var(--bg)}
.swatch i{width:14px;height:14px;border-radius:3px;border:1px solid var(--border);display:inline-block}
.mscrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:150;display:none}
.mscrim.open{display:flex;align-items:center;justify-content:center;padding:var(--sp-4)}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);width:min(760px,92vw);max-height:85vh;display:flex;flex-direction:column}
.modal header{display:flex;align-items:flex-start;gap:8px;justify-content:space-between;padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--border)}
.modal header h3{margin:0 0 4px;font-size:var(--fs-md)}
.mclose{border:none;background:transparent;color:var(--text-muted);font-size:var(--fs-lg);cursor:pointer;line-height:1;padding:0 2px}
.mclose:hover{color:var(--accent)}
.mbody{padding:var(--sp-3) var(--sp-4);overflow:auto;font-size:var(--fs-sm);line-height:1.65}
.mfoot{padding:var(--sp-3) var(--sp-4);border-top:1px solid var(--border)}
.mfoot .memory-comment{margin:0 0 8px}
.memory-comment{width:100%;min-height:58px;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-2);font:inherit;margin:8px 0;font-size:var(--fs-sm)}
.group-h{display:flex;align-items:baseline;gap:10px;margin:18px 0 10px}
.group-h h3{font-family:var(--font-display);font-size:var(--fs-lg);margin:0;text-transform:capitalize}
.group-h .muted{font-size:var(--fs-xs)}
.group-empty{border:1px dashed var(--border);border-radius:var(--radius-sm);padding:14px;color:var(--text-muted);
  font-size:var(--fs-sm);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.request-box{display:grid;gap:var(--sp-2)}
.request-box textarea{width:100%;min-height:70px;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-2);font:inherit}
.no-hits{color:var(--text-muted);font-style:italic;padding:14px 0}
`;

function memoryStatus(data) {
	const memory = data.memory || {};
	const initialized = Boolean(memory.initialized);
	const commit = memory.lastMemorizedCommit
		? String(memory.lastMemorizedCommit).slice(0, 12)
		: "not set";
	const stale = memory.staleCount ?? 0;
	const pending = memory.unmemorizedCommitCount ?? 0;
	const needsAttention =
		stale > 0 || (typeof pending === "number" && pending > 0);
	return `<section class="panel hero">
  <div>
    <h2>Memory status</h2>
    <p>${initialized ? "This project has an OKF memory bundle — what follows is what the project is based on." : "No OKF memory bundle detected yet."}</p>
  </div>
  ${
		needsAttention
			? `<div class="attention">⚠ ${stale ? `${escHtml(stale)} stale concept${stale === 1 ? "" : "s"} (anchors point at moved/deleted files)` : ""}${stale && pending ? " · " : ""}${pending ? `${escHtml(pending)} commit${pending === 1 ? "" : "s"} nobody memorized` : ""}
    ${stale ? '<button data-action="iterator-consolidate">Consolidate now</button>' : ""}
    ${pending ? '<button data-action="iterator-memorize">Memorize commits</button>' : ""}</div>`
			: ""
	}
  <div class="metrics">
    <div><strong>${initialized ? "Initialized" : "Missing"}</strong><span>state</span></div>
    <div><strong>${escHtml(memory.conceptCount ?? 0)}</strong><span>concepts</span></div>
    <div${stale ? ' class="warn"' : ""}><strong>${escHtml(stale)}</strong><span>stale</span></div>
    <div><strong>${escHtml(memory.unmemorizedCommitCount ?? "?")}</strong><span>unmemorized commits</span></div>
    <div><strong>${escHtml(commit)}</strong><span>last memorized</span></div>
  </div>
  <div class="actions">
    ${initialized ? "" : '<button data-action="iterator-init">Initialize</button>'}
    <button data-action="iterator-consolidate">Consolidate</button>
    <button data-action="iterator-memorize">Memorize commits</button>
    ${data.formatStale ? '<button data-action="refresh-format" title="memory/format.md drifted from the current template">Refresh format.md</button>' : ""}
  </div>
</section>`;
}

const JS = `
// Decisions first — the browser answers "what is this project based on".
const AREA_ORDER = ['decisions', 'architecture', 'patterns', 'pitfalls', 'setup'];
const AREA_HINTS = {
  decisions: 'Choices the project committed to — new work must not silently contradict these.',
  architecture: 'The real subsystem seams feature boundaries follow.',
  patterns: 'How the surrounding code expects to be extended.',
  pitfalls: 'Known sharp edges, surfaced next to reviews of the anchored files.',
  setup: 'Environment and tooling facts.',
};
const MEMS = Array.isArray(D.memories) ? D.memories : [];
const S = { area: 'all', q: '', modal: null };

renderRail();
renderBrowser();
wireActions(document);
document.getElementById('mscrim').addEventListener('click', e => { if(e.target.id === 'mscrim') closeModal(); });
document.getElementById('m-close').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.modal) closeModal(); });

function counts(){
  const by = { all: MEMS.length + (D.design ? 1 : 0) };
  MEMS.forEach(m => { by[m.area] = (by[m.area]||0) + 1; });
  return by;
}
function renderRail(){
  const rail = document.getElementById('rail');
  const by = counts();
  const areas = ['all', ...AREA_ORDER.filter(a => a in by || true), ...Object.keys(by).filter(a => a!=='all' && !AREA_ORDER.includes(a))];
  rail.innerHTML = '';
  [...new Set(areas)].forEach(a => {
    const b = document.createElement('button');
    b.className = S.area === a ? 'sel' : '';
    b.innerHTML = esc(a) + '<span class="cnt">' + (by[a]||0) + '</span>';
    b.addEventListener('click', () => { S.area = a; renderRail(); renderBrowser(); });
    rail.appendChild(b);
  });
  const inp = document.createElement('input');
  inp.placeholder = 'Search concepts (title, description, files)…';
  inp.value = S.q;
  inp.addEventListener('input', () => { S.q = inp.value.trim().toLowerCase(); renderBrowser(); });
  rail.appendChild(inp);
  const fresh = rail.querySelector('input'); if(S.q) fresh.focus();
}
function matches(m){
  if(S.area !== 'all' && m.area !== S.area) return false;
  if(!S.q) return true;
  const hay = (m.id+' '+(m.title||'')+' '+(m.description||'')+' '+(m.files||[]).join(' ')).toLowerCase();
  return S.q.split(/\\s+/).every(t => hay.includes(t));
}
const DESIGN_SECS = [['direction','Direction'],['typography','Typography'],['color','Color'],
  ['spacing','Spacing'],['elements','Elements'],['responsive','Responsive'],['signature','Signature']];
function designPanelHtml(){
  const d = D.design;
  if(!d) return '';
  const secs = DESIGN_SECS.filter(([k]) => (d.sections||{})[k]);
  const blocks = secs.map(([k, label]) => {
    const text = d.sections[k];
    let sw = '';
    if(k === 'color'){
      const vals = text.match(/#[0-9a-fA-F]{3,8}\\b|oklch\\([^)]*\\)/g) || [];
      if(vals.length) sw = '<div class="swatches">'+vals.slice(0,16).map(v =>
        '<span class="swatch"><i style="background:'+esc(v)+'"></i><code>'+esc(v)+'</code></span>').join('')+'</div>';
    }
    return '<div class="design-sec"><h4>'+esc(label)+'</h4>'+sw+'<div class="md">'+mdToHtml(text)+'</div></div>';
  }).join('');
  return '<article class="memory-card pinned" data-id="design">'+
    '<div class="card-head"><h3>'+esc(d.title||'Design parameters')+'</h3>'+
    '<span><span class="area-tag">design</span> <span class="status">'+esc(d.register||'product')+'</span></span></div>'+
    '<p>'+esc(d.description||'')+'</p>'+
    '<div class="meta"><span>path: <code>'+esc(d.path||'design.md')+'</code></span> <span>applied to every UI feature</span></div>'+
    (blocks ? '<div class="design-grid">'+blocks+'</div>' : '')+
    '<textarea class="memory-comment" data-comment-for="design" placeholder="Comment with the design change you want (colors, fonts, spacing constants, element styles)."></textarea>'+
    '<div class="card-actions"><button data-action="design" data-target="design">Revise via /iterator-design</button></div></article>';
}
function cardHtml(m, i){
  const files = (m.files&&m.files.length) ? m.files.map(f=>'<code>'+esc(f)+'</code>').join(' ') : '<span class="muted">none</span>';
  return '<article class="memory-card" data-id="'+esc(m.id)+'">'+
    '<div class="card-head"><h3 data-open="'+esc(m.id)+'" title="Read the full concept">'+esc(m.title||m.id)+'</h3>'+
      '<span>'+(S.area==='all'?'<span class="area-tag">'+esc(m.area)+'</span> ':'')+
      (m.stale?'<span class="badge-stale">STALE</span> ':'')+
      (m.status?'<span class="status">'+esc(m.status)+'</span>':'')+'</span></div>'+
    '<p>'+esc(m.description||'')+'</p>'+
    '<div class="meta"><span>type: <code>'+esc(m.type||'Concept')+'</code></span> <span>path: <code>'+esc(m.path||m.id+'.md')+'</code></span></div>'+
    '<div class="meta"><span>files: '+files+'</span></div>'+
    '<div class="card-actions"><button class="kbtn" data-open="'+esc(m.id)+'">Read</button></div></article>';
}
function openModal(id){
  const m = MEMS.find(x => x.id === id);
  if(!m) return;
  S.modal = id;
  document.getElementById('m-title').textContent = m.title || m.id;
  document.getElementById('m-tags').innerHTML = '<span class="area-tag">'+esc(m.area)+'</span> '+
    (m.stale?'<span class="badge-stale">STALE</span> ':'')+
    (m.status?'<span class="status">'+esc(m.status)+'</span>':'');
  document.getElementById('m-meta').innerHTML = 'path: <code>'+esc(m.path||m.id+'.md')+'</code>';
  document.getElementById('m-body').innerHTML = mdToHtml(m.body || '_(empty body)_');
  const ta = document.getElementById('m-comment');
  ta.value = ''; ta.dataset.commentFor = m.id;
  document.getElementById('m-update').dataset.target = m.id;
  document.getElementById('m-draft').dataset.target = m.id;
  document.getElementById('mscrim').classList.add('open');
  document.getElementById('m-body').scrollTop = 0;
}
function closeModal(){
  S.modal = null;
  document.getElementById('mscrim').classList.remove('open');
}
function renderBrowser(){
  const box = document.getElementById('browser');
  const hits = MEMS.filter(matches);
  let html = '';
  if(S.area === 'all' || S.area === 'design'){
    if(!S.q || 'design parameters'.includes(S.q)) html += designPanelHtml();
  }
  const areas = S.area === 'all'
    ? [...AREA_ORDER, ...new Set(hits.map(m=>m.area).filter(a=>!AREA_ORDER.includes(a)))]
    : [S.area];
  areas.forEach(a => {
    const items = hits.filter(m => m.area === a);
    if(!items.length && S.q) return; // searching → hide empty groups
    html += '<div class="group-h"><h3>'+esc(a)+'</h3><span class="muted">'+esc(AREA_HINTS[a]||'')+'</span></div>';
    if(!items.length){
      html += '<div class="group-empty"><span>No '+esc(a)+' recorded yet'+(AREA_HINTS[a]?' — '+esc(AREA_HINTS[a].toLowerCase()):'')+'</span>'+
        '<button data-action="draft-memory" data-target="'+esc(a)+'">Add the first one</button></div>';
      return;
    }
    html += items.map(cardHtml).join('');
  });
  if(!html) html = '<div class="no-hits">Nothing matches — clear the search or pick another area.</div>';
  box.innerHTML = html;
  box.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.open));
  });
  wireActions(box);
}
function hasChanges() { return false; }
function sendAction(action, target, prompt) {
  post({ type: 'action', action: action, target: target || null, prompt: prompt || '' }, 'Action sent');
}
function wireActions(scope) {
  scope.querySelectorAll('[data-action]').forEach(function (btn) {
    if(btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      var action = btn.dataset.action;
      var prompt = '';
      if (action === 'draft-memory-prompt') prompt = document.getElementById('memory-prompt').value.trim();
      if (action === 'update-memory' || action === 'design') {
        var target = action === 'design' ? 'design' : (btn.dataset.target || '');
        var comment = Array.prototype.find.call(document.querySelectorAll('[data-comment-for]'), function (el) {
          return el.dataset.commentFor === target;
        });
        prompt = comment ? comment.value.trim() : '';
      }
      sendAction(action, btn.dataset.target || null, prompt);
    });
  });
}
`;

export function render(data) {
	const BODY = `<div class="wrap">
${memoryStatus(data)}
<section class="panel">
  <div class="section-head"><h2>Knowledge browser</h2><span class="muted">${escHtml((data.memories || []).length)} concept files</span></div>
  <p class="hint">Decisions first — this is what the project is based on. Click a title (or Read) to open the full concept in a modal, with the revise controls right there; STALE means a files: anchor points at an untracked path.</p>
  <div class="rail" id="rail"></div>
  <div id="browser"></div>
</section>
<section class="panel request-box">
  <h2>Ask the agent to add memory</h2>
  <p class="hint">Describe the architecture, decision, pattern, pitfall, or setup fact you want researched. The agent drafts a normal review card for accept/revise/delete.</p>
  <textarea id="memory-prompt" placeholder="Example: Capture how the review server binds ports and why token checks matter."></textarea>
  <div class="actions"><button data-action="draft-memory-prompt">Draft memory from prompt</button></div>
</section>
</div>
<div class="mscrim" id="mscrim">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <header>
      <div><h3 id="m-title"></h3><div class="meta" id="m-meta"></div></div>
      <span id="m-tags"></span>
      <button class="mclose" id="m-close" type="button" aria-label="Close memory">✕</button>
    </header>
    <div class="mbody md" id="m-body"></div>
    <div class="mfoot">
      <textarea class="memory-comment" id="m-comment" data-comment-for="" placeholder="Comment with the update this memory needs."></textarea>
      <div class="card-actions">
        <button data-action="update-memory" id="m-update">Update via comment</button>
        <button data-action="draft-memory" id="m-draft">Add related memory</button>
      </div>
    </div>
  </div>
</div>`;
	return renderPage({
		step: "knowledge",
		subtitle: "/ knowledge",
		branch: data.branch,
		title: "knowledge",
		data,
		css: CSS,
		body: BODY,
		clientJs: JS,
		primary: false,
		cancel: false,
	});
}
