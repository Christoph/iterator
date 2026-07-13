/**
 * iterator: retired-plan archive UI on the shared shell (../ui.mjs,
 * ../server.mjs). Read-only: browse one retired plan end to end — the plan
 * sections, every chunk (notes + review history + commits), and the token
 * totals the plan cost.
 *
 *   input:  { step:"archive", branch, name, title, created, planStatus,
 *             sections: { "<heading>": "<markdown>" },
 *             chunks: [ { name,title,description,status,size,files,dependsOn,
 *                         implementationNotes,review,commits } ],
 *             usage: { totals, grand:{input,output,cacheRead,cacheWrite,turns} } }
 *           or { step:"archive", error, archives:[names] } for a bad target.
 *   output: { type:"action", action:"hub" } (Back to dashboard)
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage } from '../ui.mjs';

const CSS = `
.main{max-width:880px;margin:0 auto;padding:28px var(--sp-5)}
h1{font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:4px}
.sub{font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:20px}
.sub code{background:var(--code-bg);border-radius:4px;padding:1px 6px;font-family:var(--font-mono)}
.badge{display:inline-block;font-family:var(--font-mono);font-size:var(--fs-xs);border-radius:10px;
  padding:2px var(--sp-2);background:var(--bg-green);color:var(--dot-green);margin-left:8px;vertical-align:2px}
.usage-line{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted);
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);
  padding:6px 12px;display:inline-block;margin-bottom:20px}
.sec-title{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:20px 0 10px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);
  box-shadow:var(--shadow-card);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-3);
  font-size:var(--fs-sm);line-height:1.6}
.card h3{font-size:var(--fs-md);font-weight:600;margin-bottom:6px}
.chip{font-size:var(--fs-xs);font-family:var(--font-mono);border-radius:10px;padding:2px var(--sp-2);margin-left:6px}
.cg{background:var(--bg-green);color:var(--dot-green)}
.cmut{background:var(--bg);color:var(--text-muted);border:1px solid var(--border)}
.lbl{font-family:var(--font-mono);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin:10px 0 4px}
.rev{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;font-size:13px}
.commits code{background:var(--code-bg);border-radius:3px;padding:0 5px;font-family:var(--font-mono);font-size:12px;margin-right:6px}
.back{margin-bottom:16px}
.empty{text-align:center;padding:56px;color:var(--text-muted)}
`;

const BODY = `<div class="main" id="main"></div>`;

const JS = `
const m = document.getElementById('main');
if(D.error){
  m.innerHTML = '<div class="empty"><h3>'+esc(D.error)+'</h3><p>'+
    (D.archives&&D.archives.length?'Available: '+D.archives.map(esc).join(', '):'No retired plans yet.')+'</p></div>';
} else {
  const g = (D.usage&&D.usage.grand)||{};
  const secs = D.sections||{};
  let html = '<h1>'+esc(D.title||D.name)+'<span class="badge">retired</span></h1>'+
    '<div class="sub">archived as <code>'+esc(D.name)+'</code>'+(D.created?' · created '+esc(D.created):'')+'</div>'+
    ((g.turns||g.input)?'<div class="usage-line">tokens: '+n(g.input)+' in · '+n(g.output)+' out · '+
      n(g.cacheRead)+' cache-read · '+n(g.cacheWrite)+' cache-write · '+n(g.turns)+' turns</div>':'');
  ['Goal','Architecture','Dependencies','Key decisions','Product fit'].forEach(s => {
    if(secs[s]) html += '<div class="sec-title">'+esc(s)+'</div><div class="card md">'+mdToHtml(secs[s])+'</div>';
  });
  html += '<div class="sec-title">Chunks ('+((D.chunks||[]).length)+')</div>';
  (D.chunks||[]).forEach(c => {
    html += '<div class="card"><h3>'+esc(c.title||c.name)+
      '<span class="chip cmut">'+esc(c.name)+'</span>'+
      (c.status==='done'?'<span class="chip cg">done</span>':'')+
      (c.size?'<span class="chip cmut">'+esc(c.size)+'</span>':'')+'</h3>'+
      '<div>'+esc(c.description||'')+'</div>'+
      (c.implementationNotes?'<div class="lbl">Implementation notes</div><div class="md">'+mdToHtml(c.implementationNotes)+'</div>':'')+
      (c.review?'<div class="lbl">Review history</div><div class="rev md">'+mdToHtml(c.review)+'</div>':'')+
      ((c.commits&&c.commits.length)?'<div class="lbl">Commits</div><div class="commits">'+
        c.commits.map(x=>'<code>'+esc(String(x.sha||'').slice(0,7))+'</code>').join('')+'</div>':'')+
    '</div>';
  });
  m.innerHTML = html;
}
function n(v){ return (v||0).toLocaleString('en-US'); }
function hasChanges(){ return false; }
function onPrimary(){ post({ type:'action', action:'hub', chunk:null }, 'Back to dashboard'); }
`;

export function render(data) {
  return renderPage({
    step: 'archive', subtitle: '/ retired plan', branch: data.branch, title: data.title,
    data, css: CSS, body: BODY, clientJs: JS,
    primaryIdle: 'Back to dashboard', primaryChanged: 'Back to dashboard',
  });
}
