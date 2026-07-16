/**
 * iterator: hub dashboard UI on the shared shell (../ui.mjs,
 * ../server.mjs). Read-only home screen for the whole flow: shows the
 * plan, the feature cards with status/size/test badges, and the dependency
 * graph; the user picks one action and the server exits with it (standard
 * one-shot round trip — the SKILL.md dispatches into the chosen flow and
 * re-opens this dashboard when it finishes).
 *
 *   input:  { step:"hub", branch,
 *             plan: { title, status } | null,      // null = no bundle yet
 *             progress: { done, total },
 *             knowledgeInitialized,                // memory/ knowledge side exists
 *             dirty: { count, files },             // working-tree files outside the bundle
 *             features: [ { name, title, description, status, size,
 *                         testsStatus,                  // none | red | green
 *                         dependsOn, hasDiff, hasCommits,
 *                         conflicts } ] }               // # of flagged decision conflicts
 *             retired: [ { name, title, created } ]   // archived plans, newest first
 *   output: one JSON line to stdout —
 *     { type:"action", action:"plan"|"feature"|"test"|"implement"|"review"|"iterator-init"
 *                             |"view-archive"        // feature = archive name for view-archive
 *                             |"auto-implement"      // run the whole loop agent-driven
 *                             |"cancel-feature"        // archive one feature (deterministic)
 *                             |"cancel-plan",        // abandon plan + delete branch/worktree (deterministic)
 *       feature:"<slug>"|null,
 *       prompt:"<typed plan goal>"|null }          // hero goal box, plan/iterator-init only
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from "../ui.mjs";

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
.hero textarea.goal{display:block;width:100%;max-width:640px;margin:0 auto var(--sp-4);padding:12px 14px;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);color:var(--text);
  font-size:var(--fs-sm);font-family:inherit;resize:vertical;min-height:132px;outline:none;line-height:1.5;text-align:left}
.hero textarea.goal:focus{border-color:var(--accent)}
.goal-wrap{position:relative;width:100%;max-width:640px;margin:0 auto var(--sp-4)}
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
.st.implemented{background:var(--accent)}
.st.pending{background:transparent;border:2px solid var(--border)}
.escalation{background:var(--bg-red);border:1px solid var(--del-fg);border-radius:var(--radius-card);padding:14px var(--sp-4);display:grid;gap:var(--sp-2)}
.escalation .et{font-weight:600;color:var(--del-fg)}
.escalation .er{font-size:var(--fs-sm);white-space:pre-wrap}
.escalation .em{font-size:var(--fs-xs);color:var(--text-muted)}
.escalation textarea{width:100%;min-height:56px;resize:vertical;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text);font:inherit;font-size:var(--fs-sm)}
.backlog{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:var(--sp-4);margin-top:var(--sp-5)}
.backlog-head{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap;margin-bottom:var(--sp-3)}
.backlog-head h2{font-size:var(--fs-md);font-weight:600}.backlog-head p{font-size:var(--fs-xs);color:var(--text-muted)}
.backlog-form{display:grid;grid-template-columns:120px minmax(180px,1fr);gap:var(--sp-2);align-items:start}
.backlog-form select,.backlog-form input,.backlog-form textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text);font:inherit;font-size:var(--fs-sm)}
.backlog-form textarea{min-height:64px;resize:vertical;grid-column:1/-1}.backlog-form .btns{grid-column:1/-1}.backlog-list{display:grid;gap:var(--sp-2);margin-top:var(--sp-4)}
.backlog-item{border-top:1px solid var(--border);padding-top:var(--sp-3)}.backlog-item:first-child{border-top:0;padding-top:0}
.backlog-item-main{display:flex;gap:var(--sp-2);align-items:flex-start}.backlog-item-main input{margin-top:4px}.backlog-item-title{font-size:var(--fs-sm);font-weight:600}.backlog-item-details{font-size:var(--fs-xs);color:var(--text-muted);margin-top:2px;white-space:pre-wrap}.backlog-empty{font-size:var(--fs-sm);color:var(--text-muted)}
@media(max-width:640px){.backlog-form{grid-template-columns:1fr}.backlog-form textarea,.backlog-form .btns{grid-column:auto}}
`;

const BODY = `
<div class="wrap" id="wrap"></div>
`;

const JS = `
const CH = D.features || [];
const byName = {}; CH.forEach(c => byName[c.name] = c);

function action(act, feature, msg, prompt){
  post({ type:'action', action: act, feature: feature || null, prompt: prompt || null }, msg || 'Sent to Claude');
}
function backlogAction(payload, button, message){
  if(button){ button.disabled = true; button.dataset.label = button.textContent; button.textContent = 'Saving…'; }
  post({ type:'backlog', ...payload }, message || 'Saved');
}
function selectedBacklogGoal(){
  const selected = (D.backlog || []).filter(item => item.selected);
  if(!selected.length) return null;
  return 'Create a plan from these saved backlog candidates:\\n\\n' + selected.map(item =>
    '[' + item.kind + '] ' + item.title + (item.details ? '\\n' + item.details : '')).join('\\n\\n');
}
// A dependency satisfies its dependents when done — or merely implemented,
// when the review_required setting is off.
function depSatisfied(s){
  return s==='done' || (s==='implemented' && D.settings && D.settings.review_required==='off');
}
function depsDone(c){ return (c.dependsOn||[]).every(d => byName[d] && depSatisfied(byName[d].status)); }
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
    // The Work iframe is recreated on every tab switch/refresh — keep the
    // unsent goal in browser storage, cleared only once a plan actually starts.
    const DRAFT_KEY = 'iterator:plan-goal-draft:' + (D.branch || '');
    try { goal.value = localStorage.getItem(DRAFT_KEY) || ''; } catch(e){}
    const saveDraft = () => { try {
      if(goal.value) localStorage.setItem(DRAFT_KEY, goal.value);
      else localStorage.removeItem(DRAFT_KEY);
    } catch(e){} };
    goal.addEventListener('input', saveDraft);
    goal.addEventListener('blur', saveDraft);
    const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch(e){} };
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
      note.textContent = '\\u26a0 Project memory is not initialized yet \\u2014 initialize it first so plans and features can load relevant knowledge.';
      hero.insertBefore(note, goal);
      const init = document.createElement('button');
      init.className = 'act primary-act'; init.textContent = 'Initialize memory';
      init.addEventListener('click', () =>
        post({ type:'action', action:'iterator-init', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-init')
          .then(() => { if(__submitted) clearDraft(); }));
      btns.appendChild(init);
    }
    const b = document.createElement('button');
    b.className = 'act' + (D.knowledgeInitialized ? ' primary-act' : ''); b.textContent = 'Create plan';
    b.addEventListener('click', () =>
      post({ type:'action', action:'plan', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-plan')
        .then(() => { if(__submitted) clearDraft(); }));
    btns.appendChild(b);
    hero.appendChild(btns);
    w.appendChild(hero);
    renderBacklog(w);
    renderRetired(w);
    return;
  }

  // Escalation banner: auto mode stopped and needs a human decision — say
  // which feature, why, and offer the two recovery paths right here.
  if(D.state && D.state.phase==='escalated' && D.state.escalation){
    const e = D.state.escalation;
    const box = document.createElement('div');
    box.className = 'escalation';
    box.innerHTML = '<div class="et">\\u26a0 Needs your attention'+(e.feature?' \\u2014 '+esc(e.feature):'')+'</div>'+
      '<div class="er">'+esc(e.reason||'Auto mode stopped.')+'</div>'+
      (e.at?'<div class="em">escalated '+esc(e.at)+'</div>':'');
    const btns = document.createElement('div'); btns.className='btns';
    if(e.feature){
      const restart = document.createElement('button');
      restart.className = 'act danger';
      restart.textContent = 'Discard changes & restart feature';
      restart.title = 'Throw away the feature\\u2019s working-tree changes, reset it to pending, and continue';
      confirmButton(restart, '\\u26a0 Discards its changes \\u2014 click again', () =>
        action('escalation-restart', e.feature, 'Restarting feature'));
      btns.appendChild(restart);
    }
    const ta = document.createElement('textarea');
    ta.placeholder = 'Guide the agent: what should it do differently?';
    const guide = document.createElement('button');
    guide.className = 'act primary-act';
    guide.textContent = 'Guide';
    guide.title = 'Resume the flow with your instructions';
    guide.addEventListener('click', () => {
      if(!ta.value.trim()) { ta.focus(); return; }
      action('escalation-guide', e.feature || null, 'Resuming with guidance', ta.value.trim());
    });
    btns.appendChild(guide);
    box.appendChild(ta);
    box.appendChild(btns);
    w.appendChild(box);
  }

  // plan bar
  const done = (D.progress&&D.progress.done)||0, total = (D.progress&&D.progress.total)||CH.length;
  const bar = document.createElement('div');
  bar.className = 'planbar';
  bar.innerHTML = '<span class="pt">'+esc(D.plan.title||'Plan')+'</span>'+
    '<span class="pst '+(D.plan.status==='approved'?'approved':'draft')+'">'+esc(D.plan.status||'draft')+'</span>'+
    (total
      ? '<span class="pcount">'+done+' / '+total+' features done</span>'+
        '<div class="pbar"><div style="width:'+Math.round(done/total*100)+'%"></div></div>'
      : '<span class="pcount">not broken into features yet</span>');
  const revise = document.createElement('button');
  revise.className='act'; revise.textContent='Revise plan';
  revise.addEventListener('click', () => action('plan', null, 'Starting /iterator-plan'));
  // Before featuring, this button IS the continue action — make it read and
  // look like one instead of a "Re-feature" that has nothing to redo.
  const refeature = document.createElement('button');
  refeature.className = CH.length ? 'act' : 'act primary-act';
  refeature.textContent = CH.length ? 'Re-feature' : 'Feature the plan';
  refeature.title = CH.length
    ? 'Redraw the feature set from the plan (/iterator-feature)'
    : 'Next step: break the approved plan into small, dependency-ordered features (/iterator-feature)';
  refeature.addEventListener('click', () => action('feature', null, 'Starting /iterator-feature'));
  bar.insertBefore(refeature, bar.querySelector('.pbar'));
  bar.insertBefore(revise, refeature);
  // Auto mode: once the feature set is approved (pending features exist), the
  // whole test → implement → review loop can run agent-driven.
  const pendingReady = CH.some(c => c.status==='pending');
  if(pendingReady){
    const auto = document.createElement('button');
    auto.className = 'act primary-act';
    auto.textContent = 'Implement all (auto)';
    auto.title = 'Run test \\u2192 implement \\u2192 review for every feature automatically; a reviewer agent stands in for you until escalation';
    auto.addEventListener('click', () => action('auto-implement', null, 'Starting auto mode'));
    bar.insertBefore(auto, bar.querySelector('.pbar'));
  }
  // Tight git flow: surface working-tree dirt so leftovers never linger silently.
  if(D.dirty && D.dirty.count){
    const dw = document.createElement('span');
    dw.className = 'chip cy';
    dw.textContent = '\\u26a0 ' + D.dirty.count + ' uncommitted file' + (D.dirty.count!==1?'s':'');
    dw.title = 'Changes sitting uncommitted in the git working tree (independent of feature progress) \\u2014 the flow commits per feature, so tidy these before accepting:\\n' + (D.dirty.files||[]).join('\\n');
    bar.insertBefore(dw, bar.querySelector('.pbar'));
  }
  // Every feature implemented or done → the whole-plan review: check the
  // changes and commits against the plan's goals before retiring.
  const allLanded = total > 0 && CH.every(c => c.status==='implemented' || c.status==='done');
  if(allLanded){
    const rp = document.createElement('button');
    rp.className = 'act primary-act';
    rp.textContent = D.plan.planReviewed ? 'Re-review plan' : 'Review plan';
    rp.title = D.plan.planReviewed
      ? 'Plan reviewed '+D.plan.planReviewed+' \\u2014 run the whole-plan review again'
      : 'Review all changes and commits against the plan\\u2019s goals and decisions';
    rp.addEventListener('click', () => action('review-plan', null, 'Starting /iterator-review-plan'));
    bar.insertBefore(rp, bar.querySelector('.pbar'));
  }
  // Every feature done → the plan is finished work: offer condensing it into a
  // decisions/ concept and archiving the feature files (write.mjs retire-plan).
  // The click (plus the armed confirm) IS the confirmation — the CLI side asks
  // nothing further.
  if(total > 0 && done === total){
    const retire = document.createElement('button');
    retire.className='act primary-act'; retire.textContent='Retire plan';
    retire.title='Condense the finished plan into a decisions/ memory and archive its features';
    confirmButton(retire, 'Retires the plan \\u2014 click again', () =>
      action('retire', null, 'Starting plan retirement'));
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
  renderBacklog(w);

  // graph
  const gt = document.createElement('div'); gt.className='sec-title'; gt.textContent='Dependency graph';
  const cw = document.createElement('div'); cw.id='cyclewarn';
  const g = document.createElement('div'); g.className='graph'; g.id='graph';
  w.appendChild(gt); w.appendChild(cw); w.appendChild(g);
  renderGraph();

  // cards
  const ct = document.createElement('div'); ct.className='sec-title'; ct.textContent='Features';
  w.appendChild(ct);
  if(!CH.length){
    const e = document.createElement('div'); e.className='hero';
    e.innerHTML = '<h2>No features yet</h2><p>The plan has not been broken into features.</p>';
    const b = document.createElement('button');
    b.className='act primary-act'; b.textContent='Feature the plan';
    b.addEventListener('click', () => action('feature', null, 'Starting /iterator-feature'));
    e.appendChild(b); w.appendChild(e);
    return;
  }
  CH.forEach(c => w.appendChild(makeCard(c)));
  renderRetired(w);
}

// Retired plans: read-only history browser (view-archive opens the archive view).
function renderBacklog(w){
  const items = Array.isArray(D.backlog) ? D.backlog : [];
  const section = document.createElement('section'); section.className = 'backlog';
  section.innerHTML = '<div class="backlog-head"><div><h2>Idea backlog</h2><p>Saved ideas and bugs stay separate from active plan features.</p></div></div>';
  const form = document.createElement('form'); form.className = 'backlog-form';
  form.innerHTML = '<select aria-label="Candidate type"><option value="idea">Idea</option><option value="bug">Bug</option></select>'+
    '<input required maxlength="160" placeholder="Short title" aria-label="Backlog title">'+
    '<textarea maxlength="4000" placeholder="Why it matters, context, or a repro" aria-label="Backlog details"></textarea>'+
    '<div class="btns"><button class="act primary-act" type="submit">Save candidate</button><button class="act" type="button" hidden>Cancel edit</button></div>';
  const [kind, title, details] = form.querySelectorAll('select,input,textarea');
  const [save, cancel] = form.querySelectorAll('button');
  let editing = null;
  const reset = () => { editing = null; form.reset(); save.textContent = 'Save candidate'; cancel.hidden = true; };
  form.addEventListener('submit', event => {
    event.preventDefault();
    backlogAction({ action: editing ? 'edit' : 'create', ...(editing ? { id: editing } : {}), kind: kind.value, title: title.value, details: details.value }, save, editing ? 'Candidate updated' : 'Candidate saved');
  });
  cancel.addEventListener('click', reset);
  section.appendChild(form);
  const list = document.createElement('div'); list.className = 'backlog-list';
  if(!items.length) list.innerHTML = '<p class="backlog-empty">No saved candidates yet.</p>';
  for(const item of items){
    const row = document.createElement('div'); row.className = 'backlog-item';
    row.innerHTML = '<div class="backlog-item-main"><input type="checkbox" aria-label="Select '+esc(item.title)+'" '+(item.selected?'checked':'')+'><div><div class="backlog-item-title">'+esc(item.title)+' <span class="chip cmut">'+esc(item.kind)+'</span></div><div class="backlog-item-details">'+esc(item.details || '')+'</div></div></div>';
    const toggle = row.querySelector('input');
    toggle.addEventListener('change', () => backlogAction({ action:'select', id:item.id, selected:toggle.checked }, toggle, toggle.checked ? 'Candidate selected' : 'Candidate deselected'));
    const buttons = document.createElement('div'); buttons.className = 'btns';
    const edit = document.createElement('button'); edit.className = 'act'; edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => { editing = item.id; kind.value = item.kind; title.value = item.title; details.value = item.details || ''; save.textContent = 'Update candidate'; cancel.hidden = false; title.focus(); });
    const remove = document.createElement('button'); remove.className = 'act danger'; remove.type = 'button'; remove.textContent = 'Delete';
    confirmButton(remove, 'Really delete — click again', () => backlogAction({ action:'delete', id:item.id }, remove, 'Candidate deleted'));
    buttons.append(edit, remove); row.appendChild(buttons); list.appendChild(row);
  }
  section.appendChild(list);
  const goal = selectedBacklogGoal();
  if(goal){
    const handoff = document.createElement('button'); handoff.className = 'act primary-act'; handoff.type = 'button';
    handoff.textContent = D.plan ? 'Selected candidates saved' : 'Plan selected candidates';
    handoff.title = D.plan ? 'Retire or finish the active plan before starting a new one.' : 'Start a new plan with the selected candidates as its initial goal.';
    handoff.disabled = Boolean(D.plan);
    handoff.addEventListener('click', () => action('plan', null, 'Starting /iterator-plan from backlog', goal));
    section.appendChild(handoff);
  }
  w.appendChild(section);
}

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
  const implemented = c.status==='implemented';
  const icon = '<i class="st '+(c.status==='done'?'done':draft?'draft':implemented?'implemented':'pending')+'"></i>';
  card.innerHTML =
    '<div class="ch"><span class="cn">'+icon+esc(c.title||c.name)+'</span>'+
      '<span class="chip cmut">'+esc(c.name)+'</span>'+
      (draft?'<span class="chip cy">draft</span>':'')+
      (implemented?'<span class="chip cy">implemented \\u2014 awaiting review</span>':'')+sizeChip(c)+testBadge(c)+
      (c.conflicts?'<span class="chip cr" title="This feature contradicts a project decision — check its Decision conflicts section">\\u26a0 '+c.conflicts+' decision conflict'+(c.conflicts!==1?'s':'')+'</span>':'')+'</div>'+
    '<div class="cdesc">'+esc(c.description||'')+'</div>'+
    ((c.dependsOn&&c.dependsOn.length)?'<div class="deps">depends on '+c.dependsOn.map(d=>'<code>'+esc(d)+'</code>').join(' ')+'</div>':'');

  const btns = document.createElement('div');
  btns.className = 'btns';

  const impl = document.createElement('button');
  impl.className = 'act primary-act';
  impl.textContent = 'Implement';
  if(c.status==='done'){ impl.disabled = true; impl.title = 'Already done'; }
  else if(implemented){ impl.disabled = true; impl.title = 'Implemented — review it'; }
  else if(draft){ impl.disabled = true; impl.title = 'Draft — accept the feature set first (Re-feature)'; }
  else if(!ready){
    impl.disabled = true;
    impl.title = 'Waiting on: '+(c.dependsOn||[]).filter(d=>!byName[d]||!depSatisfied(byName[d].status)).join(', ');
  }
  impl.addEventListener('click', () => action('implement', c.name, 'Starting /iterator-implement — you can close this tab'));

  const test = document.createElement('button');
  test.className = 'act';
  test.textContent = c.status==='pending' ? 'Test (red)' : 'Test';
  test.title = c.status==='pending'
    ? 'Write failing tests from the feature contract before implementing'
    : 'Write passing tests against the implemented feature';
  if(draft){ test.disabled = true; test.title = 'Draft — accept the feature set first'; }
  test.addEventListener('click', () => action('test', c.name, 'Starting /iterator-test'));

  const rev = document.createElement('button');
  rev.className = implemented ? 'act primary-act' : 'act';
  rev.textContent = 'Review';
  // Review follows implementation: enabled once the feature is implemented
  // (its working-tree diff awaits review) or done with commits (re-review).
  if(implemented){ rev.title = 'Review the implementation, then accept to commit'; }
  else if(c.status==='done' && c.hasCommits){ rev.title = 'Re-review the feature\\u2019s commits'; }
  else { rev.disabled = true; rev.title = 'Implement first — review unlocks once the feature is implemented'; }
  rev.addEventListener('click', () => action('review', c.name, 'Starting /iterator-review'));

  const cancel = document.createElement('button');
  cancel.className = 'act danger';
  cancel.textContent = 'Cancel';
  cancel.title = 'Remove this feature from the plan (its file is archived; dependents are unwired)';
  confirmButton(cancel, 'Really cancel \\u2014 click again', () =>
    action('cancel-feature', c.name, 'Cancelling feature'));

  btns.appendChild(impl); btns.appendChild(test); btns.appendChild(rev); btns.appendChild(cancel);
  card.appendChild(btns);
  return card;
}

// dependency graph — same layered layout as the /iterator-feature UI
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
  if(!CH.length){ g.innerHTML='<span style="color:var(--text-muted);font-size:13px">No features yet.</span>'; cw.innerHTML=''; return; }
  const { level, cycle } = computeLevels();
  cw.innerHTML = cycle ? '<div class="cyclewarn">⚠️ Dependency cycle detected — fix depends-on in /iterator-feature before implementing.</div>' : '';
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
		step: "hub",
		subtitle: "/ dashboard",
		branch: data.branch,
		title: data.plan && data.plan.title,
		data,
		css: CSS,
		body: BODY,
		clientJs: JS,
		primary: false, // the per-card action buttons are the primaries here
		cancel: false, // idle dashboard — there is no round to cancel
	});
}
