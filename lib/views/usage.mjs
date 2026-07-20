/**
 * iterator: token-usage and optional model-pricing UI.
 * Rates are project-owned USD per one million tokens; the gather payload
 * supplies all cost calculations so the view never guesses provider prices.
 */
import { renderPage } from "../ui.mjs";

const CSS = `
.main{max-width:980px;margin:0 auto;padding:28px var(--sp-5)}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:6px}
.hint{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:24px;line-height:1.5;max-width:65ch}
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
  color:var(--text-muted);text-align:right;padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap}
table.u th:first-child{text-align:left}
table.u td{padding:7px 12px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);font-size:12.5px;white-space:nowrap}
table.u td:first-child{text-align:left;font-family:inherit}
table.u tr:last-child td{border-bottom:none}
.empty{padding:18px 0;color:var(--text-muted);font-size:var(--fs-sm)}
.price-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:var(--sp-4);margin-top:24px}
.price-head{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--sp-3);flex-wrap:wrap}
.price-head h2{font-size:var(--fs-md);font-weight:600}.price-head p{font-size:var(--fs-xs);color:var(--text-muted);margin-top:3px}
.price-grid{display:grid;grid-template-columns:minmax(180px,1.5fr) repeat(4,minmax(105px,1fr)) 34px;gap:var(--sp-2);align-items:end;margin-top:var(--sp-3)}
.price-label{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.price-row{display:contents}
.price-grid input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text);font:12px var(--font-mono)}
.price-actions{display:flex;gap:var(--sp-2);margin-top:var(--sp-3);flex-wrap:wrap}
button.act{font-size:var(--fs-sm);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text)}
button.act:hover{border-color:var(--accent);color:var(--accent)}button.act.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg);font-weight:600}
button.remove-price{padding:7px;color:var(--del-fg)}.price-error{font-size:var(--fs-xs);color:var(--del-fg);margin-top:var(--sp-2);min-height:16px}
body.iterator-ro .price-box input,body.iterator-ro .price-box button{pointer-events:none;opacity:.45}
@media(max-width:760px){.price-grid{grid-template-columns:1fr 1fr}.price-label{display:none}.price-row{display:grid;grid-column:1/-1;grid-template-columns:1fr 1fr;gap:var(--sp-2);padding-top:var(--sp-3);border-top:1px solid var(--border)}.price-row input:first-child{grid-column:1/-1}.price-row button{justify-self:end}.main{padding:var(--sp-4)}}
`;

const BODY = `<div class="main" id="main"></div>`;

const JS = `
const m = document.getElementById('main');
const fmtN = n => (n||0).toLocaleString('en-US');
const fmtCost = value => value == null ? '\u2014' : '$' + Number(value).toFixed(value < .01 ? 6 : 4);
const T = D.totals || { steps:{}, features:{}, featureModels:{} };
const P = D.prices || {};
const C = D.costs || { steps:{}, features:{}, grand:null };
const steps = Object.keys(T.steps||{});
const observedModels = [...new Set(steps.flatMap(step => Object.keys(T.steps[step]||{})))];
const priceModels = [...new Set([...observedModels, ...Object.keys(P)])].sort();
let html = '<h1>Token usage'+(D.plan?' \u2014 '+esc(D.plan):'')+'</h1>'+
  '<p class="hint">Raw token counts plus project-wide, user-owned prices reused across plans. Rates are USD per one million tokens; missing rates display \u2014 instead of estimating provider costs.</p>';
if(D.exists && steps.length){
  const g = D.grand || {};
  html += '<div class="tiles">'+tile(fmtN(g.input),'input')+tile(fmtN(g.output),'output')+
    tile(fmtN(g.cacheRead),'cache read')+tile(fmtN(g.cacheWrite),'cache write')+
    tile(fmtN(g.turns),'turns')+tile(fmtCost(C.grand),'estimated cost')+'</div>';
  steps.forEach(step => {
    html += '<div class="sec-title">'+esc(step)+'</div>'+table(Object.entries(T.steps[step]), 'model', C.steps&&C.steps[step]);
  });
  const features = Object.entries(T.features||{});
  if(features.length) html += '<div class="sec-title">Per feature</div>'+table(features, 'feature', C.features);
} else {
  html += '<div class="empty">No usage recorded yet. Token usage is captured per turn when the usage ledger is enabled.</div>';
}
html += priceEditor(priceModels.length ? priceModels : ['']);
m.innerHTML = html;
wirePrices();

function tile(v, l){ return '<div class="tile"><div class="tv">'+v+'</div><div class="tl">'+esc(l)+'</div></div>'; }
function table(rows, firstCol, costs){
  return '<div class="tbl-wrap"><table class="u"><thead><tr><th>'+esc(firstCol)+'</th><th>input</th><th>output</th><th>cache read</th><th>cache write</th><th>turns</th><th>cost</th></tr></thead><tbody>'+
    rows.map(([k,u]) => '<tr><td>'+esc(k)+'</td><td>'+fmtN(u.input)+'</td><td>'+fmtN(u.output)+'</td><td>'+fmtN(u.cacheRead)+'</td><td>'+fmtN(u.cacheWrite)+'</td><td>'+fmtN(u.turns)+'</td><td>'+fmtCost(costs&&Object.prototype.hasOwnProperty.call(costs,k)?costs[k]:null)+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function rateInput(model, field, label){
  const value = P[model] && P[model][field] != null ? P[model][field] : '';
  return '<input type="number" min="0" step="any" data-rate="'+field+'" value="'+esc(value)+'" aria-label="'+esc(label)+' USD per million">';
}
function priceRow(model){
  return '<div class="price-row"><input class="price-model" maxlength="200" value="'+esc(model)+'" placeholder="provider/model" aria-label="Model id">'+
    rateInput(model,'input','Input')+rateInput(model,'output','Output')+rateInput(model,'cacheRead','Cache read')+rateInput(model,'cacheWrite','Cache write')+
    '<button class="act remove-price" type="button" title="Remove model price" aria-label="Remove model price">\u00d7</button></div>';
}
function priceEditor(models){
  return '<section class="price-box"><div class="price-head"><div><h2>Model prices</h2><p>Optional project-wide USD rates per 1M tokens. Saving replaces this project\u2019s complete price table and reuses it for later plans.</p></div></div>'+
    '<div class="price-grid" id="price-grid"><span class="price-label">model</span><span class="price-label">input</span><span class="price-label">output</span><span class="price-label">cache read</span><span class="price-label">cache write</span><span></span>'+models.map(priceRow).join('')+'</div>'+
    '<div class="price-actions"><button class="act" id="add-price" type="button">Add model</button><button class="act primary" id="save-prices" type="button">Save prices</button></div><div class="price-error" id="price-error"></div></section>';
}
function wirePrices(){
  const grid = document.getElementById('price-grid');
  const error = document.getElementById('price-error');
  const wireRemove = button => button.addEventListener('click', () => button.closest('.price-row').remove());
  grid.querySelectorAll('.remove-price').forEach(wireRemove);
  document.getElementById('add-price').addEventListener('click', () => {
    grid.insertAdjacentHTML('beforeend', priceRow(''));
    wireRemove(grid.querySelector('.price-row:last-child .remove-price'));
  });
  document.getElementById('save-prices').addEventListener('click', async () => {
    const prices = {};
    error.textContent = '';
    for(const row of grid.querySelectorAll('.price-row')){
      const model = row.querySelector('.price-model').value.trim();
      const rates = {};
      for(const input of row.querySelectorAll('[data-rate]')){
        if(input.value === '') continue;
        const value = Number(input.value);
        if(!Number.isFinite(value) || value < 0){ error.textContent = 'Rates must be non-negative numbers.'; return; }
        rates[input.dataset.rate] = value;
      }
      if(!model && Object.keys(rates).length){ error.textContent = 'Every priced row needs a provider/model id.'; return; }
      if(model && Object.keys(rates).length) prices[model] = rates;
    }
    await post({ type:'usage-prices', prices }, 'Prices saved');
  });
}
function hasChanges(){ return false; }
function onPrimary(){ post({ type:'cancel' }, 'Closed'); }
`;

export function render(data) {
	return renderPage({
		step: "usage",
		subtitle: "/ token usage",
		branch: data.branch,
		title: data.plan,
		data,
		css: CSS,
		body: BODY,
		clientJs: JS,
		primary: false,
		cancel: false,
	});
}
