/**
 * iterator: project-settings UI on the shared shell (../ui.mjs,
 * ../server.mjs). Renders a form over lib/settings.mjs SETTINGS_DEFS; the
 * result is piped verbatim into the writer's `settings` op (partial merge —
 * only changed keys are sent).
 *
 *   input:  { step:"settings", branch, plan,
 *             settings:{<key>:<effective value>},   // defaults merged
 *             defined,                              // memory/settings.md exists
 *             models?: [{id,label,unusable?,note?}] } // pi model registry, for
 *                                                     // model dropdowns; the
 *                                                     // unusable verdict is
 *                                                     // supplied, never derived
 *   output: one JSON line to stdout —
 *     { type:"settings", values:{<changed key>:<value>} }
 *     | { type:"settings-close" } when the shell-owned modal is dismissed.
 */
import { renderPage } from "../ui.mjs";
import { SETTINGS_DEFS } from "../settings.mjs";

const CSS = `
.main{max-width:760px;margin:0 auto;padding:28px var(--sp-5)}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:6px}
.hint{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:24px;line-height:1.5}
.group-title{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:22px 0 10px}
.row{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);
  padding:12px var(--sp-4);margin-bottom:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.row.changed{border-color:var(--accent)}
.meta{flex:1;min-width:260px}
.klabel{font-size:var(--fs-md);font-weight:600}
.kname{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted);margin-left:8px}
.khelp{font-size:var(--fs-sm);color:var(--text-muted);margin-top:3px;line-height:1.5}
select.ctl,input.ctl{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-size:var(--fs-sm);font-family:var(--font-mono);padding:6px 10px;outline:none;min-width:140px}
select.ctl:focus,input.ctl:focus{border-color:var(--accent)}
.ctlwrap{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.ctlwarn{font-size:var(--fs-xs);color:var(--dot-yellow);max-width:280px;text-align:right;line-height:1.4}
.ctlwarn:empty{display:none}
select.ctl.bad{border-color:var(--dot-yellow)}
input.ctl[type=number]{width:90px;min-width:90px}
.toggle{display:inline-flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.toggle button{font-size:var(--fs-sm);padding:6px 16px;border:none;cursor:pointer;background:var(--bg);color:var(--text-muted);font-family:inherit}
.toggle button.sel{background:var(--accent);color:var(--accent-fg)}
.note{font-size:var(--fs-xs);color:var(--text-muted);margin-top:16px}
`;

const BODY = `
<div class="main">
  <h1>Project settings</h1>
  <p class="hint" id="hint"></p>
  <div id="form"></div>
  <p class="note">Settings are stored in <code>memory/settings.md</code> and applied by the deterministic writer — only the keys you change are sent.</p>
</div>
`;

// Render order: behavior first, then models, then the knobs.
const PUBLIC_SETTINGS_DEFS = Object.fromEntries(
	Object.entries(SETTINGS_DEFS).filter(([, def]) => !def.hidden),
);

const GROUPS = [
	[
		"Flow",
		[
			"auto_mode",
			"testing_default",
			"review_required",
			"branch_per_plan",
			"worktree_per_plan",
			"auto_retire_prompt",
		],
	],
	[
		"Models",
		[
			"planner_model",
			"planner_thinking",
			"implementer_model",
			"implementer_thinking",
			"tester_model",
			"tester_thinking",
			"reviewer_model",
			"reviewer_thinking",
			"plan_reviewer_model",
			"plan_reviewer_thinking",
		],
	],
	[
		"Limits & bookkeeping",
		[
			"max_review_iterations",
			"block_commit_on_leftovers",
			"memorize_nudge",
			"usage_ledger",
		],
	],
];

const JS = `
const DEFS = ${JSON.stringify(PUBLIC_SETTINGS_DEFS)};
const GROUPS = ${JSON.stringify(GROUPS)};
const ORIG = Object.assign({}, D.settings || {});
const cur = Object.assign({}, ORIG);
const MODELS = Array.isArray(D.models) ? D.models : null;

document.getElementById('hint').textContent = D.defined
  ? 'Stored settings for this project — change anything and click Save.'
  : 'No settings stored yet — these are the defaults; saving writes memory/settings.md.';

renderForm();
refresh();

function renderForm(){
  const form = document.getElementById('form');
  form.innerHTML = '';
  GROUPS.forEach(([title, keys]) => {
    const gt = document.createElement('div'); gt.className='group-title'; gt.textContent = title;
    form.appendChild(gt);
    keys.forEach(k => form.appendChild(makeRow(k)));
  });
}

function makeRow(key){
  const def = DEFS[key];
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.key = key;
  const meta = document.createElement('div'); meta.className='meta';
  meta.innerHTML = '<span class="klabel">'+esc(def.label)+'</span><span class="kname">'+esc(key)+'</span>'+
    '<div class="khelp">'+esc(def.help)+'</div>';
  row.appendChild(meta);
  row.appendChild(makeControl(key, def));
  return row;
}

function makeControl(key, def){
  if(def.kind === 'enum' && def.values.length === 2){
    const t = document.createElement('div'); t.className='toggle';
    def.values.forEach(v => {
      const b = document.createElement('button');
      b.type='button'; b.textContent=v;
      b.className = cur[key]===v ? 'sel' : '';
      b.addEventListener('click', () => { cur[key]=v; syncToggle(t,key); refresh(); });
      t.appendChild(b);
    });
    return t;
  }
  if(def.kind === 'enum'){
    const s = document.createElement('select'); s.className='ctl';
    def.values.forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=v; s.appendChild(o); });
    s.value = String(cur[key]);
    s.addEventListener('change', () => { cur[key]=s.value; refresh(); });
    return s;
  }
  if(def.kind === 'int'){
    const i = document.createElement('input'); i.className='ctl'; i.type='number';
    i.min = def.min; i.max = def.max; i.value = cur[key];
    i.addEventListener('input', () => { cur[key] = parseInt(i.value, 10); refresh(); });
    return i;
  }
  // model: dropdown when the pi registry rode along, free text otherwise.
  if(MODELS && MODELS.length){
    const wrap = document.createElement('div'); wrap.className='ctlwrap';
    const s = document.createElement('select'); s.className='ctl';
    const act = document.createElement('option'); act.value='active'; act.textContent='active (session model)';
    s.appendChild(act);
    MODELS.forEach(m => {
      const o=document.createElement('option'); o.value=m.id;
      // The verdict rides along with the option — a model this session cannot
      // route reads as unusable before it is ever saved.
      o.textContent=(m.label||m.id)+(m.unusable?' \\u2014 unusable':'');
      if(m.unusable){ o.dataset.unusable='1'; if(m.note) o.dataset.note=m.note; }
      s.appendChild(o);
    });
    if(![...s.options].some(o => o.value === String(cur[key]))){
      const o=document.createElement('option'); o.value=String(cur[key]);
      o.textContent=String(cur[key])+' (unlisted)'; o.dataset.unusable='1';
      o.dataset.note='not offered by this session\\u2019s model registry';
      s.appendChild(o);
    }
    s.value = String(cur[key]);
    const warn = document.createElement('div'); warn.className='ctlwarn';
    const paint = () => {
      const sel = s.options[s.selectedIndex];
      const bad = sel && sel.dataset.unusable === '1';
      warn.textContent = bad ? (sel.dataset.note || 'this session cannot use this model') : '';
      s.classList.toggle('bad', !!bad);
    };
    paint();
    s.addEventListener('change', () => { cur[key]=s.value; paint(); refresh(); });
    wrap.appendChild(s); wrap.appendChild(warn);
    return wrap;
  }
  const wrap = document.createElement('div'); wrap.className='ctlwrap';
  const i = document.createElement('input'); i.className='ctl';
  i.placeholder = 'active or provider/model-id';
  i.value = String(cur[key]);
  i.addEventListener('input', () => { cur[key]=i.value.trim(); refresh(); });
  // No registry rode along, so nothing here is checked against real models —
  // say so rather than letting a plain box pass for a validated field.
  const note = document.createElement('div'); note.className='ctlwarn';
  note.textContent = 'model list unavailable — this value is not checked against this session';
  wrap.appendChild(i); wrap.appendChild(note);
  return wrap;
}

function syncToggle(t, key){
  [...t.querySelectorAll('button')].forEach(b => b.classList.toggle('sel', b.textContent === String(cur[key])));
}

function changedValues(){
  const out = {};
  Object.keys(DEFS).forEach(k => { if(String(cur[k]) !== String(ORIG[k])) out[k] = cur[k]; });
  return out;
}
function hasChanges(){
  document.querySelectorAll('.row').forEach(r => {
    r.classList.toggle('changed', String(cur[r.dataset.key]) !== String(ORIG[r.dataset.key]));
  });
  return Object.keys(changedValues()).length > 0;
}
function onPrimary(){
  const values = changedValues();
  if(!Object.keys(values).length){
    post({ type:'settings-close' }, 'Settings closed', { allowWhileWorking:true });
    return;
  }
  post({ type:'settings', values }, 'Settings saved');
}
`;

export function render(data) {
	const publicData = {
		...data,
		settings: Object.fromEntries(
			Object.entries(data.settings || {}).filter(
				([key]) => !SETTINGS_DEFS[key]?.hidden,
			),
		),
	};
	return renderPage({
		step: "settings",
		subtitle: "/ settings",
		branch: data.branch,
		title: data.plan,
		data: publicData,
		css: CSS,
		body: BODY,
		clientJs: JS,
		primaryIdle: "Close",
		primaryChanged: "Save settings",
		cancel: false,
	});
}
