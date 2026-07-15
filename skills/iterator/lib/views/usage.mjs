/**
 * iterator: token-usage UI on the shared shell (../ui.mjs, ../server.mjs).
 * Read-only view over memory/usage.md — per-step × model token counts
 * (input/output/cache read/cache write) plus per-feature rollups and the plan
 * total. No price math: the user computes prices later from the raw counts.
 *
 *   input:  { step:"usage", branch, plan, exists,
 *             totals: { steps: { <step>: { <provider/model>: {input,output,cacheRead,cacheWrite,turns} } },
 *                       features: { <slug>: {input,output,cacheRead,cacheWrite,turns} } },
 *             grand: {input,output,cacheRead,cacheWrite,turns} }
 *   output: the shared { type:"cancel" } / { type:"timeout" } only (read-only view).
 */
import { renderPage } from '../ui.mjs';

const CSS = `
.main{max-width:860px;margin:0 auto;padding:28px var(--sp-5)}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:6px}
.hint{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:24px;line-height:1.5}
.tiles{display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-bottom:24px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);
  box-shadow:var(--shadow-card);padding:12px var(--sp-4);min-width:120px}
.tile .tv{font-family:var(--font-mono);font-size:var(--fs-lg);font-weight:600}
.tile .tl{font-size:var(--fs-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.sec-title{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:18px 0 10px}
.tbl-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);
  box-shadow:var(--shadow-card);overflow-x:auto;margin-bottom:var(--sp-4)}
table.u{width:100%;border-collapse:collapse;font-size:var(--fs-sm)}
table.u th{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;
  color:var(--text-muted);text-align:right;padding:8px 12px;border-bottom:1px solid var(--border)}
table.u th:first-child{text-align:left}
table.u td{padding:7px 12px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);font-size:12.5px}
table.u td:first-child{text-align:left;font-family:inherit}
table.u tr:last-child td{border-bottom:none}
.empty{text-align:center;padding:56px var(--sp-5);color:var(--text-muted)}
.empty h2{color:var(--text);font-family:var(--font-display);font-size:var(--fs-xl);margin-bottom:var(--sp-2)}
`;

const BODY = `<div class="main" id="main"></div>`;

const JS = `
const m = document.getElementById('main');
const fmtN = n => (n||0).toLocaleString('en-US');
const T = D.totals || { steps:{}, features:{} };
const steps = Object.keys(T.steps||{});

if(!D.exists || !steps.length){
  m.innerHTML = '<div class="empty"><h2>No usage recorded yet</h2>'+
    '<p>Token usage is captured per turn in pi sessions (usage_ledger setting) and lands in memory/usage.md.</p></div>';
} else {
  const g = D.grand || {};
  let html = '<h1>Token usage'+(D.plan?' — '+esc(D.plan):'')+'</h1>'+
    '<p class="hint">Raw token counts per step and model — multiply with your provider\\'s prices to get costs. Cached tokens are listed separately.</p>'+
    '<div class="tiles">'+
      tile(fmtN(g.input),'input')+tile(fmtN(g.output),'output')+
      tile(fmtN(g.cacheRead),'cache read')+tile(fmtN(g.cacheWrite),'cache write')+
      tile(fmtN(g.turns),'turns')+'</div>';
  steps.forEach(step => {
    html += '<div class="sec-title">'+esc(step)+'</div>'+table(Object.entries(T.steps[step]), 'model');
  });
  const features = Object.entries(T.features||{});
  if(features.length){
    html += '<div class="sec-title">Per feature</div>'+table(features, 'feature');
  }
  m.innerHTML = html;
}

function tile(v, l){ return '<div class="tile"><div class="tv">'+v+'</div><div class="tl">'+esc(l)+'</div></div>'; }
function table(rows, firstCol){
  return '<div class="tbl-wrap"><table class="u"><thead><tr><th>'+esc(firstCol)+'</th>'+
    '<th>input</th><th>output</th><th>cache read</th><th>cache write</th><th>turns</th></tr></thead><tbody>'+
    rows.map(([k,u]) => '<tr><td>'+esc(k)+'</td><td>'+fmtN(u.input)+'</td><td>'+fmtN(u.output)+'</td>'+
      '<td>'+fmtN(u.cacheRead)+'</td><td>'+fmtN(u.cacheWrite)+'</td><td>'+fmtN(u.turns)+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function hasChanges(){ return false; }
function onPrimary(){ post({ type:'cancel' }, 'Closed'); }
`;

export function render(data) {
  return renderPage({
    step: 'usage', subtitle: '/ token usage', branch: data.branch, title: data.plan,
    data, css: CSS, body: BODY, clientJs: JS,
    primary: false,
  });
}
