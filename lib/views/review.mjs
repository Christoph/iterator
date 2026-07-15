/**
 * iterator-review: feature-grouped diff review UI on the shared shell.
 *
 * Input:  { branch, commit, plan, progress, hasFeaturesFile, mode, features:[{name,description,
 *           blastRadius,dependsOn,stats,files:[{path,hunks,group,defaulted,disposition}],
 *           tests:{status,total,passing},
 *           pitfalls:[{id,title,description,path,matched}]}], uncategorized:[],
 *           pitfalls:[...same, for uncategorized files],
 *   group: "declared"|"tests"|"incidental"|"bootstrap" — every changed file is
 *   attributed to a feature (no floating uncategorized bucket): declared/tests
 *   match the contract; incidental files were auto-assigned to the active
 *   feature (defaulted:true, disposition carries the default — reassignable);
 *   bootstrap files were staged before the round and default to their own
 *   chore(bootstrap) commit. `uncategorized` stays only as the degenerate
 *   zero-feature fallback.
 *           designFile,             // memory/design.md path | null — UI diffs are checked against it
 *           memory:{proposals:[{action,area,slug,title,description,reason}]} }
 *   pitfalls (optional): pitfall concepts whose files: anchors match the
 *   feature's changed files — rendered as an amber card in the feature detail
 *   plus a ⚠ marker on the sidebar row ("this file has a known sharp edge").
 *   tests (optional): status "red"|"green"|"none"; rendered as a badge so the
 *   reviewer sees the feature's test state where the commit decision happens.
 *   memory (optional, commit mode): knowledge updates proposed from the
 *   implemented features — shown as toggleable cards (default: apply) so the
 *   knowledge-base write is reviewed exactly where the commit is decided.
 *   mode:"review" (default) — standalone review; primary Accept / Send review.
 *   mode:"commit"           — driven by /iterator-implement to review the just-built
 *                             feature wave; primary Accept and commit / Send review.
 * Output: { type:"review-feedback", branch, features:[{name,status,note}],
 *           lineComments:[{feature,file,content,type,comment}] }
 *         or (commit mode, no changes) { type:"accept-commit", branch, feature,
 *           features:[every reviewed feature],
 *           uncategorized:[{path, feature:"<slug>"|"skip"|"bootstrap"}],  // disposition per
 *             incidental/bootstrap file — pre-seeded from the gather defaults, always populated
 *           memory:{accepted:["area/slug"],skipped:[...]} }
 *         plus the shared { type:"cancel" } / { type:"timeout" }.
 * The payload also carries hasChanges — servers refuse to render when false
 * (the deterministic zero-change guard); the empty state here is the last
 * resort only.
 */
import { renderPage, DIFF_CSS } from "../ui.mjs";

const CSS = `
body{height:100vh;overflow:hidden;display:flex;flex-direction:column}
.main{display:flex;flex:1;overflow:hidden}
.sidebar{width:230px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;background:var(--surface);padding:8px 0}
.sec-label{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);padding:8px 12px 4px}
.fi{padding:8px 12px;cursor:pointer;border-left:3px solid transparent;display:flex;align-items:flex-start;gap:8px}
.fi:hover{background:var(--bg)}
.fi.active{border-left-color:var(--accent);background:var(--bg)}
.dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}
.dg{background:var(--dot-green)}.dy{background:var(--dot-yellow)}.dr{background:var(--dot-red)}
.fm{flex:1;min-width:0}
.fn{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs{font-size:11px;color:var(--text-muted);margin-top:2px}
.sa{color:var(--add-fg)}.sd{color:var(--del-fg)}
.sbadge{font-size:10px;border-radius:3px;padding:1px 5px;margin-top:3px;display:inline-block}
.s-app{background:var(--bg-green);color:var(--dot-green)}
.s-chg{background:var(--bg-red);color:var(--dot-red)}
.s-qst{background:var(--bg-yellow);color:var(--dot-yellow)}
.detail{flex:1;overflow-y:auto;padding:var(--sp-5);padding-bottom:130px}
.fc{overflow:visible}
.fch{position:sticky;top:0;z-index:5;border-radius:var(--radius-card) var(--radius-card) 0 0}
.fh{margin-bottom:var(--sp-4);padding-bottom:var(--sp-4);border-bottom:1px solid var(--border)}
.ftitle{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:6px}
.fdesc{color:var(--text-muted);font-size:var(--fs-sm);margin-bottom:12px}
button.note-btn{font-size:12px;background:none;border:1px dashed var(--border);color:var(--text-muted);border-radius:4px;padding:3px 8px;cursor:pointer}
button.note-btn:hover{border-color:var(--accent);color:var(--accent)}
.note-area{display:none;margin-top:8px}
.note-area.open{display:block}
.note-area textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:8px;font-size:13px;resize:vertical;min-height:60px}
.na{margin-top:4px;display:flex;gap:6px}
button.ns,button.nc{font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.ns{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.meta{display:flex;gap:var(--sp-5);margin-bottom:var(--sp-4);flex-wrap:wrap}
.mi{display:flex;flex-direction:column;gap:2px}
.ml{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.mv{font-size:var(--fs-sm)}
.blast{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--dot-yellow);
  border-radius:4px;padding:10px 12px;margin-bottom:20px;font-size:13px;line-height:1.5}
.bl{font-size:11px;text-transform:uppercase;color:var(--dot-yellow);margin-bottom:4px;letter-spacing:.05em}
.pitfall{background:var(--accent-soft);border:1px solid var(--accent);border-left:3px solid var(--accent);
  border-radius:4px;padding:10px var(--sp-3);margin-bottom:var(--sp-3);font-size:var(--fs-sm);line-height:1.5}
.pl{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;color:var(--accent);margin-bottom:4px;letter-spacing:.05em}
.pitfall .pm{font-size:11.5px;color:var(--text-muted);margin-top:4px}
.pitfall .pm code{background:var(--code-bg);border-radius:3px;padding:0 4px;font-family:var(--font-mono)}
.uncbox{background:var(--bg-yellow);border:1px solid var(--dot-yellow);border-radius:4px;
  padding:10px var(--sp-3);margin:10px 0;font-size:var(--fs-sm)}
.uncbox .ml{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;
  color:var(--dot-yellow);margin-bottom:8px;letter-spacing:.05em}
.uncrow{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.uncrow code{background:var(--code-bg);border-radius:3px;padding:1px 6px;font-family:var(--font-mono);font-size:12px}
.uncrow select{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-size:12px;padding:3px 8px;outline:none}
.uncrow select:focus{border-color:var(--accent)}
.sbtns{display:inline-flex;gap:0;margin-bottom:var(--sp-5);border:1px solid var(--border);
  border-radius:var(--radius-sm);overflow:hidden}
button.sb{font-size:var(--fs-sm);padding:4px var(--sp-3);border:none;border-right:1px solid var(--border);
  border-radius:0;cursor:pointer;background:var(--surface);color:var(--text)}
button.sb:last-child{border-right:none}
button.sb:hover{opacity:.8}
button.sb:focus-visible{outline-offset:-2px}
button.sb.aa{background:var(--bg-green);border-color:var(--dot-green);color:var(--dot-green)}
button.sb.ac{background:var(--bg-red);border-color:var(--dot-red);color:var(--dot-red)}
button.sb.aq{background:var(--bg-yellow);border-color:var(--dot-yellow);color:var(--dot-yellow)}
.warn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:4px;padding:8px 12px;font-size:13px;color:var(--dot-red);margin-bottom:16px}
.fp{color:var(--text)}
tr.dl{cursor:pointer}
tr.dl:hover td{filter:brightness(1.15)}
tr.dl.sel td{outline:1px solid var(--accent)}
tr.cr{display:none}
tr.cr.open{display:table-row}
td.cc{padding:6px 8px 6px 56px;background:var(--bg)}
td.cc textarea{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:4px;
  color:var(--text);padding:6px 8px;font-size:var(--fs-xs);font-family:var(--font-ui);resize:vertical;min-height:48px}
.ca{display:flex;gap:6px;margin-top:4px}
button.cs,button.cc2{font-size:var(--fs-xs);padding:2px 8px;border-radius:3px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.cs{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.mem{padding:8px 12px;border-left:3px solid transparent;cursor:pointer;display:flex;gap:8px;align-items:flex-start}
.mem:hover{background:var(--bg)}
.mem.off{opacity:.45}
.mem .glyph{font-size:12px;width:14px;flex-shrink:0;text-align:center;margin-top:1px}
.mem .mt{font-size:12px;font-weight:500}
.mem .ms{font-size:11px;color:var(--text-muted);margin-top:1px}
.mem .mtag{font-size:10px;border:1px solid var(--border);border-radius:3px;padding:0 4px;margin-left:4px;color:var(--text-muted)}
.mem .state{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--dot-green);margin-top:2px}
.mem.off .state{color:var(--text-muted)}
.mem-review{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:12px;margin-bottom:18px}
.mem-review h3{font-size:14px;margin:0}.mem-review .hint{font-size:12px;color:var(--text-muted);margin:4px 0 10px}
.mem-cards{display:grid;gap:10px}.mem-card{border:1px solid var(--border);border-radius:7px;background:var(--bg);padding:10px 12px}
.mem-card.off{opacity:.58}.mem-head{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:6px}
.mem-title{font-weight:600;font-size:13px}.mem-state{font-size:10px;font-weight:700;letter-spacing:.05em;border-radius:10px;padding:2px 7px;background:var(--bg-green);color:var(--dot-green)}
.mem-card.off .mem-state{background:var(--code-bg);color:var(--text-muted)}.mem-toggle{font-size:12px;padding:3px 9px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-family:inherit}
.mem-toggle:hover{border-color:var(--accent);color:var(--accent)}.mem-meta{font-size:11.5px;color:var(--text-muted);display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}
.mem-meta code{background:var(--code-bg);border-radius:3px;padding:0 4px;font-family:var(--font-mono)}.mem-desc{font-size:12.5px;color:var(--text-muted);margin:5px 0}
.mem-reason{border-left:3px solid var(--accent);padding:4px 9px;margin:7px 0;font-size:12.5px;background:var(--accent-soft);color:var(--text)}
.mem-section{margin-top:8px}.mem-section .ml{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px}.mem-section .md{font-size:13px;border-left:3px solid var(--border);padding-left:9px}
.muted{color:var(--text-muted)}
.empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.empty h3{font-size:16px;margin-bottom:8px}
.fb{position:fixed;bottom:0;right:0;width:400px;background:var(--fb-bg);border-top:1px solid var(--border);
  border-left:1px solid var(--border);border-radius:8px 0 0 0;z-index:100;transition:transform .2s}
.fb.col{transform:translateY(calc(100% - 36px))}
.fbh{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;user-select:none}
.fbt{font-size:13px;font-weight:500}
.fbc{font-size:var(--fs-xs);background:var(--accent);color:var(--accent-fg);border-radius:10px;padding:1px 7px;display:none}
.fbc.vis{display:inline}
.fbtog{font-size:11px;color:var(--text-muted)}
.fbb{padding:0 12px 12px}
.fbo{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;font-family:var(--font-mono);
  font-size:var(--fs-xs);color:var(--text);max-height:160px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;min-height:48px}
.fbe{color:var(--text-muted);font-style:italic}
.fbhint{margin-top:8px;font-size:var(--fs-xs);color:var(--text-muted)}
.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:0}
.sdot.g{background:var(--dot-green)}.sdot.r{background:var(--dot-red)}
`;

const BODY = `
<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="detail" id="detail"><div class="empty"><h3>Select a feature to review</h3></div></div>
</div>
<div class="fb col" id="fbpanel">
  <div class="fbh" onclick="toggleFb()">
    <div style="display:flex;align-items:center;gap:8px"><span class="fbt">Feedback</span><span class="fbc" id="fbc">0</span></div>
    <span class="fbtog" id="fbtog">▲ expand</span>
  </div>
  <div class="fbb">
    <div class="fbo" id="fbo"><span class="fbe">Add comments or mark features to generate feedback…</span></div>
    <div class="fbhint">Use <strong>Accept</strong> / <strong>Send review</strong> in the header to submit.</div>
  </div>
</div>
`;

const JS = `
D.features = D.features || D.features || [];
// mode 'commit' = driven by /iterator-implement to review the just-built feature;
// the no-change primary commits. mode 'review' (default) = standalone review.
const MODE = D.mode || 'review';
// comments: id -> {feature,file,content,type,comment}; keyed per feature and
// captured at save time so comments survive switching features (same
// file/hunk/line indexes exist in every feature's diff).
// memSkip: indexes of memory proposals the user toggled OFF (default: apply).
// unc: path -> disposition ('skip' | 'bootstrap' | feature slug) for
// incidental/bootstrap files — pre-seeded from the gather defaults, so
// nothing is ever undisposed; the reviewer only reassigns.
const S = { active: null, statuses: {}, notes: {}, comments: {}, memSkip: {}, unc: {} };
const MEM = (D.memory && D.memory.proposals) || [];
(D.features||[]).forEach(f => (f.files||[]).forEach(file => {
  if(file.defaulted && file.disposition) S.unc[file.path] = file.disposition;
}));

renderSidebar();
const first = (D.features||[])[0] || (D.uncategorized && D.uncategorized.length ? {name:'__unc__'} : null);
if(first) selectFeature(first.name);
else {
  // Defensive empty state — the zero-change guard upstream should make this
  // unreachable; never show an empty review as if it were reviewable.
  document.getElementById('detail').innerHTML =
    '<div class="empty"><h3>Nothing to review</h3><p>No diff and no recorded commits for this scope.</p></div>';
}
refresh();

function renderSidebar(){
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  const feats = D.features || [];
  const hasUnc = D.uncategorized && D.uncategorized.length;
  if(!D.hasFeaturesFile){
    const b = document.createElement('div');
    b.style.cssText = 'font-size:11px;padding:8px 12px;color:var(--text-muted);border-bottom:1px solid var(--border)';
    b.textContent = 'No features — run /iterator-plan first';
    sb.appendChild(b);
  }
  // Design-params state: UI-touching diffs are reviewed against memory/design.md.
  const dc = document.createElement('div');
  dc.style.cssText = 'font-size:11px;padding:6px 12px;border-bottom:1px solid var(--border);color:'+
    (D.designFile ? 'var(--dot-green)' : 'var(--text-muted)');
  dc.textContent = D.designFile ? '\\u25c6 design params attached' : '\\u25c7 no design params (/iterator-design)';
  dc.title = D.designFile || 'UI-touching changes should be checked against memory/design.md';
  sb.appendChild(dc);
  if(feats.length){
    const l = document.createElement('div'); l.className='sec-label'; l.textContent='Features'; sb.appendChild(l);
    feats.forEach(f => sb.appendChild(makeFI(f)));
  }
  if(hasUnc){
    const l = document.createElement('div'); l.className='sec-label'; l.style.marginTop='8px'; l.textContent='Uncategorized'; sb.appendChild(l);
    const unc = { name:'__unc__', stats:{ added: D.uncategorized.reduce((s,f)=>s+(f.stats&&f.stats.added||0),0),
      removed: D.uncategorized.reduce((s,f)=>s+(f.stats&&f.stats.removed||0),0), files:D.uncategorized.length, complexity:'red' }};
    sb.appendChild(makeFI(unc));
  }
  if(MODE==='commit' && MEM.length){
    const l = document.createElement('div'); l.className='sec-label'; l.style.marginTop='8px'; l.textContent='Memory updates'; sb.appendChild(l);
    MEM.forEach((p,i) => sb.appendChild(makeMem(p,i)));
  }
}
// knowledge proposal card: click toggles apply (default) vs skip.
function memId(p){
  const raw = p.id || ((p.area||'')+'/'+(p.slug||''));
  return String(raw).split('/').filter(Boolean).join('/');
}
function makeMem(p, i){
  const el = document.createElement('div');
  el.className = 'mem' + (S.memSkip[i] ? ' off' : '');
  el.title = (S.memSkip[i] ? 'Skipped — click to apply on commit' : 'Applied on commit — click to skip');
  const glyph = p.action==='delete' ? '−' : p.action==='update' ? '~' : '+';
  el.innerHTML = '<div class="glyph">'+(S.memSkip[i]?'✗':glyph)+'</div><div class="fm">'+
    '<div class="mt">'+esc(p.title||p.slug||'')+'<span class="mtag">'+esc(memId(p))+'</span></div>'+
    '<div class="ms">'+esc(p.reason||p.description||'')+'</div>'+
    '<div class="state">'+(S.memSkip[i]?'skipped':'will apply')+'</div></div>';
  el.onclick = () => { toggleMem(i); };
  return el;
}
function toggleMem(i){
  if(S.memSkip[i]) delete S.memSkip[i]; else S.memSkip[i]=true;
  renderSidebar();
  if(S.active) selectFeature(S.active);
}
function memDecisions(){
  return { accepted: MEM.filter((p,i)=>!S.memSkip[i]).map(memId), skipped: MEM.filter((p,i)=>S.memSkip[i]).map(memId) };
}
function memoryPanelHtml(){
  if(MODE!=='commit' || !MEM.length) return '';
  return '<section class="mem-review"><h3>Memory proposal details</h3>'+
    '<p class="hint">These knowledge writes are applied on Accept and commit unless skipped. Review the body, anchors, and current version before approving.</p>'+
    '<div class="mem-cards">'+MEM.map(memCardHtml).join('')+'</div></section>';
}
function memList(values, empty){
  if(!Array.isArray(values) || !values.length) return '<span class="muted">'+esc(empty||'none')+'</span>';
  return values.map(v=>'<code>'+esc(v)+'</code>').join(' ');
}
function memCardHtml(p, i){
  const tags = memList(p.tags, 'none');
  const files = memList(p.files, 'none');
  const commits = memList(p.sourceCommits, 'none');
  const off = !!S.memSkip[i];
  const meta = [
    '<span>id: <code>'+esc(memId(p))+'</code></span>',
    '<span>action: <code>'+esc(p.action||'create')+'</code></span>',
    '<span>type: <code>'+esc(p.type||'Concept')+'</code></span>',
    p.status ? '<span>status: <code>'+esc(p.status)+'</code></span>' : '',
    p.date ? '<span>date: <code>'+esc(p.date)+'</code></span>' : '',
  ].filter(Boolean).join('');
  return '<article class="mem-card '+(off?'off':'')+'" data-mem-card="'+i+'">'+
    '<div class="mem-head"><div><span class="mem-title">'+esc(p.title||memId(p))+'</span> '+
    '<span class="mem-state">'+(off?'Skipped':'Will apply')+'</span></div>'+
    '<button type="button" class="mem-toggle" data-mem-idx="'+i+'">'+(off?'Apply':'Skip')+'</button></div>'+
    '<div class="mem-meta">'+meta+'</div>'+
    (p.description?'<div class="mem-desc">'+esc(p.description)+'</div>':'')+
    (p.reason?'<div class="mem-reason">Why: '+esc(p.reason)+'</div>':'')+
    '<div class="mem-meta"><span>files: '+files+'</span></div>'+
    '<div class="mem-meta"><span>tags: '+tags+'</span> <span>source commits: '+commits+'</span></div>'+
    '<div class="mem-section"><div class="ml">Proposed body</div><div class="md" data-mem-body="'+i+'"></div></div>'+
    ((p.existingBody!=null)?'<div class="mem-section"><div class="ml">Current version on disk</div><div class="md" data-mem-existing="'+i+'"></div></div>':'')+
  '</article>';
}
function renderMemoryBodies(){
  if(MODE!=='commit' || !MEM.length) return;
  MEM.forEach(function(p, i){
    const body = document.querySelector('[data-mem-body="'+i+'"]');
    if(body) body.innerHTML = mdToHtml(p.body == null ? '' : p.body);
    const existing = document.querySelector('[data-mem-existing="'+i+'"]');
    if(existing) existing.innerHTML = mdToHtml(p.existingBody == null ? '' : p.existingBody);
  });
  document.querySelectorAll('.mem-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){ toggleMem(Number(btn.dataset.memIdx)); });
  });
}
function makeFI(f){
  const el = document.createElement('div');
  el.className = 'fi' + (S.active===f.name?' active':'');
  el.dataset.name = f.name;
  el.onclick = () => selectFeature(f.name);
  const cx = (f.stats&&f.stats.complexity)||'green';
  const st = S.statuses[f.name];
  const label = f.name==='__unc__' ? 'uncategorized' : f.name;
  const tb = testBadge(f);
  const pits = pitfallsOf(f);
  el.innerHTML = '<div class="dot d'+cx[0]+'"></div><div class="fm"><div class="fn">'+(pits.length?'⚠ ':'')+esc(label)+'</div>'+
    (f.stats ? '<div class="fs"><span class="sa">+'+f.stats.added+'</span> <span class="sd">-'+f.stats.removed+'</span> · '+f.stats.files+' file'+(f.stats.files!==1?'s':'')+(tb?' · '+tb:'')+'</div>' : '')+
    (st ? '<div class="sbadge s-'+(st==='approved'?'app':st==='changes'?'chg':'qst')+'">'+(st==='approved'?'Approved':st==='changes'?'Needs Changes':'Question')+'</div>' : '')+
    '</div>';
  return el;
}
function selectFeature(name){
  S.active = name;
  document.querySelectorAll('.fi').forEach(el => el.classList.toggle('active', el.dataset.name===name));
  let feat = (D.features||[]).find(f=>f.name===name);
  if(name==='__unc__') feat = { name:'__unc__', description:'Files not matched by any feature.', files: D.uncategorized||[], blastRadius:null, dependsOn:[] };
  if(!feat) return;
  const total = ((feat.stats&&feat.stats.added)||0)+((feat.stats&&feat.stats.removed)||0);
  const codeTotal = codeLines(feat, total);
  const note = S.notes[name]||'';
  const st = S.statuses[name];
  const detail = document.getElementById('detail');
  detail.innerHTML = memoryPanelHtml() +
    '<div class="fh"><div class="ftitle">'+(name==='__unc__'?'Uncategorized':esc(name))+'</div>'+
      '<div class="fdesc">'+esc(feat.description||'')+'</div>'+
      (name==='__unc__' && MODE==='commit' ? uncDispositionHtml() : '')+
      '<button class="note-btn" id="note-btn">'+(note?'Edit note':'+ Add feature note')+'</button>'+
      '<div class="note-area '+(note?'open':'')+'" id="note-area">'+
        '<textarea id="note-ta" placeholder="Note about this feature…">'+esc(note)+'</textarea>'+
        '<div class="na"><button class="ns" id="note-save">Save</button>'+
        '<button class="nc" id="note-cancel">Cancel</button></div></div></div>'+
    (codeTotal>200?'<div class="warn">⚠️ '+codeTotal+' changed code lines — exceeds the 200-line guideline (comments/docs excluded).</div>':'')+
    '<div class="meta">'+
      ((feat.dependsOn&&feat.dependsOn.length)?'<div class="mi"><div class="ml">Depends on</div><div class="mv">'+esc(feat.dependsOn.join(', '))+'</div></div>':'')+
      (feat.stats?'<div class="mi"><div class="ml">Changed</div><div class="mv"><span class="sa">+'+feat.stats.added+'</span> <span class="sd">-'+feat.stats.removed+'</span>'+
        '<span style="color:var(--text-muted)">'+(codeTotal!==total?' · '+codeTotal+' code':'')+'</span></div></div>':'')+
      (feat.stats?'<div class="mi"><div class="ml">Files</div><div class="mv">'+feat.stats.files+'</div></div>':'')+
      (testBadge(feat)?'<div class="mi"><div class="ml">Tests</div><div class="mv">'+testBadge(feat)+'</div></div>':'')+
    '</div>'+
    (feat.blastRadius?'<div class="blast"><div class="bl">⚡ Blast Radius</div>'+esc(feat.blastRadius)+'</div>':'')+
    pitfallsOf(feat).map(p =>
      '<div class="pitfall"><div class="pl">⚠ Known pitfall — '+esc(p.id)+'</div>'+
      '<strong>'+esc(p.title)+'</strong> — '+esc(p.description)+
      '<div class="pm">anchored to '+(p.matched||[]).map(m=>'<code>'+esc(m)+'</code>').join(' ')+
      ' · verify against '+esc(p.id)+'.md before approving</div></div>').join('')+
    '<div class="sbtns">'+
      '<button class="sb '+(st==='approved'?'aa':'')+'" data-st="approved">✓ Approved</button>'+
      '<button class="sb '+(st==='changes'?'ac':'')+'" data-st="changes">✗ Needs Changes</button>'+
      '<button class="sb '+(st==='question'?'aq':'')+'" data-st="question">? Question</button>'+
    '</div><div id="hunks"></div>';
  document.getElementById('note-btn').onclick = toggleNote;
  document.getElementById('note-cancel').onclick = toggleNote;
  document.getElementById('note-save').onclick = () => saveNote(name);
  detail.querySelectorAll('.sb').forEach(b => b.onclick = () => setSt(name, b.dataset.st));
  renderMemoryBodies();
  wireUncSelects();
  renderHunks(feat);
}
// Commit mode: every uncategorized file must be assigned to a feature or
// explicitly skipped before Accept — silent leftovers are the git-flow gap.
function uncDispositionHtml(){
  const files = (D.uncategorized||[]).map(f=>f.path);
  if(!files.length) return '';
  const names = (D.features||[]).map(f=>f.name).filter(n=>n!=='__unc__');
  return '<div class="uncbox"><div class="ml">These files matched no feature — decide what happens to each on commit:</div>'+
    files.map(p => {
      const cur = S.unc[p] || '';
      return '<div class="uncrow"><code>'+esc(p)+'</code><select data-unc="'+esc(p)+'">'+
        '<option value=""'+(cur===''?' selected':'')+'>— choose —</option>'+
        '<option value="skip"'+(cur==='skip'?' selected':'')+'>leave uncommitted (skip)</option>'+
        names.map(n=>'<option value="'+esc(n)+'"'+(cur===n?' selected':'')+'>commit with '+esc(n)+'</option>').join('')+
      '</select></div>';
    }).join('')+'</div>';
}
function wireUncSelects(){
  document.querySelectorAll('[data-unc]').forEach(sel => {
    sel.addEventListener('change', () => {
      if(sel.value) S.unc[sel.dataset.unc] = sel.value; else delete S.unc[sel.dataset.unc];
      refresh();
    });
  });
}
function undisposedUnc(){
  if(MODE!=='commit') return [];
  return (D.uncategorized||[]).map(f=>f.path).filter(p=>!S.unc[p]);
}
// The feature's diff split into logical sub-groups: Declared (its files),
// Tests, Incidental (auto-assigned changes outside the declared surface,
// each with a reassignable disposition), Bootstrap (pre-staged baseline).
const GROUP_ORDER = [
  ['declared','Declared \\u2014 the feature\\u2019s files'],
  ['tests','Tests'],
  ['incidental','Incidental \\u2014 changed outside the declared surface (committed with this feature by default)'],
  ['bootstrap','Pre-staged baseline \\u2014 lands as its own chore(bootstrap) commit by default'],
];
function renderHunks(feat){
  const container = document.getElementById('hunks');
  if(!feat.files||!feat.files.length){ container.innerHTML='<div class="empty"><h3>No changes</h3></div>'; return; }
  const groups = {};
  feat.files.forEach(f => { const g = f.group||'declared'; (groups[g]=groups[g]||[]).push(f); });
  const multi = Object.keys(groups).length > 1 || groups.incidental || groups.bootstrap;
  GROUP_ORDER.forEach(([g,label]) => {
    const files = groups[g]; if(!files||!files.length) return;
    if(multi && feat.name!=='__unc__'){
      const h = document.createElement('div'); h.className='sec-label'; h.style.padding='8px 0 4px';
      h.textContent = label; container.appendChild(h);
    }
    files.forEach(file => container.appendChild(fileCard(feat, file, feat.files.indexOf(file))));
  });
  // Unknown groups (old payloads): render unlabeled, unchanged.
  Object.keys(groups).filter(g => !GROUP_ORDER.some(([k])=>k===g)).forEach(g =>
    groups[g].forEach(file => container.appendChild(fileCard(feat, file, feat.files.indexOf(file)))));
}
// Disposition select for incidental/bootstrap files (commit mode): default is
// pre-selected — commit with the active feature, or the bootstrap commit.
function dispositionSelect(feat, file){
  if(MODE!=='commit' || !file.defaulted) return '';
  const names = (D.features||[]).map(f=>f.name);
  const cur = S.unc[file.path] || file.disposition || feat.name;
  return '<select data-unc="'+esc(file.path)+'" title="Where this file lands on commit">'+
    names.map(n=>'<option value="'+esc(n)+'"'+(cur===n?' selected':'')+'>commit with '+esc(n)+'</option>').join('')+
    '<option value="bootstrap"'+(cur==='bootstrap'?' selected':'')+'>chore(bootstrap) commit</option>'+
    '<option value="skip"'+(cur==='skip'?' selected':'')+'>leave uncommitted (skip)</option>'+
  '</select>';
}
function fileCard(feat, file, fi){
    const addC = (file.hunks||[]).reduce((s,h)=>s+h.lines.filter(l=>l.type==='addition').length,0);
    const delC = (file.hunks||[]).reduce((s,h)=>s+h.lines.filter(l=>l.type==='deletion').length,0);
    const card = document.createElement('div'); card.className='fc';
    card.innerHTML = '<div class="fch"><span class="fp">'+esc(file.path)+'</span><span style="display:inline-flex;gap:10px;align-items:center">'+
      dispositionSelect(feat, file)+
      '<span><span class="sa">+'+addC+'</span> <span class="sd">-'+delC+'</span></span></span></div>';
    const tbl = document.createElement('table'); tbl.className='dt';
    (file.hunks||[]).forEach((hunk, hi) => {
      const hr = document.createElement('tr'); hr.className='dl hunk-header';
      hr.innerHTML = '<td class="ln"></td><td class="ln"></td><td class="lp"></td><td class="lc">'+esc(hunk.header)+'</td><td class="ci"></td>';
      tbl.appendChild(hr);
      let on = hunk.oldStart||0, nn = hunk.newStart||0;
      hunk.lines.forEach((line, li) => {
        const id = feat.name+'|'+fi+'-'+hi+'-'+li;
        const saved = S.comments[id];
        const row = document.createElement('tr');
        row.className = 'dl ' + line.type;
        let os='', ns='';
        if(line.type==='context'){ os=on++; ns=nn++; }
        else if(line.type==='deletion'){ os=on++; }
        else if(line.type==='addition'){ ns=nn++; }
        const px = line.type==='addition'?'+':line.type==='deletion'?'-':' ';
        row.innerHTML = '<td class="ln">'+os+'</td><td class="ln">'+ns+'</td><td class="lp">'+px+'</td><td class="lc">'+esc(line.content)+'</td><td class="ci">'+(saved?'💬':'')+'</td>';
        tbl.appendChild(row);
        const cr = document.createElement('tr'); cr.className='cr';
        cr.innerHTML = '<td colspan="5" class="cc"><textarea placeholder="Add comment…">'+esc(saved?saved.comment:'')+'</textarea><div class="ca"><button class="cs">Save</button><button class="cc2">Cancel</button></div></td>';
        const ta = cr.querySelector('textarea');
        cr.querySelector('.cs').onclick = () => saveComment(id, feat, file.path, line, ta.value);
        cr.querySelector('.cc2').onclick = () => { cr.classList.remove('open'); row.classList.remove('sel'); };
        row.onclick = () => toggleComment(row, cr, ta);
        tbl.appendChild(cr);
      });
    });
    card.appendChild(tbl);
    // Reassignable disposition (incidental/bootstrap files, commit mode).
    const sel = card.querySelector('[data-unc]');
    if(sel) sel.addEventListener('change', () => { S.unc[sel.dataset.unc] = sel.value; });
    return card;
}
// pitfall concepts anchored to this feature's changed files ('' for old payloads);
// uncategorized files use the payload's top-level pitfalls
function pitfallsOf(f){
  if(f && f.name==='__unc__') return D.pitfalls || [];
  return (f && f.pitfalls) || [];
}
// changed CODE lines (comments/docs excluded); falls back to the raw total
// for payloads gathered before codeAdded/codeRemoved existed
function codeLines(f, total){
  const s = f && f.stats;
  if(!s || s.codeAdded==null) return total;
  return (s.codeAdded||0)+(s.codeRemoved||0);
}
// tests badge text, or '' when the feature has no tests (old payloads render unchanged)
function testBadge(f){
  const t = f && f.tests;
  if(!t || !t.status || t.status==='none') return '';
  const dot = '<i class="sdot '+(t.status==='green'?'g':'r')+'"></i>';
  return dot + (t.passing!=null && t.total!=null ? t.passing+'/'+t.total+' passing' : 'tests '+t.status);
}
function toggleNote(){ const el=document.getElementById('note-area'); if(el) el.classList.toggle('open'); }
function saveNote(name){ S.notes[name] = (document.getElementById('note-ta')||{}).value||''; updateFb(); renderSidebar(); selectFeature(name); }
function setSt(name, val){ S.statuses[name] = S.statuses[name]===val ? null : val; renderSidebar(); selectFeature(name); updateFb(); }
function toggleComment(row, cr, ta){
  const wasOpen = cr.classList.contains('open');
  document.querySelectorAll('.cr.open').forEach(r=>r.classList.remove('open'));
  document.querySelectorAll('.dl.sel').forEach(r=>r.classList.remove('sel'));
  if(!wasOpen){ cr.classList.add('open'); row.classList.add('sel'); ta.focus(); }
}
function saveComment(id, feat, path, line, val){
  const t = (val||'').trim();
  if(t) S.comments[id] = { feature: feat.name==='__unc__'?'uncategorized':feat.name,
    file: path, content: (line.content||'').trim(), type: line.type, comment: t };
  else delete S.comments[id];
  updateFb(); selectFeature(S.active);
}

function buildFeedbackObj(){
  const features = [];
  const allNames = [...(D.features||[]).map(f=>f.name), (D.uncategorized&&D.uncategorized.length?'__unc__':null)].filter(Boolean);
  allNames.forEach(name => {
    const st = S.statuses[name], note = S.notes[name];
    if(st || note) features.push({ name: name==='__unc__'?'uncategorized':name, status: st||null, note: note||null });
  });
  const lineComments = Object.values(S.comments).map(c =>
    ({ feature: c.feature, file: c.file, content: c.content, type: c.type, comment: c.comment }));
  return { type:'review-feedback', branch: D.branch||'HEAD', features, lineComments };
}
function updateFb(){
  const obj = buildFeedbackObj();
  const count = obj.features.length + obj.lineComments.length;
  const fbo = document.getElementById('fbo'); const fbc = document.getElementById('fbc');
  if(!count){ fbo.innerHTML='<span class="fbe">Add comments or mark features to generate feedback…</span>'; fbc.classList.remove('vis'); }
  else {
    fbo.textContent = JSON.stringify(obj, null, 2);
    fbc.textContent = count; fbc.classList.add('vis');
    document.getElementById('fbpanel').classList.remove('col');
    document.getElementById('fbtog').textContent = '▼ collapse';
  }
  refresh();
}
function toggleFb(){ const p=document.getElementById('fbpanel'); const t=document.getElementById('fbtog'); p.classList.toggle('col'); t.textContent = p.classList.contains('col')?'▲ expand':'▼ collapse'; }

function hasChanges(){ const o=buildFeedbackObj(); return o.features.length>0 || o.lineComments.length>0; }
function onPrimary(){
  if(MODE==='commit' && !hasChanges()){
    const missing = undisposedUnc();
    if(missing.length){
      selectFeature('__unc__');
      alert('Decide what happens to each uncategorized file before committing:\\n' + missing.join('\\n'));
      return;
    }
    const names = (D.features||[]).map(f=>f.name);
    const out = { type:'accept-commit', branch: D.branch||'HEAD', feature: names[0], features: names };
    const unc = Object.entries(S.unc).map(([path, feature]) => ({ path, feature }));
    if(unc.length) out.uncategorized = unc;
    if(MEM.length) out.memory = memDecisions();
    post(out, 'Accepted — Claude is committing');
    return;
  }
  post(buildFeedbackObj(), 'Review sent to Claude');
}
`;

export function render(data) {
	const commitMode = data.mode === "commit";
	return renderPage({
		step: "review",
		subtitle: commitMode ? "/ implement" : "/ review",
		branch: data.branch,
		title: data.plan,
		data,
		css: DIFF_CSS + CSS,
		body: BODY,
		clientJs: JS,
		primaryIdle: commitMode ? "Accept and commit" : "Accept",
		primaryChanged: "Send review",
	});
}
