/**
 * iterator-plan: plan-review UI on the shared shell (../ui.mjs,
 * ../server.mjs). Reads a JSON payload from stdin, renders the page, and
 * serves it until the user submits.
 *
 *   input:  { step:"plan", branch, title, plan:{goal,architecture,keyDecisions,productFit}, dependencies:[] }
 *   output: one JSON line to stdout —
 *     { type:"plan-approved"|"plan-feedback", sections, dependencies, comments, comment }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from '../ui.mjs';

const PLAN_CSS = `
.main{max-width:760px;margin:0 auto;padding:28px 20px}
h1{font-size:20px;font-weight:600;margin-bottom:6px}
.hint{font-size:13px;color:var(--text-muted);margin-bottom:28px;line-height:1.5}
.section{margin-bottom:20px}
.shead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.slabel{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.cmt-btn{background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);
  cursor:pointer;font-size:12px;padding:2px 8px;display:inline-flex;align-items:center;gap:5px;line-height:1}
.cmt-btn:hover{color:var(--text);border-color:var(--text-muted)}
.cmt-btn .badge{background:var(--accent);color:#fff;border-radius:8px;padding:0 6px;font-size:10px;font-weight:600}
.sbody{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px 14px;
  font-size:14px;line-height:1.6;color:var(--text);min-height:48px;cursor:text;word-break:break-word}
.sbody:hover{border-color:var(--text-muted)}
textarea.seditor{width:100%;padding:12px 14px;background:var(--surface);border:1px solid var(--accent);
  border-radius:6px;color:var(--text);font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  resize:vertical;min-height:120px;outline:none;line-height:1.5}
.deps-panel{margin-bottom:20px}
.dep-chips{display:flex;flex-wrap:wrap;gap:8px;background:var(--surface);border:1px solid var(--border);
  border-radius:6px;padding:12px 14px;align-items:center}
.dchip{display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);
  border-radius:12px;padding:3px 6px 3px 10px;font-size:12px;color:var(--accent)}
.dchip button{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1;padding:0 2px}
.dchip button:hover{color:var(--del-fg)}
input.dadd{flex:1;min-width:160px;background:none;border:none;outline:none;color:var(--text);
  font-size:13px;font-family:inherit;padding:4px}
input.dadd::placeholder{color:var(--text-muted)}
.comment-section{margin-top:32px;padding-top:24px;border-top:1px solid var(--border)}
.comment-section .slabel{margin-bottom:8px}
textarea.comment-box{width:100%;padding:10px 12px;background:var(--surface);border:1px solid var(--border);
  border-radius:6px;color:var(--text);font-size:13px;font-family:inherit;resize:vertical;min-height:80px;
  outline:none;line-height:1.5}
textarea.comment-box:focus{border-color:var(--accent)}
textarea.comment-box:hover:not(:focus){border-color:var(--text-muted)}
.cscrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:150;opacity:0;pointer-events:none;transition:opacity .2s}
.cscrim.open{opacity:1;pointer-events:auto}
.cpanel{position:fixed;top:0;right:0;width:360px;max-width:90vw;height:100vh;background:var(--fb-bg);
  border-left:1px solid var(--border);z-index:200;transform:translateX(100%);transition:transform .2s;
  display:flex;flex-direction:column}
.cpanel.open{transform:none}
.cph{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
.cph .ct{font-size:14px;font-weight:600}
.cph .cs{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.cph button{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px}
.cpbody{flex:1;overflow-y:auto;padding:12px 16px}
.cpitem{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 10px;
  margin-bottom:8px;font-size:13px;line-height:1.5;display:flex;justify-content:space-between;gap:8px}
.cpitem button{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;flex-shrink:0}
.cpitem button:hover{color:var(--del-fg)}
.cp-empty{color:var(--text-muted);font-style:italic;font-size:13px;padding:8px 0}
.cpadd{padding:12px 16px;border-top:1px solid var(--border)}
.cpadd textarea{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;
  color:var(--text);font-size:13px;font-family:inherit;resize:vertical;min-height:70px;outline:none;padding:8px 10px;line-height:1.5}
.cpadd textarea:focus{border-color:var(--accent)}
.cpadd button{margin-top:8px;width:100%;padding:8px;background:var(--accent);color:#fff;border:none;
  border-radius:6px;font-size:13px;cursor:pointer;font-weight:500}
.cpadd button:hover{opacity:.9}
`;

const PLAN_BODY = `
<div class="main">
  <h1 id="title"></h1>
  <p class="hint">Each section is rendered markdown — <strong>click any section to edit</strong> (save with blur or ⌘/Ctrl+Enter). Use the 💬 icon to leave a comment on a section, and confirm the <strong>dependencies</strong> below. When everything looks right click <strong>Accept</strong>; if you edit anything or add a comment the button becomes <strong>Send review</strong> so Claude can revise first.</p>
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
    <div><div class="cs">Comment thread</div><div class="ct" id="cp-title">Section</div></div>
    <button onclick="closeComments()" title="Close">✕</button>
  </div>
  <div class="cpbody" id="cp-body"></div>
  <div class="cpadd">
    <textarea id="cp-input" placeholder="Add a comment for Claude about this section…"
      onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();addComment()}"></textarea>
    <button onclick="addComment()">Add comment</button>
  </div>
</aside>
`;

const PLAN_JS = `
const SECTION_KEYS = ['goal','architecture','keyDecisions','productFit'];
const SECTION_LABELS = {goal:'Goal',architecture:'Architecture',keyDecisions:'Key Decisions',productFit:'Product Fit'};
const sections = {};
SECTION_KEYS.forEach(k => sections[k] = (D.plan && D.plan[k]) || '');
const ORIG_SECTIONS = JSON.stringify(sections);
let deps = Array.isArray(D.dependencies) ? D.dependencies.slice() : [];
const ORIG_DEPS = JSON.stringify(deps);
const comments = {};
SECTION_KEYS.forEach(k => comments[k] = []);
let activeKey = null;

document.getElementById('title').textContent = D.title || 'Plan Review';
renderSections();
renderDeps();
refresh();

function renderSections(){
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
      '<div class="sbody md" data-key="'+key+'" onclick="editSection(\\''+key+'\\')">'+mdToHtml(sections[key])+'</div>';
    container.appendChild(div);
  });
}
function editSection(key){
  const body = document.querySelector('.sbody[data-key="'+key+'"]');
  if(!body) return;
  const ta = document.createElement('textarea');
  ta.className = 'seditor';
  ta.value = sections[key] || '';
  ta.addEventListener('blur', () => saveSection(key, ta.value));
  ta.addEventListener('keydown', e => { if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); ta.blur(); } });
  body.replaceWith(ta);
  ta.focus();
  const v = ta.value; ta.value=''; ta.value=v;
}
function saveSection(key, val){ sections[key] = val.trim(); renderSections(); refresh(); }

function renderDeps(){
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
  input.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); addDep(input.value); input.value=''; } });
  el.appendChild(input);
}
function addDep(val){ val=(val||'').trim(); if(!val) return; deps.push(val); renderDeps(); refresh(); }
function removeDep(i){ deps.splice(i,1); renderDeps(); refresh(); }

function openComments(key){
  activeKey = key;
  document.getElementById('cp-title').textContent = SECTION_LABELS[key];
  renderComments();
  document.getElementById('cscrim').classList.add('open');
  document.getElementById('cpanel').classList.add('open');
  document.getElementById('cp-input').focus();
}
function closeComments(){
  activeKey = null;
  document.getElementById('cscrim').classList.remove('open');
  document.getElementById('cpanel').classList.remove('open');
}
function renderComments(){
  const body = document.getElementById('cp-body');
  const list = comments[activeKey] || [];
  if(!list.length){ body.innerHTML = '<div class="cp-empty">No comments yet. Add one below.</div>'; return; }
  body.innerHTML = list.map((c,i) => '<div class="cpitem"><span>'+esc(c)+'</span><button title="Delete" onclick="deleteComment('+i+')">×</button></div>').join('');
}
function addComment(){
  const input = document.getElementById('cp-input');
  const val = input.value.trim();
  if(!val || !activeKey) return;
  comments[activeKey].push(val);
  input.value = '';
  renderComments(); renderSections(); refresh();
}
function deleteComment(i){ comments[activeKey].splice(i,1); renderComments(); renderSections(); refresh(); }
function collectComments(){ const out=[]; SECTION_KEYS.forEach(k => comments[k].forEach(text => out.push({section:k, text}))); return out; }

function hasChanges(){
  if(document.getElementById('global-comment').value.trim()) return true;
  if(collectComments().length) return true;
  if(JSON.stringify(sections) !== ORIG_SECTIONS) return true;
  if(JSON.stringify(deps) !== ORIG_DEPS) return true;
  return false;
}
function onPrimary(){
  const changed = hasChanges();
  post({
    type: changed ? 'plan-feedback' : 'plan-approved',
    branch: D.branch || 'HEAD',
    sections: {...sections},
    dependencies: deps,
    comments: collectComments(),
    comment: document.getElementById('global-comment').value.trim(),
  }, changed ? 'Review sent to Claude' : 'Plan approved');
}
`;

export function render(data) {
  return renderPage({
    step: 'plan', subtitle: '/ plan review', branch: data.branch, title: data.title,
    data, css: PLAN_CSS, body: PLAN_BODY, clientJs: PLAN_JS,
    primaryIdle: 'Accept', primaryChanged: 'Send review',
  });
}
