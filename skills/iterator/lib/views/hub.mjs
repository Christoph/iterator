/**
 * iterator: hub dashboard UI on the shared shell (../ui.mjs,
 * ../server.mjs). Read-only home screen for the whole flow: shows the
 * plan, the chunk cards with status/size/test badges, and the dependency
 * graph; the user picks one action and the server exits with it (standard
 * one-shot round trip — the SKILL.md dispatches into the chosen flow and
 * re-opens this dashboard when it finishes).
 *
 *   input:  { step:"hub", branch,
 *             plan: { title, status } | null,      // null = no bundle yet
 *             progress: { done, total },
 *             knowledgeInitialized,                // memory/ knowledge side exists
 *             dirty: { count, files },             // working-tree files outside the bundle
 *             chunks: [ { name, title, description, status, size,
 *                         testsStatus,                  // none | red | green
 *                         dependsOn, hasDiff, hasCommits,
 *                         conflicts } ] }               // # of flagged decision conflicts
 *             retired: [ { name, title, created } ]   // archived plans, newest first
 *   output: one JSON line to stdout —
 *     { type:"action", action:"plan"|"chunk"|"test"|"implement"|"review"|"okf-init"
 *                             |"view-archive"        // chunk = archive name for view-archive
 *                             |"auto-implement"      // run the whole loop agent-driven
 *                             |"cancel-chunk"        // archive one chunk (deterministic)
 *                             |"cancel-plan",        // abandon plan + delete branch/worktree (deterministic)
 *       chunk:"<slug>"|null,
 *       prompt:"<typed plan goal>"|null }          // hero goal box, plan/okf-init only
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from '../ui.mjs';

const CSS = `
.wrap{max-width:920px;margin:0 auto;padding:var(--sp-5)}
.sec-title{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:18px 0 12px}
.planbar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:14px var(--sp-4);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pt{font-family:var(--font-display);font-size:var(--fs-lg);font-weight:600;flex:1;min-width:200px}
.pst{font-family:var(--font-mono);font-size:var(--fs-xs);border-radius:10px;padding:2px var(--sp-2);text-transform:uppercase;letter-spacing:.05em}
.pst.approved{background:var(--bg-green);color:var(--dot-green)}
.pst.draft{background:var(--bg-yellow);color:var(--dot-yellow)}
.pbar{flex-basis:100%;height:6px;border-radius:3px;background:var(--bg);overflow:hidden;position:relative}
.pbar div{height:100%;background:var(--bar-green);transition:width .2s}
.pbar::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),var(--surface) calc(10% - 2px) 10%)}
.pcount{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted)}
button.act{font-size:var(--fs-sm);padding:4px var(--sp-3);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text);font-family:inherit}
button.act:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
button.act:disabled{opacity:.4;cursor:not-allowed}
button.act.primary-act{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
button.act.primary-act:hover:not(:disabled){filter:brightness(1.06);color:var(--accent-fg)}
button.act.primary-act:active:not(:disabled){transform:translateY(1px)}
button.act.danger{color:var(--del-fg);border-color:var(--border)}
button.act.danger:hover:not(:disabled){border-color:var(--del-fg);color:var(--del-fg)}
button.act.danger-armed{background:var(--bg-red);border-color:var(--del-fg);color:var(--del-fg)}
.cyclewarn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:var(--radius-sm);padding:10px 14px;
  font-size:var(--fs-sm);color:var(--dot-red);margin-bottom:12px}
.graph{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:var(--sp-3);overflow-x:auto}
.graph svg{display:block}
.gnode rect{fill:var(--bg);stroke:var(--border);rx:6}
.gnode.done rect{stroke:var(--dot-green)}
.gnode text{fill:var(--text);font-size:12px;font-family:var(--font-mono)}
.gedge{stroke:var(--text-muted);stroke-width:1.5;fill:none;opacity:.6}
.card{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--border);
  border-radius:var(--radius-card);box-shadow:var(--shadow-card);margin-bottom:var(--sp-3);padding:var(--sp-3) var(--sp-4);
  transition:box-shadow .15s}
.card:hover{box-shadow:var(--shadow-raise)}
.card.done{opacity:.75;border-left-color:var(--dot-green)}
.ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cn{font-size:var(--fs-md);font-weight:600}
.chip{font-size:var(--fs-xs);font-family:var(--font-mono);border-radius:10px;padding:2px var(--sp-2)}
.cg{background:var(--bg-green);color:var(--dot-green)}
.cy{background:var(--bg-yellow);color:var(--dot-yellow)}
.cr{background:var(--bg-red);color:var(--dot-red)}
.cmut{background:var(--bg);color:var(--text-muted);border:1px solid var(--border)}
.cdesc{font-size:var(--fs-sm);color:var(--text-muted);margin:6px 0 10px;line-height:1.5}
.deps{font-size:11.5px;color:var(--text-muted);margin-bottom:10px}
.deps code{background:var(--code-bg);border-radius:4px;padding:1px 6px;font-family:var(--font-mono)}
.btns{display:flex;gap:var(--sp-2);flex-wrap:wrap}
.hero{text-align:center;padding:64px var(--sp-5);color:var(--text-muted)}
.hero svg{display:block;margin:0 auto var(--sp-4);opacity:.85}
.hero h2{color:var(--text);font-family:var(--font-display);font-size:var(--fs-xl);margin-bottom:var(--sp-2)}
.hero p{font-size:var(--fs-sm);margin-bottom:var(--sp-5);line-height:1.6}
.hero textarea.goal{display:block;width:100%;max-width:560px;margin:0 auto var(--sp-4);padding:10px 12px;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);color:var(--text);
  font-size:var(--fs-sm);font-family:inherit;resize:vertical;min-height:72px;outline:none;line-height:1.5;text-align:left}
.hero textarea.goal:focus{border-color:var(--accent)}
.goal-wrap{position:relative;width:100%;max-width:560px;margin:0 auto var(--sp-4)}
.goal-wrap textarea.goal{max-width:none;margin:0}
.at-menu{position:absolute;top:100%;left:0;right:0;margin-top:2px;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-sm);box-shadow:var(--shadow-card);z-index:20;max-height:220px;overflow:auto;text-align:left;display:none}
.at-menu.open{display:block}
.at-menu div{padding:6px 10px;font-family:var(--font-mono);font-size:var(--fs-xs);cursor:pointer;color:var(--text)}
.at-menu div.sel{background:var(--code-bg);color:var(--accent)}
.hero .btns-center{display:flex;gap:var(--sp-2);justify-content:center;flex-wrap:wrap}
.hero .initnote{font-size:var(--fs-xs);color:var(--dot-yellow);margin-bottom:var(--sp-3)}
.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px}
.st{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:0}
.st.done{background:var(--dot-green)}
.st.draft{background:var(--dot-yellow)}
.st.pending{background:transparent;border:2px solid var(--border)}
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
  return c.testsStatus==='green' ? '<span class="chip cg"><i class="sdot"></i>tests green</span>'
                                 : '<span class="chip cr"><i class="sdot"></i>tests red</span>';
}
function sizeChip(c){
  const cls = c.size==='large'?'cr':c.size==='medium'?'cy':'cg';
  return '<span class="chip '+cls+'">'+esc(c.size||'small')+'</span>';
}

// Two-step inline confirm: first click arms the button with a warning label,
// the second click (within 5s) fires. Destructive actions only.
function confirmButton(btn, armedLabel, fire){
  btn.addEventListener('click', () => {
    if(btn.dataset.armed){ fire(); return; }
    btn.dataset.armed = '1';
    btn.dataset.orig = btn.textContent;
    btn.textContent = armedLabel;
    btn.classList.add('danger-armed');
    setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.orig;
      btn.classList.remove('danger-armed');
    }, 5000);
  });
}

// Minimal @-file suggestions on the goal box: substring filter over the
// gathered tracked-file list, arrow keys + Enter/Tab to accept.
function wireAtMenu(ta, menu){
  const FILES = Array.isArray(D.files) ? D.files : [];
  let hits = [], sel = 0;
  function token(){
    const m = ta.value.slice(0, ta.selectionStart).match(/@([\\w./-]*)$/);
    return m ? m[1] : null;
  }
  function close(){ menu.classList.remove('open'); hits = []; }
  function show(){
    const t = token();
    if(t === null || !FILES.length){ close(); return; }
    const q = t.toLowerCase();
    hits = FILES.filter(f => f.toLowerCase().includes(q)).slice(0, 8);
    if(!hits.length){ close(); return; }
    sel = Math.min(sel, hits.length - 1);
    menu.innerHTML = hits.map((f, i) =>
      '<div class="'+(i===sel?'sel':'')+'" data-i="'+i+'">'+esc(f)+'</div>').join('');
    menu.classList.add('open');
    menu.querySelectorAll('[data-i]').forEach(el => {
      el.addEventListener('mousedown', e => { e.preventDefault(); accept(+el.dataset.i); });
    });
  }
  function accept(i){
    const t = token();
    if(t === null || !hits[i]) return;
    const end = ta.selectionStart;
    const start = end - t.length - 1;
    ta.value = ta.value.slice(0, start) + '@' + hits[i] + ' ' + ta.value.slice(end);
    const caret = start + hits[i].length + 2;
    ta.setSelectionRange(caret, caret);
    close();
    ta.focus();
  }
  ta.addEventListener('input', () => { sel = 0; show(); });
  ta.addEventListener('click', () => { sel = 0; show(); });
  ta.addEventListener('blur', () => setTimeout(close, 150));
  ta.addEventListener('keydown', e => {
    if(!menu.classList.contains('open')) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); sel = (sel + 1) % hits.length; show(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = (sel + hits.length - 1) % hits.length; show(); }
    else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); accept(sel); }
    else if(e.key === 'Escape'){ close(); }
  });
}

render();

function render(){
  const w = document.getElementById('wrap');
  w.innerHTML = '';
  if(!D.plan){
    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.innerHTML =
      '<svg width="72" height="56" viewBox="0 0 72 56" fill="none" aria-hidden="true">'+
        '<rect x="2" y="6" width="42" height="30" rx="6" stroke="var(--border)" stroke-width="2"/>'+
        '<line x1="10" y1="16" x2="36" y2="16" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>'+
        '<line x1="10" y1="23" x2="30" y2="23" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>'+
        '<circle cx="54" cy="38" r="12" stroke="var(--accent)" stroke-width="2"/>'+
        '<path d="M49 38 l4 4 l7 -8" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
      '</svg>'+
      '<h2>No plan yet</h2><p>iterator keeps its state in a memory/ bundle in your repo.<br>Type a goal and start turning it into a reviewable plan.</p>';
    const goal = document.createElement('textarea');
    goal.className = 'goal';
    goal.placeholder = 'What are you building and why? (1\\u20133 sentences \\u2014 optional, saves a question round; @ mentions repo files)';
    const goalWrap = document.createElement('div');
    goalWrap.className = 'goal-wrap';
    goalWrap.appendChild(goal);
    const atMenu = document.createElement('div');
    atMenu.className = 'at-menu';
    goalWrap.appendChild(atMenu);
    wireAtMenu(goal, atMenu);
    hero.appendChild(goalWrap);
    const btns = document.createElement('div'); btns.className = 'btns-center';
    // Knowledge side missing → initializing memory first is the primary path
    // (soft gate: "Create plan" still works and the goal rides along either way).
    if(!D.knowledgeInitialized){
      const note = document.createElement('div');
      note.className = 'initnote';
      note.textContent = '\\u26a0 Project memory is not initialized yet \\u2014 initialize it first so plans and chunks can load relevant knowledge.';
      hero.insertBefore(note, goal);
      const init = document.createElement('button');
      init.className = 'act primary-act'; init.textContent = 'Initialize memory';
      init.addEventListener('click', () =>
        post({ type:'action', action:'okf-init', chunk:null, prompt: goal.value.trim() || null }, 'Starting /okf-init'));
      btns.appendChild(init);
    }
    const b = document.createElement('button');
    b.className = 'act' + (D.knowledgeInitialized ? ' primary-act' : ''); b.textContent = 'Create plan';
    b.addEventListener('click', () =>
      post({ type:'action', action:'plan', chunk:null, prompt: goal.value.trim() || null }, 'Starting /iterator-plan'));
    btns.appendChild(b);
    hero.appendChild(btns);
    w.appendChild(hero);
    renderRetired(w);
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
  // Auto mode: once the chunk set is approved (pending chunks exist), the
  // whole test → implement → review loop can run agent-driven.
  const pendingReady = CH.some(c => c.status==='pending');
  if(pendingReady){
    const auto = document.createElement('button');
    auto.className = 'act primary-act';
    auto.textContent = 'Implement all (auto)';
    auto.title = 'Run test \\u2192 implement \\u2192 review for every chunk automatically; a reviewer agent stands in for you until escalation';
    auto.addEventListener('click', () => action('auto-implement', null, 'Starting auto mode'));
    bar.insertBefore(auto, bar.querySelector('.pbar'));
  }
  // Tight git flow: surface working-tree dirt so leftovers never linger silently.
  if(D.dirty && D.dirty.count){
    const dw = document.createElement('span');
    dw.className = 'chip cy';
    dw.textContent = '\\u26a0 ' + D.dirty.count + ' uncommitted file' + (D.dirty.count!==1?'s':'');
    dw.title = (D.dirty.files||[]).join('\\n');
    bar.insertBefore(dw, bar.querySelector('.pbar'));
  }
  // Every chunk done → the plan is finished work: offer condensing it into a
  // decisions/ concept and archiving the chunk files (write.mjs retire-plan).
  if(total > 0 && done === total){
    const retire = document.createElement('button');
    retire.className='act primary-act'; retire.textContent='Retire plan';
    retire.title='Condense the finished plan into a decisions/ memory and archive its chunks';
    retire.addEventListener('click', () => action('retire', null, 'Starting plan retirement'));
    bar.insertBefore(retire, bar.querySelector('.pbar'));
  }
  // Cancel: abandon the plan entirely — archives the bundle side and deletes
  // the plan branch/worktree, so the armed label spells out what is at stake.
  const cancelPlan = document.createElement('button');
  cancelPlan.className = 'act danger';
  cancelPlan.textContent = 'Cancel plan';
  const dirtyWarn = (D.dirty && D.dirty.count)
    ? D.dirty.count + ' uncommitted file' + (D.dirty.count!==1?'s':'') + ' + '
    : '';
  cancelPlan.title = 'Abandon this plan: archive it and DELETE its branch/worktree'
    + (dirtyWarn ? ' \\u2014 \\u26a0 ' + dirtyWarn + 'unmerged commits will be lost' : '');
  confirmButton(cancelPlan, '\\u26a0 Deletes ' + dirtyWarn + 'branch \\u2014 click again', () =>
    action('cancel-plan', null, 'Cancelling plan'));
  bar.insertBefore(cancelPlan, bar.querySelector('.pbar'));
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
  renderRetired(w);
}

// Retired plans: read-only history browser (view-archive opens the archive view).
function renderRetired(w){
  const R = D.retired || [];
  if(!R.length) return;
  const t = document.createElement('div'); t.className='sec-title'; t.textContent='Retired plans';
  w.appendChild(t);
  R.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card done';
    card.innerHTML = '<div class="ch"><span class="cn">'+esc(r.title||r.name)+'</span>'+
      '<span class="chip cmut">'+esc(r.name)+'</span>'+
      (r.created?'<span class="chip cg">retired · created '+esc(r.created)+'</span>':'<span class="chip cg">retired</span>')+'</div>';
    const btns = document.createElement('div'); btns.className='btns';
    const open = document.createElement('button');
    open.className = 'act'; open.textContent = 'Read through';
    open.addEventListener('click', () => action('view-archive', r.name, 'Opening retired plan'));
    btns.appendChild(open);
    card.appendChild(btns);
    w.appendChild(card);
  });
}

function makeCard(c){
  const card = document.createElement('div');
  card.className = 'card' + (c.status==='done'?' done':'');
  const ready = depsDone(c);
  const draft = c.status==='draft';
  const icon = '<i class="st '+(c.status==='done'?'done':draft?'draft':'pending')+'"></i>';
  card.innerHTML =
    '<div class="ch"><span class="cn">'+icon+esc(c.title||c.name)+'</span>'+
      '<span class="chip cmut">'+esc(c.name)+'</span>'+
      (draft?'<span class="chip cy">draft</span>':'')+sizeChip(c)+testBadge(c)+
      (c.conflicts?'<span class="chip cr" title="This chunk contradicts a project decision — check its Decision conflicts section">\\u26a0 '+c.conflicts+' decision conflict'+(c.conflicts!==1?'s':'')+'</span>':'')+'</div>'+
    '<div class="cdesc">'+esc(c.description||'')+'</div>'+
    ((c.dependsOn&&c.dependsOn.length)?'<div class="deps">depends on '+c.dependsOn.map(d=>'<code>'+esc(d)+'</code>').join(' ')+'</div>':'');

  const btns = document.createElement('div');
  btns.className = 'btns';

  const impl = document.createElement('button');
  impl.className = 'act primary-act';
  impl.textContent = 'Implement';
  if(c.status==='done'){ impl.disabled = true; impl.title = 'Already done'; }
  else if(draft){ impl.disabled = true; impl.title = 'Draft — accept the chunk set first (Re-chunk)'; }
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
  if(draft){ test.disabled = true; test.title = 'Draft — accept the chunk set first'; }
  test.addEventListener('click', () => action('test', c.name, 'Starting /iterator-test'));

  const rev = document.createElement('button');
  rev.className = 'act';
  rev.textContent = 'Review';
  if(!c.hasDiff && !c.hasCommits){ rev.disabled = true; rev.title = 'Nothing to review — no working-tree changes or recorded commits'; }
  rev.addEventListener('click', () => action('review', c.name, 'Starting /iterator-review'));

  const cancel = document.createElement('button');
  cancel.className = 'act danger';
  cancel.textContent = 'Cancel';
  cancel.title = 'Remove this chunk from the plan (its file is archived; dependents are unwired)';
  confirmButton(cancel, 'Really cancel \\u2014 click again', () =>
    action('cancel-chunk', c.name, 'Cancelling chunk'));

  btns.appendChild(impl); btns.appendChild(test); btns.appendChild(rev); btns.appendChild(cancel);
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

export function render(data) {
  return renderPage({
    step: 'hub', subtitle: '/ dashboard', branch: data.branch,
    title: data.plan && data.plan.title,
    data, css: CSS, body: BODY, clientJs: JS,
    primary: false, // the per-card action buttons are the primaries here
  });
}
