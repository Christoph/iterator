#!/usr/bin/env node
/**
 * iterator-chunk: chunk-plan UI on the shared shell (../../lib/ui.mjs,
 * ../../lib/server.mjs). Shows the dependency graph, per-chunk cards with
 * snippets, drag-to-move files, and Split/Merge round-trips.
 *
 *   input:  { step:"chunk", branch, plan, chunks:[ {name,description,implementationNotes,
 *             files,dependsOn,linesEstimate,size,status,snippets} ] }
 *   output: one JSON line to stdout —
 *     { type:"plan-approved" }                                   (chunks accepted as-is)
 *     { type:"plan-adjustments", moves, renames, descUpdates, comments }
 *     { type:"split-request", chunk, content }
 *     { type:"merge-request", chunks:[a,b] }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { readPayload, serve } from '../../lib/server.mjs';
import { renderPage } from '../../lib/ui.mjs';

const CHUNK_CSS = `
.sumbar{padding:14px 20px;display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--border);
  background:var(--surface);flex-wrap:wrap}
.ss{display:flex;flex-direction:column;gap:2px}
.ssl{font-size:11px;text-transform:uppercase;color:var(--text-muted)}
.ssv{font-size:18px;font-weight:600}
.wrap{max-width:920px;margin:0 auto;padding:20px}
.sec-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin:18px 0 12px}
.cyclewarn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:6px;padding:10px 14px;
  font-size:13px;color:var(--dot-red);margin-bottom:12px}
.graph{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;overflow-x:auto}
.graph svg{display:block}
.gnode rect{fill:var(--bg);stroke:var(--border);rx:6}
.gnode.done rect{stroke:var(--dot-green)}
.gnode text{fill:var(--text);font-size:12px;font-family:-apple-system,sans-serif}
.gedge{stroke:var(--text-muted);stroke-width:1.5;fill:none;opacity:.6}
.fc{background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:16px;overflow:hidden;
  transition:border-color .15s,background .15s}
.fc.drag-over{background:var(--drag-over);border-color:var(--accent)}
.fc.done{opacity:.75}
.fc.merge-target{cursor:pointer;border-style:dashed;border-color:var(--accent)}
.fch{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)}
.fchl{display:flex;align-items:center;gap:10px}
.fctitle{font-size:14px;font-weight:600;border:1px solid transparent;border-radius:3px;padding:1px 4px;
  background:none;color:var(--text);font-family:inherit;min-width:80px}
.fctitle:hover{border-color:var(--border)}
.fctitle:focus{border-color:var(--accent);outline:none}
.chip{font-size:11px;border-radius:10px;padding:2px 8px}
.cg{background:var(--bg-green);color:var(--dot-green)}
.cy{background:var(--bg-yellow);color:var(--dot-yellow)}
.cr{background:var(--bg-red);color:var(--dot-red)}
.donechip{background:var(--bg-green);color:var(--dot-green);font-size:11px;border-radius:10px;padding:2px 8px}
.card-btns{display:flex;gap:6px}
button.cb{font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--text-muted);cursor:pointer}
button.cb:hover{color:var(--text);border-color:var(--text-muted)}
button.cb.split:hover{color:var(--dot-yellow);border-color:var(--dot-yellow)}
button.cb.merge-sel{background:var(--accent);border-color:var(--accent);color:#fff}
.fcb{padding:12px 16px}
.fcdesc{font-size:13px;color:var(--text);margin-bottom:8px;border:1px solid transparent;border-radius:3px;padding:2px 4px;line-height:1.4}
.fcdesc:hover{border-color:var(--border)}
.fcdesc:focus{border-color:var(--accent);outline:none}
.notes{font-size:12px;color:var(--text-muted);line-height:1.5}
.deps{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dep{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1px 8px;font-size:11px;color:var(--accent)}
.files{display:flex;flex-wrap:wrap;gap:5px}
.fchip{font-size:11px;font-family:monospace;background:var(--bg);border:1px solid var(--border);border-radius:3px;
  padding:2px 7px;cursor:grab;user-select:none;color:var(--text-muted)}
.fchip:hover{border-color:var(--accent);color:var(--text)}
pre.snip{background:var(--code-bg);border-radius:6px;padding:10px 12px;overflow-x:auto;margin:4px 0;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5}
.owarn{background:var(--bg-red);border:1px solid rgba(248,81,73,.4);border-radius:4px;padding:8px 10px;
  margin-bottom:10px;font-size:12px;color:var(--dot-red)}
textarea.cmt{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);
  font-size:12px;font-family:inherit;resize:vertical;min-height:52px;outline:none;padding:8px 10px;line-height:1.5}
textarea.cmt:focus{border-color:var(--accent)}
`;

const CHUNK_BODY = `
<div class="sumbar">
  <div class="ss"><div class="ssl">Chunks</div><div class="ssv" id="s-cnt">0</div></div>
  <div class="ss"><div class="ssl">Est. lines</div><div class="ssv" id="s-total">0</div></div>
  <div class="ss"><div class="ssl">Oversized</div><div class="ssv" id="s-over" style="color:var(--dot-red)">0</div></div>
  <div class="ss"><div class="ssl">Done</div><div class="ssv" id="s-done">0</div></div>
</div>
<div class="wrap">
  <div id="cyclewarn"></div>
  <div class="sec-title">Dependency graph</div>
  <div class="graph" id="graph"></div>
  <div class="sec-title">Chunks</div>
  <div id="cards"></div>
</div>
`;

const CHUNK_JS = `
const S = { chunks: JSON.parse(JSON.stringify(D.chunks || [])), moves:[], renames:[], descUpdates:[], comments:{}, mergeSel:null };
renderAll();

function renderAll(){ updateSummary(); renderGraph(); renderCards(); refresh(); }
function estLines(c){ return c.linesEstimate || 0; }
function sizeClass(c){ const t=estLines(c); return t<=100?'cg':t<=200?'cy':'cr'; }
function sizeLabel(c){ const t=estLines(c); return (t<=100?'small':t<=200?'medium':'large'); }
function clip(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }

function updateSummary(){
  const cs = S.chunks;
  const total = cs.reduce((s,c)=>s+estLines(c),0);
  document.getElementById('s-cnt').textContent = cs.length;
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-over').textContent = cs.filter(c=>estLines(c)>200).length;
  document.getElementById('s-done').textContent = cs.filter(c=>c.status==='done').length;
}
function computeLevels(){
  const by = {}; S.chunks.forEach(c=>by[c.name]=c);
  const level = {}, state = {}; let cycle = false;
  function lv(name){
    if(level[name]!=null) return level[name];
    if(state[name]==='visiting'){ cycle=true; return 0; }
    state[name]='visiting';
    let m = 0;
    ((by[name]&&by[name].dependsOn)||[]).forEach(d=>{ if(by[d]) m=Math.max(m, lv(d)+1); });
    state[name]='done';
    return level[name]=m;
  }
  S.chunks.forEach(c=>lv(c.name));
  return { level, cycle };
}
function renderGraph(){
  const g = document.getElementById('graph');
  const cw = document.getElementById('cyclewarn');
  if(!S.chunks.length){ g.innerHTML='<span style="color:var(--text-muted);font-size:13px">No chunks yet.</span>'; cw.innerHTML=''; return; }
  const { level, cycle } = computeLevels();
  cw.innerHTML = cycle ? '<div class="cyclewarn">⚠️ Dependency cycle detected — the implementer cannot order these. Fix depends-on before accepting.</div>' : '';
  const byLevel = {};
  S.chunks.forEach(c=>{ const l=level[c.name]||0; (byLevel[l]=byLevel[l]||[]).push(c); });
  const levels = Object.keys(byLevel).map(Number).sort((a,b)=>a-b);
  const NW=150, NH=34, GAPX=70, GAPY=18;
  const pos = {}; let maxRows = 0;
  levels.forEach((l,ci)=>{ byLevel[l].forEach((c,ri)=>{ pos[c.name]={x:ci*(NW+GAPX)+10, y:ri*(NH+GAPY)+10}; }); maxRows=Math.max(maxRows, byLevel[l].length); });
  const W = levels.length*(NW+GAPX)+10;
  const H = maxRows*(NH+GAPY)+10;
  let edges='';
  S.chunks.forEach(c=>{ ((c.dependsOn)||[]).forEach(d=>{ if(pos[d]&&pos[c.name]){
    const x1=pos[d].x+NW, y1=pos[d].y+NH/2, x2=pos[c.name].x, y2=pos[c.name].y+NH/2;
    const mx=(x1+x2)/2;
    edges+='<path class="gedge" marker-end="url(#arrow)" d="M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2+'"/>';
  }}); });
  let nodes='';
  S.chunks.forEach(c=>{ const p=pos[c.name]; const done=c.status==='done';
    nodes+='<g class="gnode'+(done?' done':'')+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+NW+'" height="'+NH+'" rx="6"/>'+
      '<text x="'+(p.x+10)+'" y="'+(p.y+NH/2+4)+'">'+(done?'✓ ':'')+esc(clip(c.name,20))+'</text></g>';
  });
  g.innerHTML = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'+
    '<path d="M0 0 L8 4 L0 8 z" fill="var(--text-muted)"/></marker></defs>'+edges+nodes+'</svg>';
}
function renderCards(){ const c=document.getElementById('cards'); c.innerHTML=''; S.chunks.forEach(ch => c.appendChild(makeCard(ch))); }
function makeCard(c){
  const t = estLines(c);
  const done = c.status==='done';
  const isSel = S.mergeSel===c.name;
  const isTgt = S.mergeSel && S.mergeSel!==c.name;
  const card = document.createElement('div');
  card.className='fc'+(done?' done':'')+(isTgt?' merge-target':'');
  card.dataset.chunk = c.name;
  if(isTgt) card.addEventListener('click', e=>{ if(e.target.closest('button,input,textarea,.fchip'))return; completeMerge(c.name); });
  card.addEventListener('dragover', e=>{ e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', ()=>card.classList.remove('drag-over'));
  card.addEventListener('drop', e=>{ e.preventDefault(); card.classList.remove('drag-over');
    const {file,from}=JSON.parse(e.dataTransfer.getData('text/plain')); if(from!==c.name) moveFile(file,from,c.name); });
  const snippets = (c.snippets||[]).map(s=>'<pre class="snip">'+esc(typeof s==='string'?s:s.code||'')+'</pre>').join('');
  const files = (c.files||[]).map(f=>'<div class="fchip" draggable="true" ondragstart="dragStart(event,'+JSON.stringify(f).replace(/"/g,'&quot;')+','+JSON.stringify(c.name).replace(/"/g,'&quot;')+')">'+esc(f)+'</div>').join('');
  const deps = (c.dependsOn||[]).length ? '<div class="deps">'+c.dependsOn.map(d=>'<span class="dep">'+esc(d)+'</span>').join('')+'</div>' : '<div class="notes">none</div>';
  card.innerHTML =
    '<div class="fch"><div class="fchl">'+
      '<input class="fctitle" value="'+esc(c.name)+'" data-orig="'+esc(c.name)+'" '+
        'onblur="renameChunk(this.dataset.orig,this.value.trim())" onkeydown="if(event.key===\\'Enter\\')this.blur()"'+(done?' disabled':'')+'>'+
      '<span class="chip '+sizeClass(c)+'">'+sizeLabel(c)+' · ~'+t+' lines</span>'+
      (done?'<span class="donechip">✓ done</span>':'')+
    '</div><div class="card-btns">'+
      (done?'':'<button class="cb split" onclick="splitChunk(\\''+esc(c.name)+'\\')">Split</button>'+
      '<button class="cb '+(isSel?'merge-sel':'')+'" onclick="toggleMerge(\\''+esc(c.name)+'\\')">'+(isSel?'Cancel':'Merge with…')+'</button>')+
    '</div></div>'+
    '<div class="fcb">'+
      (t>200?'<div class="owarn">⚠️ ~'+t+' lines — exceeds the ~200-line guideline. Consider Split.</div>':'')+
      '<div class="fcdesc" contenteditable="'+(!done)+'" onblur="updateDesc(\\''+esc(c.name)+'\\',this.textContent.trim())">'+esc(c.description||'')+'</div>'+
      (c.implementationNotes?'<div class="lbl">Implementation notes</div><div class="notes">'+esc(c.implementationNotes)+'</div>':'')+
      '<div class="lbl">Depends on</div>'+deps+
      (snippets?'<div class="lbl">Relevant snippets</div>'+snippets:'')+
      (files?'<div class="lbl">Files</div><div class="files">'+files+'</div>':'')+
      (done?'':'<div class="lbl">Comment</div><textarea class="cmt" placeholder="Comment on this chunk for Claude…" oninput="setComment(\\''+esc(c.name)+'\\',this.value)">'+esc(S.comments[c.name]||'')+'</textarea>')+
    '</div>';
  return card;
}
function dragStart(e,file,from){ e.dataTransfer.setData('text/plain', JSON.stringify({file,from})); }
function moveFile(file,from,to){
  const a=S.chunks.find(c=>c.name===from), b=S.chunks.find(c=>c.name===to);
  if(!a||!b) return;
  a.files=(a.files||[]).filter(f=>f!==file); b.files=[...(b.files||[]),file];
  S.moves.push({file,from,to}); renderAll();
}
function renameChunk(oldName,newName){
  if(!newName||newName===oldName) return;
  const c=S.chunks.find(c=>c.name===oldName); if(!c) return;
  c.name=newName;
  S.chunks.forEach(x=>{ if(x.dependsOn) x.dependsOn=x.dependsOn.map(d=>d===oldName?newName:d); });
  if(S.comments[oldName]){ S.comments[newName]=S.comments[oldName]; delete S.comments[oldName]; }
  S.renames.push({from:oldName,to:newName}); renderAll();
}
function updateDesc(name,desc){
  const c=S.chunks.find(c=>c.name===name); if(!c||desc===c.description) return;
  c.description=desc; S.descUpdates.push({chunk:name,description:desc}); refresh();
}
function setComment(name,val){ val=val.trim(); if(val) S.comments[name]=val; else delete S.comments[name]; refresh(); }
function splitChunk(name){
  const c=S.chunks.find(c=>c.name===name); if(!c) return;
  if(!confirm('Split "'+name+'"? Claude will split it into ~200-line chunks and reopen this view.')) return;
  post({type:'split-request', branch:D.branch||'HEAD', chunk:name, content:JSON.stringify(c)}, 'Splitting — Claude is working…');
}
function toggleMerge(name){ S.mergeSel = S.mergeSel===name?null:name; renderCards(); }
function completeMerge(target){
  const a=S.mergeSel; if(!a||a===target){ S.mergeSel=null; renderCards(); return; }
  if(!confirm('Merge "'+a+'" and "'+target+'"? Claude will combine them and reopen this view.')) return;
  post({type:'merge-request', branch:D.branch||'HEAD', chunks:[a,target]}, 'Merging — Claude is working…');
}
function collectComments(){ return Object.entries(S.comments).map(([chunk,comment])=>({chunk,comment})); }
function hasChanges(){ return !!(S.moves.length||S.renames.length||S.descUpdates.length||collectComments().length); }
function onPrimary(){
  if(hasChanges()){
    post({type:'plan-adjustments', branch:D.branch||'HEAD', moves:S.moves, renames:S.renames, descUpdates:S.descUpdates, comments:collectComments()}, 'Sent — Claude is updating the chunks');
  } else {
    post({type:'plan-approved', branch:D.branch||'HEAD'}, 'Chunks accepted — run /iterator-implement to build them');
  }
}
`;

const data = await readPayload();
const html = renderPage({
  step: 'chunk', subtitle: '/ chunks', branch: data.branch, title: data.plan,
  data, css: CHUNK_CSS, body: CHUNK_BODY, clientJs: CHUNK_JS,
  primaryIdle: 'Accept', primaryChanged: 'Send review',
});
serve({ step: 'chunk', html });
