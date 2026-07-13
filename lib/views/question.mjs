/**
 * iterator: question UI on the shared shell (../ui.mjs, ../server.mjs).
 * The browser-side twin of a terminal AskUserQuestion: the agent asks ONE
 * question with options (and optionally free text) and waits for the answer.
 * Skills route their questions here first so the user controlling the flow
 * from the dashboard never misses a question stuck in the terminal.
 *
 *   input:  { step:"question", branch,
 *             title,                         // short header chip, e.g. "Plan"
 *             question,                      // the full question text
 *             options:[{label, description?}],
 *             allowFreeText }                // show an "Other" free-text box
 *   output: one JSON line to stdout —
 *     { type:"answer", choice:"<label>"|null, text:"<free text>"|null }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from '../ui.mjs';

const CSS = `
.main{max-width:640px;margin:0 auto;padding:40px var(--sp-5)}
.qtag{display:inline-block;font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--accent);background:var(--code-bg);
  border-radius:10px;padding:2px 10px;margin-bottom:12px}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:20px;line-height:1.4}
.opt{display:block;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:14px var(--sp-4);
  margin-bottom:10px;cursor:pointer;color:var(--text);font-family:inherit}
.opt:hover{border-color:var(--accent)}
.opt.sel{border-color:var(--accent);background:var(--code-bg)}
.opt .ol{font-size:var(--fs-md);font-weight:600}
.opt .od{font-size:var(--fs-sm);color:var(--text-muted);margin-top:4px;line-height:1.5}
.free{margin-top:14px}
.free .flabel{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;
  letter-spacing:.08em;color:var(--text-muted);margin-bottom:6px}
.free textarea{width:100%;padding:10px 12px;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-card);color:var(--text);font-size:var(--fs-sm);font-family:inherit;
  resize:vertical;min-height:70px;outline:none;line-height:1.5}
.free textarea:focus{border-color:var(--accent)}
.note{font-size:var(--fs-xs);color:var(--text-muted);margin-top:16px}
`;

const BODY = `
<div class="main">
  <span class="qtag" id="qtag"></span>
  <h1 id="question"></h1>
  <div id="options"></div>
  <div class="free" id="free" style="display:none">
    <div class="flabel">Other — type your own answer</div>
    <textarea id="free-text" placeholder="Your answer…"></textarea>
  </div>
  <p class="note">Answering here returns control to Claude — same as answering in the terminal.</p>
</div>
`;

const JS = `
let choice = null;
document.getElementById('qtag').textContent = D.title || 'Question';
document.getElementById('question').textContent = D.question || '';
const opts = Array.isArray(D.options) ? D.options : [];
const box = document.getElementById('options');
opts.forEach(o => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'opt';
  b.innerHTML = '<div class="ol">'+esc(o.label)+'</div>'+
    (o.description ? '<div class="od">'+esc(o.description)+'</div>' : '');
  b.addEventListener('click', () => {
    choice = o.label;
    document.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', x === b));
    if(ft) ft.value = '';
    refresh();
  });
  box.appendChild(b);
});
let ft = null;
if(D.allowFreeText !== false){
  document.getElementById('free').style.display = '';
  ft = document.getElementById('free-text');
  ft.addEventListener('input', () => {
    if(ft.value.trim()){
      choice = null;
      document.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
    }
    refresh();
  });
}

function hasChanges(){ return choice != null || Boolean(ft && ft.value.trim()); }
function onPrimary(){
  const text = ft && ft.value.trim() ? ft.value.trim() : null;
  if(!choice && !text) return;
  post({ type:'answer', choice, text }, 'Answer sent to Claude');
}
`;

export function render(data) {
  return renderPage({
    step: 'question', subtitle: '/ question', branch: data.branch, title: data.title,
    data, css: CSS, body: BODY, clientJs: JS,
    primaryIdle: 'Answer', primaryChanged: 'Answer',
  });
}
