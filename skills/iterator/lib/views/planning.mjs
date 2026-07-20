/**
 * iterator: planning UI on the shared shell (../ui.mjs, ../server.mjs).
 * The plan-management surface: where ideas and bugs are collected (backlog),
 * plans are created, revised, featured, reviewed, retired, or cancelled.
 * Active plan features, dependency structure, and execution controls live on
 * the Work surface (./hub.mjs).
 *
 * Rendered from the SAME gather payload as the hub (gather --step planning
 * just stamps step:"planning"), so the two surfaces can never disagree about
 * state: plan {title,status}, stage (server-derived lifecycle), progress,
 * features (status/size/tests/ready/waitingOn), backlog, retired, dirty.
 *
 *   output: one JSON line to stdout —
 *     { type:"action", action:"plan"|"feature"|"review-plan"|"retire"|
 *       "cancel-plan"|"iterator-init"|"view-archive",
 *       feature, prompt }
 *     { type:"backlog", action:"create"|"edit"|"delete"|"select", ... }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from "../ui.mjs";
import { WIDGETS_CSS, WIDGETS_JS } from "./widgets.mjs";

const PLANNING_CSS = `
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
.hero .initnote{font-size:var(--fs-xs);color:var(--dot-yellow);margin-bottom:var(--sp-3)}
.backlog{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:var(--sp-4);margin-top:var(--sp-6)}
.backlog-head{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap;margin-bottom:var(--sp-3)}
.backlog-head h2{font-size:var(--fs-md);font-weight:600}.backlog-head p{font-size:var(--fs-xs);color:var(--text-muted)}
.backlog-tools{display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap}.backlog-tools .filters{display:flex;gap:var(--sp-1)}
.backlog-tools button.sel{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.backlog-form{display:grid;grid-template-columns:120px minmax(180px,1fr);gap:var(--sp-2);align-items:start}
.backlog-form select,.backlog-form input,.backlog-form textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text);font:inherit;font-size:var(--fs-sm)}
.backlog-form textarea{min-height:64px;resize:vertical;grid-column:1/-1}.backlog-form .at-wrap{position:relative;grid-column:1/-1}.backlog-form .at-wrap textarea{grid-column:auto}.backlog-form .btns{grid-column:1/-1}.backlog-list{display:grid;gap:var(--sp-2);margin-top:var(--sp-4)}
.backlog-item{border-top:1px solid var(--border);padding-top:var(--sp-3)}.backlog-item:first-child{border-top:0;padding-top:0}
.backlog-item-main{display:flex;gap:var(--sp-2);align-items:flex-start}.backlog-item-main input{margin-top:4px}.backlog-item-title{font-size:var(--fs-sm);font-weight:600}.backlog-item-details{font-size:var(--fs-xs);color:var(--text-muted);margin-top:2px;white-space:pre-wrap}.backlog-empty{font-size:var(--fs-sm);color:var(--text-muted)}
.retired{margin-top:var(--sp-6)}.retired .sec-title{margin-top:0}.retired-list{display:grid;gap:var(--sp-3)}
@media(max-width:640px){.backlog-form{grid-template-columns:1fr}.backlog-form textarea,.backlog-form .btns{grid-column:auto}.bounded-list{max-block-size:50vh}}
`;

const BODY = `
<div class="wrap" id="wrap"></div>
`;

const JS = `
const CH = D.features || [];
const PLAN_DRAFT_KEY = 'iterator:plan-goal-draft:' + (D.branch || '');
function clearPlanDraft(){ try { localStorage.removeItem(PLAN_DRAFT_KEY); } catch(e){} }

async function backlogAction(payload, button, message){
  if(button){ button.disabled = true; button.dataset.label = button.textContent; button.textContent = 'Saving…'; }
  const saved = await post({ type:'backlog', ...payload }, message || 'Saved', { allowWhileWorking:true });
  // During an agent turn the server deliberately does not refresh this view:
  // doing so would clear the model-working guard. Restore the local control so
  // more filesystem-only backlog edits remain possible until turn-end refresh.
  if(button){ button.disabled = false; if(button.dataset.label) button.textContent = button.dataset.label; delete button.dataset.label; }
  return saved;
}
function selectedBacklogGoal(){
  const selected = (D.backlog || []).filter(item => item.selected);
  if(!selected.length) return null;
  return 'Create a plan from these saved backlog candidates:\\n\\n' + selected.map(item =>
    '[' + item.kind + '] ' + item.title + (item.details ? '\\n' + item.details : '')).join('\\n\\n');
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
  if(D.plan) clearPlanDraft();
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
    // The iframe is recreated on every tab switch/refresh — keep the unsent
    // goal in browser storage, cleared only once a plan actually starts.
    try { goal.value = localStorage.getItem(PLAN_DRAFT_KEY) || ''; } catch(e){}
    const saveDraft = () => { try {
      if(goal.value) localStorage.setItem(PLAN_DRAFT_KEY, goal.value);
      else localStorage.removeItem(PLAN_DRAFT_KEY);
    } catch(e){} };
    goal.addEventListener('input', saveDraft);
    goal.addEventListener('blur', saveDraft);
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
      hero.insertBefore(note, goalWrap);
      const init = document.createElement('button');
      init.className = 'act primary-act'; init.textContent = 'Initialize memory';
      // Keep the draft until a plan actually exists: init may be cancelled or
      // need feedback, and its continuation must not lose the user's goal.
      init.addEventListener('click', () =>
        post({ type:'action', action:'iterator-init', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-init'));
      btns.appendChild(init);
    }
    const b = document.createElement('button');
    b.className = 'act' + (D.knowledgeInitialized ? ' primary-act' : ''); b.textContent = 'Create plan';
    b.addEventListener('click', () =>
      post({ type:'action', action:'plan', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-plan')
        .then(() => { if(__submitted) clearPlanDraft(); }));
    btns.appendChild(b);
    hero.appendChild(btns);
    w.appendChild(hero);
    renderBacklog(w);
    renderRetired(w);
    return;
  }

  // Planning is a staging surface once a plan exists. Active lifecycle,
  // progress, and feature controls stay together on Work.
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.innerHTML = '<h2>Planning is staged</h2><p><strong>'+esc(D.plan.title||'This plan')+'</strong> is active on Work.<br>Use Work for progress, feature actions, and plan lifecycle controls.</p>';
  const open = document.createElement('button');
  open.className = 'act primary-act';
  open.textContent = 'Open Work';
  open.addEventListener('click', () => action('hub', null, 'Opening Work'));
  hero.appendChild(open);
  w.appendChild(hero);
  renderBacklog(w);
  renderRetired(w);
}

// Backlog: saved ideas and bugs, separate from active plan features.
function renderBacklog(w){
  const items = Array.isArray(D.backlog) ? D.backlog : [];
  const section = document.createElement('section'); section.className = 'backlog backlog-active';
  section.innerHTML = '<div class="backlog-head"><div><h2>Idea backlog</h2><p>Saved ideas and bugs stay separate from active plan features.</p></div><div class="backlog-tools"><div class="filters" aria-label="Filter backlog"><button class="act sel" type="button" data-kind="all">All</button><button class="act" type="button" data-kind="idea">Ideas</button><button class="act" type="button" data-kind="bug">Bugs</button></div><button class="act" type="button" data-bulk="select">Select visible</button><button class="act" type="button" data-bulk="deselect">Deselect visible</button></div></div>';
  const form = document.createElement('form'); form.className = 'backlog-form';
  form.innerHTML = '<select aria-label="Candidate type"><option value="idea">Idea</option><option value="bug">Bug</option></select>'+
    '<input required maxlength="160" placeholder="Short title" aria-label="Backlog title">'+
    '<div class="at-wrap"><textarea maxlength="4000" placeholder="Why it matters, context, or a repro" aria-label="Backlog details"></textarea><div class="at-menu"></div></div>'+
    '<div class="btns"><button class="act primary-act" type="submit">Save candidate</button><button class="act" type="button" hidden>Cancel edit</button></div>';
  const [kind, title, details] = form.querySelectorAll('select,input,textarea');
  const detailsMenu = form.querySelector('.at-menu');
  wireAtMenu(details, detailsMenu);
  const [save, cancel] = form.querySelectorAll('button');
  let editing = null;
  const reset = () => { editing = null; form.reset(); save.textContent = 'Save candidate'; cancel.hidden = true; };
  form.addEventListener('submit', event => {
    event.preventDefault();
    backlogAction({ action: editing ? 'edit' : 'create', ...(editing ? { id: editing } : {}), kind: kind.value, title: title.value, details: details.value }, save, editing ? 'Candidate updated' : 'Candidate saved');
  });
  cancel.addEventListener('click', reset);
  section.appendChild(form);
  const list = document.createElement('div'); list.className = 'backlog-list bounded-list';
  const rows = new Map();
  let filter = 'all';
  let refreshHandoff = () => {};
  if(!items.length) list.innerHTML = '<p class="backlog-empty">No saved candidates yet.</p>';
  for(const item of items){
    const row = document.createElement('div'); row.className = 'backlog-item'; row.dataset.kind = item.kind;
    rows.set(item.id, row);
    row.innerHTML = '<div class="backlog-item-main"><input type="checkbox" aria-label="Select '+esc(item.title)+'" '+(item.selected?'checked':'')+'><div><div class="backlog-item-title">'+esc(item.title)+' <span class="chip cmut">'+esc(item.kind)+'</span></div><div class="backlog-item-details">'+esc(item.details || '')+'</div></div></div>';
    const toggle = row.querySelector('input');
    toggle.addEventListener('change', async () => {
      const selected = toggle.checked;
      const saved = await backlogAction({ action:'select', id:item.id, selected }, toggle, selected ? 'Candidate selected' : 'Candidate deselected');
      if(saved){ item.selected = selected; refreshHandoff(); }
      else toggle.checked = !selected;
    });
    const buttons = document.createElement('div'); buttons.className = 'btns';
    const edit = document.createElement('button'); edit.className = 'act'; edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => { editing = item.id; kind.value = item.kind; title.value = item.title; details.value = item.details || ''; save.textContent = 'Update candidate'; cancel.hidden = false; title.focus(); });
    const remove = document.createElement('button'); remove.className = 'act danger'; remove.type = 'button'; remove.textContent = 'Delete';
    confirmButton(remove, 'Really delete — click again', () => backlogAction({ action:'delete', id:item.id }, remove, 'Candidate deleted'));
    buttons.append(edit, remove); row.appendChild(buttons); list.appendChild(row);
  }
  const visibleItems = () => items.filter(item => filter==='all' || item.kind===filter);
  const applyFilter = kind => {
    filter = kind;
    section.querySelectorAll('.filters [data-kind]').forEach(button => button.classList.toggle('sel', button.dataset.kind===kind));
    rows.forEach((row, id) => { row.hidden = !visibleItems().some(item => item.id===id); });
  };
  section.querySelectorAll('.filters [data-kind]').forEach(button =>
    button.addEventListener('click', () => applyFilter(button.dataset.kind)));
  const bulkSelect = async (selected, button) => {
    const targets = visibleItems().filter(item => Boolean(item.selected)!==selected);
    button.disabled = true; const label = button.textContent; button.textContent = 'Saving…';
    for(const item of targets){
      const saved = await backlogAction({ action:'select', id:item.id, selected }, null, selected ? 'Candidate selected' : 'Candidate deselected');
      if(!saved) break;
      item.selected = selected;
      const checkbox = rows.get(item.id).querySelector('input'); checkbox.checked = selected;
    }
    refreshHandoff();
    button.disabled = false; button.textContent = label;
  };
  section.querySelector('[data-bulk="select"]').addEventListener('click', event => bulkSelect(true, event.currentTarget));
  section.querySelector('[data-bulk="deselect"]').addEventListener('click', event => bulkSelect(false, event.currentTarget));
  section.appendChild(list);
  const handoff = document.createElement('button'); handoff.className = 'act primary-act'; handoff.type = 'button';
  handoff.textContent = D.plan ? 'Selected candidates saved' : 'Plan selected candidates';
  handoff.title = D.plan ? 'Retire or finish the active plan before starting a new one.' : 'Start a new plan with the selected candidates as its initial goal. They are removed from the backlog only after the plan is approved.';
  handoff.disabled = Boolean(D.plan);
  handoff.addEventListener('click', () => {
    const goal = selectedBacklogGoal();
    if(goal) action('plan', null, 'Starting /iterator-plan from backlog', goal);
  });
  refreshHandoff = () => { handoff.hidden = !selectedBacklogGoal(); };
  refreshHandoff();
  section.appendChild(handoff);
  w.appendChild(section);
}

// Retired plans: read-only history browser (view-archive opens the archive view).
function renderRetired(w){
  const R = D.retired || [];
  if(!R.length) return;
  const section = document.createElement('section'); section.className = 'retired';
  const t = document.createElement('div'); t.className='sec-title'; t.textContent='Retired plans';
  const list = document.createElement('div'); list.className = 'retired-list bounded-list';
  section.append(t, list);
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
    list.appendChild(card);
  });
  w.appendChild(section);
}

`;

export function render(data) {
	return renderPage({
		step: "planning",
		subtitle: "/ planning",
		branch: data.branch,
		title: data.plan && data.plan.title,
		data,
		css: WIDGETS_CSS + PLANNING_CSS,
		body: BODY,
		clientJs: WIDGETS_JS + JS,
		primary: false, // the inline buttons are the primaries here
		cancel: false, // idle dashboard — there is no round to cancel
	});
}
