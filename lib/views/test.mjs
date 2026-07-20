/**
 * iterator-test: test-plan UI on the shared shell (../ui.mjs,
 * ../server.mjs). Proposes a set of test cases for a feature before any
 * test file is written; the user tweaks/comments/accepts.
 *
 *   input:  { step:"test", branch, feature:{name,description}, runner,
 *             mode,                                // "red" (feature pending) | "green" (feature done)
 *             cases:[ {id,title,kind,rationale,path,code} ],
 *             draftFiles:[ {path,content} ] }      // exact red-mode files; additive for green mode
 *   output: one JSON line to stdout —
 *     { type:"test-approved", branch, feature, cases:[...], draftFiles:[...] }
 *     { type:"test-feedback", branch, feature, cases:[...], draftFiles:[...], comment }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from "../ui.mjs";

const CSS = `
.main{max-width:820px;margin:0 auto;padding:24px var(--sp-5)}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:6px}
.desc{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:8px;line-height:1.5}
.runner{font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:8px}
.mode{font-size:var(--fs-sm);line-height:1.5;border-radius:var(--radius-sm);padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-5);display:none}
.mode.red{display:block;background:var(--bg-red);color:var(--dot-red)}
.mode.green{display:block;background:var(--bg-green);color:var(--dot-green)}
.runner code{background:var(--code-bg);border-radius:4px;padding:1px 6px;font-family:var(--font-mono)}
.hint{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:var(--sp-5);line-height:1.5}
.case{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);margin-bottom:var(--sp-3);padding:var(--sp-3) 14px}
.case.excluded{opacity:.5}
.ch{display:flex;align-items:center;gap:10px}
.ch input[type=checkbox]{width:15px;height:15px;accent-color:var(--accent);cursor:pointer}
.ctitle{font-size:var(--fs-sm);font-weight:600;flex:1;border:1px solid transparent;border-radius:3px;padding:1px 4px;background:none;color:var(--text);font-family:inherit}
.ctitle:hover{border-color:var(--border)}
.ctitle:focus{border-color:var(--accent);outline:none}
.kind{font-size:var(--fs-xs);font-family:var(--font-mono);border-radius:10px;padding:2px var(--sp-2);text-transform:uppercase;letter-spacing:.05em}
.k-happy{background:var(--bg-green);color:var(--dot-green)}
.k-edge{background:var(--bg-yellow);color:var(--dot-yellow)}
.k-integration{background:var(--hunk-bg);color:var(--hunk-fg)}
.crat{font-size:var(--fs-sm);color:var(--text-muted);margin:8px 0 0;line-height:1.5}
.source-meta,.file-meta{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);margin-top:var(--sp-3);font:var(--fs-xs)/1.4 var(--font-mono);color:var(--text-muted)}
.source-meta span,.file-meta span{text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.source-meta code,.file-meta code{color:var(--text);overflow-wrap:anywhere;text-align:right}
.source-code,.file-code{margin:var(--sp-2) 0 0;background:var(--code-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-3);overflow:auto;max-height:360px;font:var(--fs-xs)/1.55 var(--font-mono);color:var(--text)}
.source-code code,.file-code code{white-space:pre}
.files{margin-top:var(--sp-5)}
.file{margin-bottom:var(--sp-3)}
.source-warning{display:none;background:var(--bg-yellow);color:var(--dot-yellow);border-radius:var(--radius-sm);padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-4);font-size:var(--fs-sm)}
.source-warning.visible{display:block}
.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px}
textarea.ccmt{width:100%;margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;
  color:var(--text);font-size:12px;font-family:inherit;resize:vertical;min-height:44px;outline:none;padding:8px 10px;line-height:1.5}
textarea.ccmt:focus{border-color:var(--accent)}
.comment-section{margin-top:28px;padding-top:20px;border-top:1px solid var(--border)}
.slabel{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px;display:block}
textarea.gcmt{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);
  font-size:13px;font-family:inherit;resize:vertical;min-height:70px;outline:none;padding:10px 12px;line-height:1.5}
textarea.gcmt:focus{border-color:var(--accent)}
`;

const BODY = `
<div class="main">
  <h1 id="title"></h1>
  <div class="desc" id="desc"></div>
  <div class="runner" id="runner"></div>
  <div class="mode" id="mode"></div>
  <p class="hint" id="hint"></p>
  <div class="source-warning" id="source-warning">Exact red-test source is incomplete. Every included case must map to code inside a proposed file before this plan can be accepted.</div>
  <div id="cases"></div>
  <section class="files" id="draft-files" hidden>
    <span class="slabel">Complete proposed test files</span>
    <div id="file-list"></div>
  </section>
  <div class="comment-section">
    <span class="slabel">Overall comment (optional)</span>
    <textarea class="gcmt" id="global-comment" placeholder="Any overall guidance for the test plan…" oninput="refresh();refreshSourceGate()"></textarea>
  </div>
</div>
`;

const JS = `
const feature = D.feature || {};
const ORIG = JSON.parse(JSON.stringify(D.cases || []));
const state = (D.cases || []).map((c,i) => ({
  id:String(c.id||('case-'+(i+1))), title:c.title||'', kind:c.kind||'happy', rationale:c.rationale||'',
  path:c.path||'', code:c.code||'', include:c.include!==false, comment:c.comment||''
}));
const draftFiles = (D.draftFiles || []).map(f => ({ path:String(f.path||''), content:String(f.content||'') }));

document.getElementById('title').textContent = 'Test plan — ' + (feature.name || 'feature');
document.getElementById('desc').textContent = feature.description || '';
if(D.runner) document.getElementById('runner').innerHTML = 'Runner: <code>'+esc(D.runner)+'</code>';
const modeEl = document.getElementById('mode');
const hintEl = document.getElementById('hint');
if(D.mode==='red'){
  modeEl.className='mode red';
  modeEl.innerHTML='<i class="sdot"></i><strong>Red mode</strong> — this feature is not implemented yet. The exact reviewed files are <em>expected to fail</em> until /iterator-implement turns them green.';
  hintEl.innerHTML='Verify the real source for every test and the complete proposed files below. Untick a case or leave feedback to have the Agent revise the source. <strong>Accept</strong> writes this exact reviewed content without regenerating it.';
}else if(D.mode==='green'){
  modeEl.className='mode green';
  modeEl.innerHTML='<i class="sdot"></i><strong>Green mode</strong> — this feature is implemented; accepted tests must pass against the current code.';
  hintEl.innerHTML='These are the test cases the Agent proposes for this feature. Untick any you do not want, edit a title, or leave a comment. <strong>Accept</strong> writes and runs them; feedback asks the Agent to revise the plan first.';
}
renderCases();
renderDraftFiles();
refresh();
refreshSourceGate();

function renderCases(){
  const wrap = document.getElementById('cases');
  wrap.innerHTML = '';
  if(!state.length){ wrap.innerHTML = '<div class="empty">No cases proposed.</div>'; return; }
  state.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'case' + (c.include?'':' excluded');
    const kind = ['happy','edge','integration'].includes(c.kind)?c.kind:'happy';
    const source = D.mode==='red'
      ? '<div class="source-meta"><span>Test source</span><code>'+esc(c.path)+'</code></div><pre class="source-code"><code>'+esc(c.code)+'</code></pre>'
      : '';
    div.innerHTML =
      '<div class="ch">'+
        '<input type="checkbox" '+(c.include?'checked':'')+' onchange="toggleCase('+i+',this.checked)">'+
        '<input class="ctitle" value="'+esc(c.title)+'" onblur="editTitle('+i+',this.value)" onkeydown="if(event.key===\\'Enter\\')this.blur()">'+
        '<span class="kind k-'+kind+'">'+kind+'</span>'+
      '</div>'+
      (c.rationale?'<div class="crat">'+esc(c.rationale)+'</div>':'')+
      source+
      '<textarea class="ccmt" placeholder="Comment on this case…" oninput="editComment('+i+',this.value)">'+esc(c.comment)+'</textarea>';
    wrap.appendChild(div);
  });
}
function renderDraftFiles(){
  const section = document.getElementById('draft-files');
  if(D.mode!=='red'){ section.hidden=true; return; }
  section.hidden=false;
  const wrap = document.getElementById('file-list');
  wrap.innerHTML = draftFiles.length ? '' : '<div class="empty">No exact files proposed.</div>';
  draftFiles.forEach(f => {
    const div = document.createElement('div');
    div.className='file';
    div.innerHTML='<div class="file-meta"><span>Proposed file</span><code>'+esc(f.path)+'</code></div><pre class="file-code"><code>'+esc(f.content)+'</code></pre>';
    wrap.appendChild(div);
  });
}
function sourceReady(){
  if(D.mode!=='red') return true;
  const included = state.filter(c=>c.include);
  if(!included.length) return false;
  return draftFiles.length>0 && included.every(c=>
    c.path && c.code && draftFiles.some(f=>f.path===c.path && f.content.includes(c.code))
  );
}
function refreshSourceGate(){
  const ready=sourceReady();
  document.getElementById('source-warning').className='source-warning'+(ready?'':' visible');
  const btn=document.getElementById('primary');
  if(btn) btn.disabled=!(ready||hasChanges());
}
function toggleCase(i,val){ state[i].include=val; renderCases(); refresh(); refreshSourceGate(); }
function editTitle(i,val){ state[i].title=val.trim(); refresh(); refreshSourceGate(); }
function editComment(i,val){ state[i].comment=val; refresh(); refreshSourceGate(); }

function hasChanges(){
  if(document.getElementById('global-comment').value.trim()) return true;
  if(state.some(c=>c.comment.trim())) return true;
  if(state.some((c,i)=>!c.include || c.title!==(ORIG[i]&&ORIG[i].title))) return true;
  return false;
}
function casePayload(c, withComment){
  const out={id:c.id,title:c.title,kind:c.kind,rationale:c.rationale,path:c.path,code:c.code,include:c.include};
  if(withComment) out.comment=c.comment.trim();
  return out;
}
function onPrimary(){
  const changed = hasChanges();
  if(!sourceReady() && !changed){
    alert('Exact red-test source is incomplete. Ask the Agent to revise the proposal.');
    return;
  }
  const comment = document.getElementById('global-comment').value.trim();
  const reviewedFiles=draftFiles.map(f=>({path:f.path,content:f.content}));
  if(changed){
    post({ type:'test-feedback', branch:D.branch||'HEAD', feature:feature.name,
      cases: state.map(c=>casePayload(c,true)), draftFiles:reviewedFiles,
      comment }, 'Sent — Agent is revising the test plan');
  } else {
    post({ type:'test-approved', branch:D.branch||'HEAD', feature:feature.name,
      cases: state.filter(c=>c.include).map(c=>casePayload(c,false)), draftFiles:reviewedFiles },
      'Accepted — Agent is writing reviewed tests');
  }
}
`;

export function render(data) {
	return renderPage({
		step: "test",
		subtitle: "/ test",
		branch: data.branch,
		title: data.feature && data.feature.name,
		data,
		css: CSS,
		body: BODY,
		clientJs: JS,
		primaryIdle: "Accept",
		primaryChanged: "Send review",
	});
}
