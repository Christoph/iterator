/**
 * Shared dependency-graph rendering: the layered SVG graph used by the hub,
 * feature, and planning views. Views concatenate GRAPH_CSS into their CSS and
 * GRAPH_JS into their client script, then call
 * `renderGraphInto(graphEl, warnEl, features, cycleMsg)`.
 *
 * Nodes are auto-width: the full slug always fits (12px monospace ≈ 7.25px
 * per character + padding), never clipped — wide graphs scroll horizontally
 * inside `.graph` per memory/design.md ("horizontal overflow rather than
 * clipping workflow state").
 */

export const GRAPH_CSS = `
.cyclewarn{background:var(--bg-red);border:1px solid var(--dot-red);border-radius:var(--radius-sm);padding:10px 14px;
  font-size:var(--fs-sm);color:var(--dot-red);margin-bottom:12px}
.graph{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:var(--sp-3);overflow-x:auto}
.graph svg{display:block}
.gnode rect{fill:var(--bg);stroke:var(--border);rx:6}
.gnode.done rect{stroke:var(--dot-green)}
.gnode text{fill:var(--text);font-size:12px;font-family:var(--font-mono)}
.gedge{stroke:var(--text-muted);stroke-width:1.5;fill:none;opacity:.6}
`;

export const GRAPH_JS = `
// Shared dependency graph (lib/views/graph.mjs) — layered layout, auto-width
// nodes so labels are never truncated; wide graphs scroll inside .graph.
function graphLevels(features){
  const by = {}; features.forEach(c=>by[c.name]=c);
  const level = {}, state = {}; let cycle = false;
  function lv(name){
    if(level[name]!=null) return level[name];
    if(state[name]==='visiting'){ cycle=true; return 0; }
    state[name]='visiting';
    let m = 0;
    ((by[name]&&by[name].dependsOn)||[]).forEach(d=>{ if(by[d]) m=Math.max(m, lv(d)+1); });
    state[name]='done';
    return level[name]=m;
  }
  features.forEach(c=>lv(c.name));
  return { level, cycle };
}
function renderGraphInto(g, cw, features, cycleMsg){
  if(!features.length){ g.innerHTML='<span style="color:var(--text-muted);font-size:13px">No features yet.</span>'; cw.innerHTML=''; return; }
  const { level, cycle } = graphLevels(features);
  cw.innerHTML = cycle ? '<div class="cyclewarn">\\u26a0\\ufe0f Dependency cycle detected \\u2014 '+cycleMsg+'</div>' : '';
  const byLevel = {};
  features.forEach(c=>{ const l=level[c.name]||0; (byLevel[l]=byLevel[l]||[]).push(c); });
  const levels = Object.keys(byLevel).map(Number).sort((a,b)=>a-b);
  // Auto-width nodes: 12px ui-monospace advance is ~7.25px/char; the padding
  // absorbs estimate drift. Columns take their widest node; no label is ever
  // clipped — the .graph container scrolls horizontally instead.
  const CHW=7.25, PAD=12, MINW=90, NH=34, GAPX=60, GAPY=18;
  const label = c => (c.status==='done'?'\\u2713 ':'')+c.name;
  const nodeW = {};
  features.forEach(c=>{ nodeW[c.name]=Math.max(MINW, Math.ceil(label(c).length*CHW)+2*PAD); });
  const colX = {}; let x = 10;
  levels.forEach(l=>{ colX[l]=x; x += Math.max(...byLevel[l].map(c=>nodeW[c.name])) + GAPX; });
  const pos = {}; let maxRows = 0;
  levels.forEach(l=>{ byLevel[l].forEach((c,ri)=>{ pos[c.name]={x:colX[l], y:ri*(NH+GAPY)+10}; }); maxRows=Math.max(maxRows, byLevel[l].length); });
  const W = x - GAPX + 10;
  const H = maxRows*(NH+GAPY)+10;
  let edges='';
  features.forEach(c=>{ ((c.dependsOn)||[]).forEach(d=>{ if(pos[d]&&pos[c.name]){
    const x1=pos[d].x+nodeW[d], y1=pos[d].y+NH/2, x2=pos[c.name].x, y2=pos[c.name].y+NH/2;
    const mx=(x1+x2)/2;
    edges+='<path class="gedge" marker-end="url(#arrow)" d="M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2+'"/>';
  }}); });
  let nodes='';
  features.forEach(c=>{ const p=pos[c.name]; const done=c.status==='done';
    nodes+='<g class="gnode'+(done?' done':'')+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+nodeW[c.name]+'" height="'+NH+'" rx="6"/>'+
      '<text x="'+(p.x+PAD)+'" y="'+(p.y+NH/2+4)+'">'+esc(label(c))+'</text></g>';
  });
  g.innerHTML = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'+
    '<path d="M0 0 L8 4 L0 8 z" fill="var(--text-muted)"/></marker></defs>'+edges+nodes+'</svg>';
}
`;
