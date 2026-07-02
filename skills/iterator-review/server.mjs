#!/usr/bin/env node
/**
 * iterator-review: chunk-grouped diff review UI on the shared shell.
 *
 * Input:  { branch, commit, plan, progress, hasChunksFile, mode, chunks:[{name,description,
 *           blastRadius,dependsOn,stats,files:[{path,hunks}]}], uncategorized:[] }
 *   mode:"review" (default) — standalone review; primary Accept / Send review.
 *   mode:"commit"           — driven by /iterator-implement to review the just-built
 *                             chunk; primary Accept and commit / Send review.
 * Output: { type:"review-feedback", branch, features:[{name,status,note}], lineComments:[...] }
 *         or (commit mode, no changes) { type:"accept-commit", branch, chunk }
 *         plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { readPayload, serve } from '../../lib/server.mjs';
import { renderPage } from '../../lib/ui.mjs';

const CSS = `
body{height:100vh;overflow:hidden;display:flex;flex-direction:column}
.main{display:flex;flex:1;overflow:hidden}
.sidebar{width:230px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;background:var(--surface);padding:8px 0}
.sec-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:8px 12px 4px}
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
.detail{flex:1;overflow-y:auto;padding:20px;padding-bottom:130px}
.fh{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)}
.ftitle{font-size:18px;font-weight:600;margin-bottom:6px}
.fdesc{color:var(--text-muted);font-size:14px;margin-bottom:12px}
button.note-btn{font-size:12px;background:none;border:1px dashed var(--border);color:var(--text-muted);border-radius:4px;padding:3px 8px;cursor:pointer}
button.note-btn:hover{border-color:var(--accent);color:var(--accent)}
.note-area{display:none;margin-top:8px}
.note-area.open{display:block}
.note-area textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:8px;font-size:13px;resize:vertical;min-height:60px}
.na{margin-top:4px;display:flex;gap:6px}
button.ns,button.nc{font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.ns{background:var(--accent);border-color:var(--accent);color:#fff}
.meta{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
.mi{display:flex;flex-direction:column;gap:2px}
.ml{font-size:11px;text-transform:uppercase;color:var(--text-muted)}
.mv{font-size:13px}
.blast{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--dot-yellow);
  border-radius:4px;padding:10px 12px;margin-bottom:20px;font-size:13px;line-height:1.5}
.bl{font-size:11px;text-transform:uppercase;color:var(--dot-yellow);margin-bottom:4px;letter-spacing:.05em}
.sbtns{display:flex;gap:6px;margin-bottom:20px}
button.sb{font-size:12px;padding:4px 12px;border-radius:4px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.sb:hover{opacity:.8}
button.sb.aa{background:var(--bg-green);border-color:var(--dot-green);color:var(--dot-green)}
button.sb.ac{background:var(--bg-red);border-color:var(--dot-red);color:var(--dot-red)}
button.sb.aq{background:var(--bg-yellow);border-color:var(--dot-yellow);color:var(--dot-yellow)}
.warn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:4px;padding:8px 12px;font-size:13px;color:var(--dot-red);margin-bottom:16px}
.fc{background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:16px;overflow:hidden}
.fch{padding:8px 12px;background:var(--bg);border-bottom:1px solid var(--border);font-family:monospace;
  font-size:12px;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between}
.fp{color:var(--text)}
table.dt{width:100%;border-collapse:collapse;font-family:monospace;font-size:12px;line-height:1.5}
tr.dl{cursor:pointer}
tr.dl:hover td{filter:brightness(1.15)}
tr.dl.sel td{outline:1px solid var(--accent)}
td.ln{width:40px;text-align:right;padding:0 8px;color:var(--text-muted);user-select:none}
td.lp{width:16px;text-align:center;user-select:none}
td.lc{padding:0 8px;white-space:pre-wrap;word-break:break-all}
td.ci{width:20px;text-align:center;user-select:none;color:var(--accent)}
tr.dl.addition td{background:var(--add-bg);color:var(--add-fg)}
tr.dl.deletion td{background:var(--del-bg);color:var(--del-fg)}
tr.dl.hunk-header td{background:var(--hunk-bg);color:var(--hunk-fg)}
tr.dl.context td{color:var(--text-code)}
tr.cr{display:none}
tr.cr.open{display:table-row}
td.cc{padding:6px 8px 6px 56px;background:var(--bg)}
td.cc textarea{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:4px;
  color:var(--text);padding:6px 8px;font-size:12px;font-family:-apple-system,sans-serif;resize:vertical;min-height:48px}
.ca{display:flex;gap:6px;margin-top:4px}
button.cs,button.cc2{font-size:11px;padding:2px 8px;border-radius:3px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.cs{background:var(--accent);border-color:var(--accent);color:#fff}
.empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.empty h3{font-size:16px;margin-bottom:8px}
.fb{position:fixed;bottom:0;right:0;width:400px;background:var(--fb-bg);border-top:1px solid var(--border);
  border-left:1px solid var(--border);border-radius:8px 0 0 0;z-index:100;transition:transform .2s}
.fb.col{transform:translateY(calc(100% - 36px))}
.fbh{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;user-select:none}
.fbt{font-size:13px;font-weight:500}
.fbc{font-size:11px;background:var(--accent);color:#fff;border-radius:10px;padding:1px 7px;display:none}
.fbc.vis{display:inline}
.fbtog{font-size:11px;color:var(--text-muted)}
.fbb{padding:0 12px 12px}
.fbo{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;font-family:monospace;
  font-size:11px;color:var(--text);max-height:160px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;min-height:48px}
.fbe{color:var(--text-muted);font-style:italic}
.fbhint{margin-top:8px;font-size:11px;color:var(--text-muted)}
`;

const BODY = `
<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="detail" id="detail"><div class="empty"><h3>Select a chunk to review</h3></div></div>
</div>
<div class="fb col" id="fbpanel">
  <div class="fbh" onclick="toggleFb()">
    <div style="display:flex;align-items:center;gap:8px"><span class="fbt">Feedback</span><span class="fbc" id="fbc">0</span></div>
    <span class="fbtog" id="fbtog">▲ expand</span>
  </div>
  <div class="fbb">
    <div class="fbo" id="fbo"><span class="fbe">Add comments or mark chunks to generate feedback…</span></div>
    <div class="fbhint">Use <strong>Accept</strong> / <strong>Send review</strong> in the header to submit.</div>
  </div>
</div>
`;

const JS = `
D.chunks = D.chunks || D.features || [];
// mode 'commit' = driven by /iterator-implement to review the just-built chunk;
// the no-change primary commits. mode 'review' (default) = standalone review.
const MODE = D.mode || 'review';
const S = { active: null, statuses: {}, notes: {}, comments: {} };
document.getElementById('commit') && (document.getElementById('commit').textContent = D.commit ? D.commit.slice(0,50) : '');

renderSidebar();
const first = (D.chunks||[])[0] || (D.uncategorized && D.uncategorized.length ? {name:'__unc__'} : null);
if(first) selectFeature(first.name);
refresh();

function renderSidebar(){
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  const feats = D.chunks || [];
  const hasUnc = D.uncategorized && D.uncategorized.length;
  if(!D.hasChunksFile){
    const b = document.createElement('div');
    b.style.cssText = 'font-size:11px;padding:8px 12px;color:var(--text-muted);border-bottom:1px solid var(--border)';
    b.textContent = 'No chunks — run /iterator-plan first';
    sb.appendChild(b);
  }
  if(feats.length){
    const l = document.createElement('div'); l.className='sec-label'; l.textContent='Chunks'; sb.appendChild(l);
    feats.forEach(f => sb.appendChild(makeFI(f)));
  }
  if(hasUnc){
    const l = document.createElement('div'); l.className='sec-label'; l.style.marginTop='8px'; l.textContent='Uncategorized'; sb.appendChild(l);
    const unc = { name:'__unc__', stats:{ added: D.uncategorized.reduce((s,f)=>s+(f.stats&&f.stats.added||0),0),
      removed: D.uncategorized.reduce((s,f)=>s+(f.stats&&f.stats.removed||0),0), files:D.uncategorized.length, complexity:'red' }};
    sb.appendChild(makeFI(unc));
  }
}
function makeFI(f){
  const el = document.createElement('div');
  el.className = 'fi' + (S.active===f.name?' active':'');
  el.dataset.name = f.name;
  el.onclick = () => selectFeature(f.name);
  const cx = (f.stats&&f.stats.complexity)||'green';
  const st = S.statuses[f.name];
  const label = f.name==='__unc__' ? 'uncategorized' : f.name;
  el.innerHTML = '<div class="dot d'+cx[0]+'"></div><div class="fm"><div class="fn">'+esc(label)+'</div>'+
    (f.stats ? '<div class="fs"><span class="sa">+'+f.stats.added+'</span> <span class="sd">-'+f.stats.removed+'</span> · '+f.stats.files+' file'+(f.stats.files!==1?'s':'')+'</div>' : '')+
    (st ? '<div class="sbadge s-'+(st==='approved'?'app':st==='changes'?'chg':'qst')+'">'+(st==='approved'?'Approved':st==='changes'?'Needs Changes':'Question')+'</div>' : '')+
    '</div>';
  return el;
}
function selectFeature(name){
  S.active = name;
  document.querySelectorAll('.fi').forEach(el => el.classList.toggle('active', el.dataset.name===name));
  let feat = (D.chunks||[]).find(f=>f.name===name);
  if(name==='__unc__') feat = { name:'__unc__', description:'Files not matched by any chunk.', files: D.uncategorized||[], blastRadius:null, dependsOn:[] };
  if(!feat) return;
  const total = ((feat.stats&&feat.stats.added)||0)+((feat.stats&&feat.stats.removed)||0);
  const note = S.notes[name]||'';
  const st = S.statuses[name];
  document.getElementById('detail').innerHTML =
    '<div class="fh"><div class="ftitle">'+(name==='__unc__'?'Uncategorized':esc(name))+'</div>'+
      '<div class="fdesc">'+esc(feat.description||'')+'</div>'+
      '<button class="note-btn" onclick="toggleNote(\\''+name+'\\')">'+(note?'Edit note':'+ Add chunk note')+'</button>'+
      '<div class="note-area '+(note?'open':'')+'" id="na-'+name+'">'+
        '<textarea id="nta-'+name+'" placeholder="Note about this chunk…">'+esc(note)+'</textarea>'+
        '<div class="na"><button class="ns" onclick="saveNote(\\''+name+'\\')">Save</button>'+
        '<button class="nc" onclick="toggleNote(\\''+name+'\\')">Cancel</button></div></div></div>'+
    (total>200?'<div class="warn">⚠️ '+total+' changed lines — exceeds the 200-line guideline.</div>':'')+
    '<div class="meta">'+
      ((feat.dependsOn&&feat.dependsOn.length)?'<div class="mi"><div class="ml">Depends on</div><div class="mv">'+esc(feat.dependsOn.join(', '))+'</div></div>':'')+
      (feat.stats?'<div class="mi"><div class="ml">Changed</div><div class="mv"><span class="sa">+'+feat.stats.added+'</span> <span class="sd">-'+feat.stats.removed+'</span></div></div>':'')+
      (feat.stats?'<div class="mi"><div class="ml">Files</div><div class="mv">'+feat.stats.files+'</div></div>':'')+
    '</div>'+
    (feat.blastRadius?'<div class="blast"><div class="bl">⚡ Blast Radius</div>'+esc(feat.blastRadius)+'</div>':'')+
    '<div class="sbtns">'+
      '<button class="sb '+(st==='approved'?'aa':'')+'" onclick="setSt(\\''+name+'\\',\\'approved\\')">✓ Approved</button>'+
      '<button class="sb '+(st==='changes'?'ac':'')+'" onclick="setSt(\\''+name+'\\',\\'changes\\')">✗ Needs Changes</button>'+
      '<button class="sb '+(st==='question'?'aq':'')+'" onclick="setSt(\\''+name+'\\',\\'question\\')">? Question</button>'+
    '</div><div id="hunks"></div>';
  renderHunks(feat);
}
function renderHunks(feat){
  const container = document.getElementById('hunks');
  if(!feat.files||!feat.files.length){ container.innerHTML='<div class="empty"><h3>No changes</h3></div>'; return; }
  feat.files.forEach((file, fi) => {
    const addC = (file.hunks||[]).reduce((s,h)=>s+h.lines.filter(l=>l.type==='addition').length,0);
    const delC = (file.hunks||[]).reduce((s,h)=>s+h.lines.filter(l=>l.type==='deletion').length,0);
    const card = document.createElement('div'); card.className='fc';
    card.innerHTML = '<div class="fch"><span class="fp">'+esc(file.path)+'</span><span><span class="sa">+'+addC+'</span> <span class="sd">-'+delC+'</span></span></div>';
    const tbl = document.createElement('table'); tbl.className='dt';
    (file.hunks||[]).forEach((hunk, hi) => {
      const hr = document.createElement('tr'); hr.className='dl hunk-header';
      hr.innerHTML = '<td class="ln"></td><td class="ln"></td><td class="lp"></td><td class="lc">'+esc(hunk.header)+'</td><td class="ci"></td>';
      tbl.appendChild(hr);
      let on = hunk.oldStart||0, nn = hunk.newStart||0;
      hunk.lines.forEach((line, li) => {
        const id = fi+'-'+hi+'-'+li;
        const hasC = !!S.comments[id];
        const row = document.createElement('tr');
        row.className = 'dl ' + line.type;
        row.dataset.lineId = id; row.dataset.file = file.path; row.dataset.content = line.content;
        let os='', ns='';
        if(line.type==='context'){ os=on++; ns=nn++; }
        else if(line.type==='deletion'){ os=on++; }
        else if(line.type==='addition'){ ns=nn++; }
        const px = line.type==='addition'?'+':line.type==='deletion'?'-':' ';
        row.innerHTML = '<td class="ln">'+os+'</td><td class="ln">'+ns+'</td><td class="lp">'+px+'</td><td class="lc">'+esc(line.content)+'</td><td class="ci">'+(hasC?'💬':'')+'</td>';
        row.onclick = () => toggleComment(id, row);
        tbl.appendChild(row);
        const cr = document.createElement('tr'); cr.className='cr'; cr.id='cr-'+id;
        cr.innerHTML = '<td colspan="5" class="cc"><textarea id="cta-'+id+'" placeholder="Add comment…">'+esc(S.comments[id]||'')+'</textarea><div class="ca"><button class="cs" onclick="saveComment(\\''+id+'\\')">Save</button><button class="cc2" onclick="cancelComment(\\''+id+'\\')">Cancel</button></div></td>';
        tbl.appendChild(cr);
      });
    });
    card.appendChild(tbl);
    container.appendChild(card);
  });
}
function toggleNote(name){ const el=document.getElementById('na-'+name); if(el) el.classList.toggle('open'); }
function saveNote(name){ S.notes[name] = (document.getElementById('nta-'+name)||{}).value||''; updateFb(); renderSidebar(); selectFeature(name); }
function setSt(name, val){ S.statuses[name] = S.statuses[name]===val ? null : val; renderSidebar(); selectFeature(name); updateFb(); }
function toggleComment(id, row){
  document.querySelectorAll('.cr.open').forEach(r=>r.classList.remove('open'));
  document.querySelectorAll('.dl.sel').forEach(r=>r.classList.remove('sel'));
  const cr = document.getElementById('cr-'+id);
  if(cr && !cr.classList.contains('open')){ cr.classList.add('open'); row.classList.add('sel'); const ta=document.getElementById('cta-'+id); if(ta) ta.focus(); }
}
function saveComment(id){ const v=(document.getElementById('cta-'+id)||{}).value; const t=v&&v.trim(); if(t) S.comments[id]=t; else delete S.comments[id]; updateFb(); selectFeature(S.active); }
function cancelComment(id){ const cr=document.getElementById('cr-'+id); if(cr) cr.classList.remove('open'); document.querySelectorAll('.dl.sel').forEach(r=>r.classList.remove('sel')); }

function buildFeedbackObj(){
  const features = [];
  const allNames = [...(D.chunks||[]).map(f=>f.name), (D.uncategorized&&D.uncategorized.length?'__unc__':null)].filter(Boolean);
  allNames.forEach(name => {
    const st = S.statuses[name], note = S.notes[name];
    if(st || note) features.push({ name: name==='__unc__'?'uncategorized':name, status: st||null, note: note||null });
  });
  const lineComments = Object.entries(S.comments).map(([id, comment]) => {
    const row = document.querySelector('[data-line-id="'+id+'"]');
    if(!row) return null;
    return { file: row.dataset.file, content: (row.dataset.content||'').trim(),
      type: row.classList.contains('addition')?'addition':row.classList.contains('deletion')?'deletion':'context', comment };
  }).filter(Boolean);
  return { type:'review-feedback', branch: D.branch||'HEAD', features, lineComments };
}
function updateFb(){
  const obj = buildFeedbackObj();
  const count = obj.features.length + obj.lineComments.length;
  const fbo = document.getElementById('fbo'); const fbc = document.getElementById('fbc');
  if(!count){ fbo.innerHTML='<span class="fbe">Add comments or mark chunks to generate feedback…</span>'; fbc.classList.remove('vis'); }
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
    const chunk = (D.chunks[0]||{}).name;
    post({ type:'accept-commit', branch: D.branch||'HEAD', chunk }, 'Accepted — Claude is committing');
    return;
  }
  post(buildFeedbackObj(), 'Review sent to Claude');
}
`;

const data = await readPayload();
const commitMode = data.mode === 'commit';
const html = renderPage({
  step: 'review', subtitle: commitMode ? '/ implement' : '/ review', branch: data.branch, title: data.plan,
  data, css: CSS, body: BODY, clientJs: JS,
  primaryIdle: commitMode ? 'Accept and commit' : 'Accept', primaryChanged: 'Send review',
});
serve({ step: 'review', html });
