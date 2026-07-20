/**
 * iterator: Work dashboard UI on the shared shell (../ui.mjs,
 * ../server.mjs). The execution surface of the flow: the active plan's
 * progress, dependency graph, and feature cards with their Test / Implement /
 * Review actions. Work owns active-plan progress, lifecycle controls, and
 * feature management; Planning owns backlog, future planning, and archives.
 * Both surfaces render from the same gather payload so they cannot disagree
 * about state.
 *
 *   input:  { step:"hub", branch,
 *             plan: { title, status } | null,      // null = no bundle yet
 *             stage,                               // server-derived lifecycle stage
 *             progress: { done, total },
 *             knowledgeInitialized,                // memory/ knowledge side exists
 *             dirty: { count, files },             // working-tree files outside the bundle
 *             features: [ { name, title, description, status, size,
 *                         testsStatus,                  // none | red | green
 *                         tests, testCount,              // recorded red/green test targets
 *                         dependsOn, ready, waitingOn,  // server-computed readiness
 *                         hasDiff, hasCommits,
 *                         conflicts } ] }               // # of flagged decision conflicts
 *             retired: [ { name, title, created } ]   // archived plans, newest first
 *   output: one JSON line to stdout —
 *     { type:"action", action:"planning"|"plan"|"feature"|"test"|"implement"|"review"|"review-all"
 *       |"review-plan"|"retire"|"implement-wave"|"auto-implement"|"cancel-plan"|"cancel-feature"
 *       |"escalation-restart"|"escalation-guide",
 *       feature:"<slug>"|null,
 *       prompt:"<guidance>"|null }                 // escalation-guide only
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from "../ui.mjs";
import { GRAPH_CSS, GRAPH_JS } from "./graph.mjs";
import { WIDGETS_CSS, WIDGETS_JS } from "./widgets.mjs";

const CSS = `
.escalation{background:var(--bg-red);border:1px solid var(--del-fg);border-radius:var(--radius-card);padding:14px var(--sp-4);display:grid;gap:var(--sp-2)}
.escalation .et{font-weight:600;color:var(--del-fg)}
.escalation .er{font-size:var(--fs-sm);white-space:pre-wrap}
.escalation .em{font-size:var(--fs-xs);color:var(--text-muted)}
.escalation textarea{width:100%;min-height:56px;resize:vertical;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text);font:inherit;font-size:var(--fs-sm)}
`;

const BODY = `
<div class="wrap" id="wrap"></div>
`;

const JS = `
const CH = D.features || [];

// Readiness (ready/waitingOn) and the plan stage arrive precomputed in the
// gather payload — the server owns every status rule, views only render.

render();

function render(){
  const w = document.getElementById('wrap');
  w.innerHTML = '';
  if(!D.plan){
    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.innerHTML = '<h2>Nothing in progress</h2><p>There is no active plan to work on.<br>Collect ideas and start a plan on the Planning tab.</p>';
    const b = document.createElement('button');
    b.className = 'act primary-act'; b.textContent = 'Open planning';
    b.addEventListener('click', () => action('planning', null, 'Opening planning'));
    hero.appendChild(b);
    w.appendChild(hero);
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

  // Work keeps active-plan progress, lifecycle, and execution controls in one
  // plan bar; Planning remains a staging and archive surface.
  const done = (D.progress&&D.progress.done)||0, total = (D.progress&&D.progress.total)||CH.length;
  const bar = document.createElement('div');
  bar.className = 'planbar';
  bar.innerHTML = '<span class="pt">'+esc(D.plan.title||'Plan')+'</span>'+
    '<span class="pst '+(D.plan.status==='approved'?'approved':'draft')+'">'+esc(D.plan.status||'draft')+'</span>'+
    (total
      ? '<span class="pcount">'+done+' / '+total+' features done</span>'+
        '<div class="pbar"><div style="width:'+Math.round(done/total*100)+'%"></div></div>'
      : '<span class="pcount">not broken into features yet</span>');
  // Active-plan lifecycle belongs with its progress and feature work. Every
  // condition is the server-derived stage; this view never infers it.
  const revise = document.createElement('button');
  revise.className = 'act';
  revise.textContent = 'Revise plan';
  revise.addEventListener('click', () => action('plan', null, 'Starting /iterator-plan'));
  bar.appendChild(revise);
  const refeature = document.createElement('button');
  refeature.className = D.stage==='needs-features' ? 'act primary-act' : 'act';
  refeature.textContent = D.stage==='needs-features' ? 'Feature the plan' : 'Re-feature';
  refeature.title = D.stage==='needs-features'
    ? 'Next step: break the approved plan into small, dependency-ordered features (/iterator-feature)'
    : 'Redraw the feature set from the plan (/iterator-feature)';
  refeature.addEventListener('click', () => action('feature', null, 'Starting /iterator-feature'));
  bar.appendChild(refeature);
  if(D.stage==='awaiting-plan-review' || D.stage==='retirable'){
    const reviewPlan = document.createElement('button');
    reviewPlan.className = 'act primary-act';
    reviewPlan.textContent = D.plan.planReviewed ? 'Re-review plan' : 'Review plan';
    reviewPlan.title = D.plan.planReviewed
      ? 'Plan reviewed '+D.plan.planReviewed+' \\u2014 run the whole-plan review again'
      : 'Review all changes and commits against the plan\\u2019s goals and decisions';
    reviewPlan.addEventListener('click', () => action('review-plan', null, 'Starting /iterator-review-plan'));
    bar.appendChild(reviewPlan);
  }
  if(D.stage==='retirable'){
    const retire = document.createElement('button');
    retire.className = 'act primary-act';
    retire.textContent = 'Retire plan';
    retire.title = 'Condense the finished plan into a decisions/ memory and archive its features';
    confirmButton(retire, 'Retires the plan \\u2014 click again', () =>
      action('retire', null, 'Starting plan retirement'));
    bar.appendChild(retire);
  }
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
  bar.appendChild(cancelPlan);

  // Auto mode: once the feature set is approved (pending features exist), the
  // whole test → implement → review loop can run agent-driven.
  const readyWave = Array.isArray(D.readyWave) ? D.readyWave : [];
  if(readyWave.length){
    const wave = document.createElement('button');
    wave.className = 'act primary-act';
    wave.textContent = 'Implement next wave';
    wave.title = 'Implement the '+readyWave.length+' feature'+(readyWave.length!==1?'s':'')+' that are dependency-ready now; review remains a separate explicit step';
    wave.addEventListener('click', () => action('implement-wave', null, 'Implementing next ready wave'));
    bar.insertBefore(wave, bar.querySelector('.pbar'));

    const auto = document.createElement('button');
    auto.className = 'act';
    auto.textContent = 'Implement all (auto)';
    auto.title = 'Run test \\u2192 implement \\u2192 review for every feature automatically; a reviewer agent stands in for you until escalation';
    auto.addEventListener('click', () => action('auto-implement', null, 'Starting auto mode'));
    bar.insertBefore(auto, bar.querySelector('.pbar'));
  }
  const reviewWave = Array.isArray(D.reviewWave) ? D.reviewWave : [];
  if(reviewWave.length > 1){
    const reviewAll = document.createElement('button');
    reviewAll.className = 'act primary-act';
    reviewAll.textContent = 'Review all';
    reviewAll.title = 'Open one review with a feature selector and commit-backed diffs for '+reviewWave.length+' implemented features';
    reviewAll.addEventListener('click', () => action('review-all', null, 'Opening consolidated review'));
    bar.insertBefore(reviewAll, bar.querySelector('.pbar'));
  }
  // Tight git flow: surface working-tree dirt so leftovers never linger silently.
  if(D.dirty && D.dirty.count){
    const dw = document.createElement('span');
    dw.className = 'chip cy';
    dw.textContent = '\\u26a0 ' + D.dirty.count + ' uncommitted file' + (D.dirty.count!==1?'s':'');
    dw.title = 'Changes sitting uncommitted in the git working tree (independent of feature progress) \\u2014 the flow commits per feature, so tidy these before accepting:\\n' + (D.dirty.files||[]).join('\\n');
    bar.insertBefore(dw, bar.querySelector('.pbar'));
  }
  w.appendChild(bar);

  // Active dependency structure belongs beside execution status. Readiness and
  // dependencies are supplied by gather; this view only renders them.
  const gt = document.createElement('div'); gt.className='sec-title'; gt.textContent='Dependency graph';
  const cw = document.createElement('div'); cw.id='cyclewarn';
  const g = document.createElement('div'); g.className='graph'; g.id='graph';
  w.appendChild(gt); w.appendChild(cw); w.appendChild(g);
  renderGraphInto(g, cw, CH, 'fix depends-on in /iterator-feature before implementing.');

  // cards
  const ct = document.createElement('div'); ct.className='sec-title'; ct.textContent='Features';
  w.appendChild(ct);
  if(!CH.length){
    const e = document.createElement('div'); e.className='hero';
    e.innerHTML = '<h2>No features yet</h2><p>Break the plan into features on the Planning tab.</p>';
    const b = document.createElement('button');
    b.className='act primary-act'; b.textContent='Open planning';
    b.addEventListener('click', () => action('planning', null, 'Opening planning'));
    e.appendChild(b); w.appendChild(e);
    return;
  }
  CH.forEach(c => w.appendChild(makeCard(c)));
}

function makeCard(c){
  const card = document.createElement('div');
  card.className = 'card' + (c.status==='done'?' done':'');
  const ready = c.ready !== false;
  const draft = c.status==='draft';
  const implemented = c.status==='implemented';
  const icon = '<i class="st '+(c.status==='done'?'done':draft?'draft':implemented?'implemented':'pending')+'"></i>';
  const redTarget = c.testsStatus==='red'
    ? '<div class="deps"><strong>Committed red tests — implementation target:</strong> '+
      ((c.tests&&c.tests.length) ? c.tests.map(t=>'<code>'+esc(t)+'</code>').join(' ') : esc(String(c.testCount||0))+' test'+(c.testCount===1?'':'s'))+'</div>'
    : '';
  card.innerHTML =
    '<div class="ch"><span class="cn">'+icon+esc(c.title||c.name)+'</span>'+
      '<span class="chip cmut">'+esc(c.name)+'</span>'+
      (draft?'<span class="chip cy">draft</span>':'')+
      (implemented?'<span class="chip cy">implemented \\u2014 awaiting review</span>':'')+
      (implemented&&!c.hasDiff&&!c.hasCommits?'<span class="chip cr" title="Marked implemented, but review would find nothing: no working-tree diff and no recorded commits. Usual causes: the work was committed outside the accept flow (no Feature: trailer) or landed in a different checkout (plan worktree vs main). Check git log for its files, or Restart the feature.">\\u26a0 no recorded changes</span>':'')+
      sizeChip(c)+testBadge(c)+
      (c.conflicts?'<span class="chip cr" title="This feature contradicts a project decision — check its Decision conflicts section">\\u26a0 '+c.conflicts+' decision conflict'+(c.conflicts!==1?'s':'')+'</span>':'')+'</div>'+
    '<div class="cdesc">'+esc(c.description||'')+'</div>'+redTarget+
    ((c.dependsOn&&c.dependsOn.length)?'<div class="deps">depends on '+c.dependsOn.map(d=>'<code>'+esc(d)+'</code>').join(' ')+'</div>':'');

  const btns = document.createElement('div');
  btns.className = 'btns';

  const impl = document.createElement('button');
  impl.className = 'act primary-act';
  impl.textContent = c.testsStatus==='red' ? 'Drive tests green' : 'Implement';
  if(c.testsStatus==='red') impl.title = 'Run the committed, intentionally failing tests and make them pass';
  if(c.status==='done'){ impl.disabled = true; impl.title = 'Already done'; }
  else if(implemented){ impl.disabled = true; impl.title = 'Implemented — review it'; }
  else if(draft){ impl.disabled = true; impl.title = 'Draft — accept the feature set first (Re-feature on the Planning tab)'; }
  else if(!ready){
    impl.disabled = true;
    impl.title = 'Waiting on: '+(c.waitingOn||[]).join(', ');
  }
  impl.addEventListener('click', () => action('implement', c.name, 'Starting /iterator-implement — you can close this tab'));

  const test = document.createElement('button');
  test.className = 'act';
  test.textContent = c.testsStatus==='red' ? 'Tests committed (red)' : (c.status==='pending' ? 'Test (red)' : 'Test');
  test.title = c.testsStatus==='red'
    ? 'Committed red tests are the implementation target — drive them green'
    : c.status==='pending'
      ? 'Write failing tests from the feature contract before implementing'
      : 'Write passing tests against the implemented feature';
  if(c.testsStatus==='red'){ test.disabled = true; }
  else if(draft){ test.disabled = true; test.title = 'Draft — accept the feature set first'; }
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
  cancel.textContent = 'Cancel feature';
  cancel.title = 'Remove this feature from the plan (its file is archived; dependents are unwired)';
  confirmButton(cancel, 'Really cancel \\u2014 click again', () =>
    action('cancel-feature', c.name, 'Cancelling feature'));

  btns.appendChild(impl); btns.appendChild(test); btns.appendChild(rev); btns.appendChild(cancel);
  card.appendChild(btns);
  return card;
}
`;

export function render(data) {
	return renderPage({
		step: "hub",
		subtitle: "/ work",
		branch: data.branch,
		title: data.plan && data.plan.title,
		data,
		css: WIDGETS_CSS + GRAPH_CSS + CSS,
		body: BODY,
		clientJs: WIDGETS_JS + GRAPH_JS + JS,
		primary: false, // the per-card action buttons are the primaries here
		cancel: false, // idle dashboard — there is no round to cancel
	});
}
