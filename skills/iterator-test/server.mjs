#!/usr/bin/env node
/**
 * iterator-test: test-plan UI on the shared shell (../../lib/ui.mjs,
 * ../../lib/server.mjs). Proposes a set of test cases for a chunk before any
 * test file is written; the user tweaks/comments/accepts.
 *
 *   input:  { step:"test", branch, chunk:{name,description}, runner,
 *             cases:[ {title,kind,rationale} ] }   // kind: happy | edge | integration
 *   output: one JSON line to stdout —
 *     { type:"test-approved", branch, chunk, cases:[ {title,kind,rationale,include} ] }
 *     { type:"test-feedback", branch, chunk, cases:[ {title,kind,rationale,include,comment} ], comment }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { readPayload, serve } from '../../lib/server.mjs';
import { renderPage } from '../../lib/ui.mjs';

const CSS = `
.main{max-width:820px;margin:0 auto;padding:24px 20px}
h1{font-size:20px;font-weight:600;margin-bottom:6px}
.desc{font-size:14px;color:var(--text-muted);margin-bottom:8px;line-height:1.5}
.runner{font-size:12px;color:var(--text-muted);margin-bottom:20px}
.runner code{background:var(--code-bg);border-radius:4px;padding:1px 6px;font-family:ui-monospace,Menlo,monospace}
.hint{font-size:13px;color:var(--text-muted);margin-bottom:20px;line-height:1.5}
.case{background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;padding:12px 14px}
.case.excluded{opacity:.5}
.ch{display:flex;align-items:center;gap:10px}
.ch input[type=checkbox]{width:15px;height:15px;accent-color:var(--accent);cursor:pointer}
.ctitle{font-size:14px;font-weight:600;flex:1;border:1px solid transparent;border-radius:3px;padding:1px 4px;background:none;color:var(--text);font-family:inherit}
.ctitle:hover{border-color:var(--border)}
.ctitle:focus{border-color:var(--accent);outline:none}
.kind{font-size:11px;border-radius:10px;padding:2px 8px;text-transform:capitalize}
.k-happy{background:var(--bg-green);color:var(--dot-green)}
.k-edge{background:var(--bg-yellow);color:var(--dot-yellow)}
.k-integration{background:var(--hunk-bg);color:var(--hunk-fg)}
.crat{font-size:13px;color:var(--text-muted);margin:8px 0 0;line-height:1.5}
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
  <p class="hint">These are the test cases Claude proposes for this chunk. Untick any you don't want, edit a title, or leave a comment. Click <strong>Accept</strong> to have Claude write and run them; add a comment and it becomes <strong>Send review</strong> to revise the plan first.</p>
  <div id="cases"></div>
  <div class="comment-section">
    <span class="slabel">Overall comment (optional)</span>
    <textarea class="gcmt" id="global-comment" placeholder="Any overall guidance for the test plan…" oninput="refresh()"></textarea>
  </div>
</div>
`;

const JS = `
const chunk = D.chunk || {};
const ORIG = JSON.parse(JSON.stringify(D.cases || []));
const state = (D.cases || []).map(c => ({ title:c.title||'', kind:c.kind||'happy', rationale:c.rationale||'', include:true, comment:'' }));

document.getElementById('title').textContent = 'Test plan — ' + (chunk.name || 'chunk');
document.getElementById('desc').textContent = chunk.description || '';
if(D.runner) document.getElementById('runner').innerHTML = 'Runner: <code>'+esc(D.runner)+'</code>';
renderCases();
refresh();

function renderCases(){
  const wrap = document.getElementById('cases');
  wrap.innerHTML = '';
  if(!state.length){ wrap.innerHTML = '<div class="empty">No cases proposed.</div>'; return; }
  state.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'case' + (c.include?'':' excluded');
    const kind = ['happy','edge','integration'].includes(c.kind)?c.kind:'happy';
    div.innerHTML =
      '<div class="ch">'+
        '<input type="checkbox" '+(c.include?'checked':'')+' onchange="toggleCase('+i+',this.checked)">'+
        '<input class="ctitle" value="'+esc(c.title)+'" onblur="editTitle('+i+',this.value)" onkeydown="if(event.key===\\'Enter\\')this.blur()">'+
        '<span class="kind k-'+kind+'">'+kind+'</span>'+
      '</div>'+
      (c.rationale?'<div class="crat">'+esc(c.rationale)+'</div>':'')+
      '<textarea class="ccmt" placeholder="Comment on this case…" oninput="editComment('+i+',this.value)">'+esc(c.comment)+'</textarea>';
    wrap.appendChild(div);
  });
}
function toggleCase(i,val){ state[i].include=val; renderCases(); refresh(); }
function editTitle(i,val){ state[i].title=val.trim(); refresh(); }
function editComment(i,val){ state[i].comment=val; refresh(); }

function hasChanges(){
  if(document.getElementById('global-comment').value.trim()) return true;
  if(state.some(c=>c.comment.trim())) return true;
  if(state.some((c,i)=>!c.include || c.title!==(ORIG[i]&&ORIG[i].title))) return true;
  return false;
}
function onPrimary(){
  const changed = hasChanges();
  const comment = document.getElementById('global-comment').value.trim();
  if(changed){
    post({ type:'test-feedback', branch:D.branch||'HEAD', chunk:chunk.name,
      cases: state.map(c=>({title:c.title,kind:c.kind,rationale:c.rationale,include:c.include,comment:c.comment.trim()})),
      comment }, 'Sent — Claude is revising the test plan');
  } else {
    post({ type:'test-approved', branch:D.branch||'HEAD', chunk:chunk.name,
      cases: state.filter(c=>c.include).map(c=>({title:c.title,kind:c.kind,rationale:c.rationale,include:true})) },
      'Accepted — Claude is writing tests');
  }
}
`;

const data = await readPayload();
const html = renderPage({
  step: 'test', subtitle: '/ test', branch: data.branch, title: (data.chunk && data.chunk.name),
  data, css: CSS, body: BODY, clientJs: JS,
  primaryIdle: 'Accept', primaryChanged: 'Send review',
});
serve({ step: 'test', html });
