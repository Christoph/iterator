#!/usr/bin/env node
/**
 * iterator: hub dashboard UI on the shared shell (./lib/ui.mjs,
 * ./lib/server.mjs). Read-only home screen for the whole flow: shows the
 * plan, the chunk cards with status/size/test badges, and the dependency
 * graph; the user picks one action and the server exits with it (standard
 * one-shot round trip — the SKILL.md dispatches into the chosen flow and
 * re-opens this dashboard when it finishes).
 *
 *   input:  { step:"hub", branch,
 *             plan: { title, status } | null,      // null = no bundle yet
 *             progress: { done, total },
 *             chunks: [ { name, title, description, status, size,
 *                         linesEstimate, testsStatus,   // none | red | green
 *                         dependsOn, hasDiff, hasCommits } ] }
 *   output: one JSON line to stdout —
 *     { type:"action", action:"plan"|"chunk"|"test"|"implement"|"review", chunk:"<slug>"|null }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { readPayload, serve } from './lib/server.mjs';
import { renderPage } from './lib/ui.mjs';

const CSS = `
.wrap{max-width:920px;margin:0 auto;padding:20px}
.sec-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin:18px 0 12px}
.planbar{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pt{font-size:15px;font-weight:600;flex:1;min-width:200px}
.pst{font-size:11px;border-radius:10px;padding:2px 8px;text-transform:capitalize}
.pst.approved{background:var(--bg-green);color:var(--dot-green)}
.pst.draft{background:var(--bg-yellow);color:var(--dot-yellow)}
.pbar{flex-basis:100%;height:6px;border-radius:3px;background:var(--bg);overflow:hidden}
.pbar div{height:100%;background:var(--bar-green);transition:width .2s}
.pcount{font-size:12px;color:var(--text-muted)}
button.act{font-size:12px;padding:4px 12px;border-radius:5px;border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text);font-family:inherit}
button.act:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
button.act:disabled{opacity:.4;cursor:not-allowed}
button.act.primary-act{background:var(--green);border-color:var(--green);color:#fff}
button.act.primary-act:hover:not(:disabled){background:var(--green-hover);color:#fff}
.cyclewarn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:6px;padding:10px 14px;
  font-size:13px;color:var(--dot-red);margin-bottom:12px}
.graph{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;overflow-x:auto}
.graph svg{display:block}
.gnode rect{fill:var(--bg);stroke:var(--border);rx:6}
.gnode.done rect{stroke:var(--dot-green)}
.gnode text{fill:var(--text);font-size:12px;font-family:-apple-system,sans-serif}
.gedge{stroke:var(--text-muted);stroke-width:1.5;fill:none;opacity:.6}
.card{background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;padding:12px 16px}
.card.done{opacity:.75}
.ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cn{font-size:14px;font-weight:600}
.chip{font-size:11px;border-radius:10px;padding:2px 8px}
.cg{background:var(--bg-green);color:var(--dot-green)}
.cy{background:var(--bg-yellow);color:var(--dot-yellow)}
.cr{background:var(--bg-red);color:var(--dot-red)}
.cmut{background:var(--bg);color:var(--text-muted);border:1px solid var(--border)}
.cdesc{font-size:13px;color:var(--text-muted);margin:6px 0 10px;line-height:1.5}
.deps{font-size:11.5px;color:var(--text-muted);margin-bottom:10px}
.deps code{background:var(--code-bg);border-radius:4px;padding:1px 6px;font-family:ui-monospace,Menlo,monospace}
.btns{display:flex;gap:8px;flex-wrap:wrap}
.hero{text-align:center;padding:80px 20px;color:var(--text-muted)}
.hero h2{color:var(--text);font-size:18px;margin-bottom:8px}
.hero p{font-size:13.5px;margin-bottom:20px;line-height:1.6}
`;

const BODY = `
<div class="wrap" id="wrap"></div>
`;

const JS = `
const CH = D.chunks || [];
const byName = {}; CH.forEach(c => byName[c.name] = c);

function action(act, chunk, msg){
  post({ type:'action', action: act, chunk: chunk || null }, msg || 'Sent to Claude');
}
function depsDone(c){ return (c.dependsOn||[]).every(d => byName[d] && byName[d].status==='done'); }
function testBadge(c){
  if(!c.testsStatus || c.testsStatus==='none') return '';
  return c.testsStatus==='green' ? '<span class="chip cg">🟢 tests green</span>'
                                 : '<span class="chip cr">🔴 tests red</span>';
}
function sizeChip(c){
  const cls = c.size==='large'?'cr':c.size==='medium'?'cy':'cg';
  return '<span class="chip '+cls+'">'+esc(c.size||'small')+(c.linesEstimate?' · ~'+c.linesEstimate:'')+'</span>';
}

render();

function render(){
  const w = document.getElementById('wrap');
  w.innerHTML = '';
  if(!D.plan){
    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.innerHTML = '<h2>No plan yet</h2><p>iterator keeps its state in a memory/ bundle in your repo.<br>Start by turning a goal into a reviewable plan.</p>';
    const b = document.createElement('button');
    b.className = 'act primary-act'; b.textContent = 'Create plan';
    b.addEventListener('click', () => action('plan', null, 'Starting /iterator-plan'));
    hero.appendChild(b);
    w.appendChild(hero);
    return;
  }

  // plan bar
  const done = (D.progress&&D.progress.done)||0, total = (D.progress&&D.progress.total)||CH.length;
  const bar = document.createElement('div');
  bar.className = 'planbar';
  bar.innerHTML = '<span class="pt">'+esc(D.plan.title||'Plan')+'</span>'+
    '<span class="pst '+(D.plan.status==='approved'?'approved':'draft')+'">'+esc(D.plan.status||'draft')+'</span>'+
    '<span class="pcount">'+done+' / '+total+' chunks done</span>'+
    '<div class="pbar"><div style="width:'+(total?Math.round(done/total*100):0)+'%"></div></div>';
  const revise = document.createElement('button');
  revise.className='act'; revise.textContent='Revise plan';
  revise.addEventListener('click', () => action('plan', null, 'Starting /iterator-plan'));
  const rechunk = document.createElement('button');
  rechunk.className='act'; rechunk.textContent='Re-chunk';
  rechunk.addEventListener('click', () => action('chunk', null, 'Starting /iterator-chunk'));
  bar.insertBefore(rechunk, bar.querySelector('.pbar'));
  bar.insertBefore(revise, rechunk);
  w.appendChild(bar);

  // graph
  const gt = document.createElement('div'); gt.className='sec-title'; gt.textContent='Dependency graph';
  const cw = document.createElement('div'); cw.id='cyclewarn';
  const g = document.createElement('div'); g.className='graph'; g.id='graph';
  w.appendChild(gt); w.appendChild(cw); w.appendChild(g);
  renderGraph();

  // cards
  const ct = document.createElement('div'); ct.className='sec-title'; ct.textContent='Chunks';
  w.appendChild(ct);
  if(!CH.length){
    const e = document.createElement('div'); e.className='hero';
    e.innerHTML = '<h2>No chunks yet</h2><p>The plan has not been broken into chunks.</p>';
    const b = document.createElement('button');
    b.className='act primary-act'; b.textContent='Chunk the plan';
    b.addEventListener('click', () => action('chunk', null, 'Starting /iterator-chunk'));
    e.appendChild(b); w.appendChild(e);
    return;
  }
  CH.forEach(c => w.appendChild(makeCard(c)));
}

function makeCard(c){
  const card = document.createElement('div');
  card.className = 'card' + (c.status==='done'?' done':'');
  const ready = depsDone(c);
  card.innerHTML =
    '<div class="ch"><span class="cn">'+(c.status==='done'?'✅ ':'⬜ ')+esc(c.title||c.name)+'</span>'+
      '<span class="chip cmut">'+esc(c.name)+'</span>'+sizeChip(c)+testBadge(c)+'</div>'+
    '<div class="cdesc">'+esc(c.description||'')+'</div>'+
    ((c.dependsOn&&c.dependsOn.length)?'<div class="deps">depends on '+c.dependsOn.map(d=>'<code>'+esc(d)+'</code>').join(' ')+'</div>':'');

  const btns = document.createElement('div');
  btns.className = 'btns';

  const impl = document.createElement('button');
  impl.className = 'act primary-act';
  impl.textContent = 'Implement';
  if(c.status==='done'){ impl.disabled = true; impl.title = 'Already done'; }
  else if(!ready){
    impl.disabled = true;
    impl.title = 'Waiting on: '+(c.dependsOn||[]).filter(d=>!byName[d]||byName[d].status!=='done').join(', ');
  }
  impl.addEventListener('click', () => action('implement', c.name, 'Starting /iterator-implement — you can close this tab'));

  const test = document.createElement('button');
  test.className = 'act';
  test.textContent = c.status==='pending' ? 'Test (red)' : 'Test';
  test.title = c.status==='pending'
    ? 'Write failing tests from the chunk contract before implementing'
    : 'Write passing tests against the implemented chunk';
  test.addEventListener('click', () => action('test', c.name, 'Starting /iterator-test'));

  const rev = document.createElement('button');
  rev.className = 'act';
  rev.textContent = 'Review';
  if(!c.hasDiff && !c.hasCommits){ rev.disabled = true; rev.title = 'Nothing to review — no working-tree changes or recorded commits'; }
  rev.addEventListener('click', () => action('review', c.name, 'Starting /iterator-review'));

  btns.appendChild(impl); btns.appendChild(test); btns.appendChild(rev);
  card.appendChild(btns);
  return card;
}

// dependency graph — same layered layout as the /iterator-chunk UI
function clip(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
function computeLevels(){
  const level = {}, state = {}; let cycle = false;
  function lv(name){
    if(level[name]!=null) return level[name];
    if(state[name]==='visiting'){ cycle=true; return 0; }
    state[name]='visiting';
    let m = 0;
    ((byName[name]&&byName[name].dependsOn)||[]).forEach(d=>{ if(byName[d]) m=Math.max(m, lv(d)+1); });
    state[name]='done';
    return level[name]=m;
  }
  CH.forEach(c=>lv(c.name));
  return { level, cycle };
}
function renderGraph(){
  const g = document.getElementById('graph');
  const cw = document.getElementById('cyclewarn');
  if(!CH.length){ g.innerHTML='<span style="color:var(--text-muted);font-size:13px">No chunks yet.</span>'; cw.innerHTML=''; return; }
  const { level, cycle } = computeLevels();
  cw.innerHTML = cycle ? '<div class="cyclewarn">⚠️ Dependency cycle detected — fix depends-on in /iterator-chunk before implementing.</div>' : '';
  const byLevel = {};
  CH.forEach(c=>{ const l=level[c.name]||0; (byLevel[l]=byLevel[l]||[]).push(c); });
  const levels = Object.keys(byLevel).map(Number).sort((a,b)=>a-b);
  const NW=150, NH=34, GAPX=70, GAPY=18;
  const pos = {}; let maxRows = 0;
  levels.forEach((l,ci)=>{ byLevel[l].forEach((c,ri)=>{ pos[c.name]={x:ci*(NW+GAPX)+10, y:ri*(NH+GAPY)+10}; }); maxRows=Math.max(maxRows, byLevel[l].length); });
  const W = levels.length*(NW+GAPX)+10;
  const H = maxRows*(NH+GAPY)+10;
  let edges='';
  CH.forEach(c=>{ ((c.dependsOn)||[]).forEach(d=>{ if(pos[d]&&pos[c.name]){
    const x1=pos[d].x+NW, y1=pos[d].y+NH/2, x2=pos[c.name].x, y2=pos[c.name].y+NH/2;
    const mx=(x1+x2)/2;
    edges+='<path class="gedge" marker-end="url(#arrow)" d="M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2+'"/>';
  }}); });
  let nodes='';
  CH.forEach(c=>{ const p=pos[c.name]; const done=c.status==='done';
    nodes+='<g class="gnode'+(done?' done':'')+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+NW+'" height="'+NH+'" rx="6"/>'+
      '<text x="'+(p.x+10)+'" y="'+(p.y+NH/2+4)+'">'+(done?'✓ ':'')+esc(clip(c.name,20))+'</text></g>';
  });
  g.innerHTML = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'+
    '<path d="M0 0 L8 4 L0 8 z" fill="var(--text-muted)"/></marker></defs>'+edges+nodes+'</svg>';
}
`;

const data = await readPayload();
const html = renderPage({
  step: 'hub', subtitle: '/ dashboard', branch: data.branch,
  title: data.plan && data.plan.title,
  data, css: CSS, body: BODY, clientJs: JS,
  primary: false, // the per-card action buttons are the primaries here
});
serve({ step: 'hub', html });
