/**
 * Shared dashboard widgets for the hub (Work) and planning views: the CSS
 * for plan bar / cards / chips / buttons / hero, and the small client
 * helpers both embed (action(), status chips, armed confirm buttons). Views
 * concatenate WIDGETS_CSS / WIDGETS_JS exactly like graph.mjs.
 */

export const WIDGETS_CSS = `
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
.hero .btns-center{display:flex;gap:var(--sp-2);justify-content:center;flex-wrap:wrap}
.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px}
.st{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:0}
.st.done{background:var(--dot-green)}
.st.draft{background:var(--dot-yellow)}
.st.implemented{background:var(--accent)}
.st.pending{background:transparent;border:2px solid var(--border)}
`;

export const WIDGETS_JS = `
// Shared dashboard helpers (lib/views/widgets.mjs).
function action(act, feature, msg, prompt){
  return post({ type:'action', action: act, feature: feature || null, prompt: prompt || null }, msg || 'Sent to Agent');
}
function testBadge(c){
  if(!c.testsStatus || c.testsStatus==='none') return '';
  return c.testsStatus==='green' ? '<span class="chip cg"><i class="sdot"></i>tests green</span>'
                                 : '<span class="chip cr"><i class="sdot"></i>tests committed · intentionally red</span>';
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
`;
