/**
 * iterator: Knowledge view — the okf memory plane on the shared shell
 * (../ui.mjs, ../server.mjs). Read-mostly dashboard over the bundle's
 * knowledge side: pointer/staleness status, the five knowledge areas, every
 * concept card (with per-concept stale flags and update-via-comment), the
 * design.md card, and a free-text "ask the agent" box. The user picks one
 * action; the server exits with it (one-shot) or it dispatches as an
 * unsolicited turn (session dashboard).
 *
 *   input:  the `gather --step knowledge` payload —
 *     { step:"knowledge", branch, project, bundlePath,
 *       memory: { initialized, okfVersion, lastMemorizedCommit,
 *                 conceptCount, staleCount, unmemorizedCommitCount },
 *       areas:    [{ id, title, description, count }],
 *       memories: [{ id, slug, path, area, type, title, description,
 *                    status, files, stale }],
 *       design: { title, description, path } | null,
 *       formatStale }
 *   output: one JSON line to stdout —
 *     { type:"action", action:"okf-init"|"okf-consolidate"|"okf-memorize"
 *         |"refresh-format"|"design"|"draft-memory"|"draft-memory-prompt"
 *         |"update-memory"|"close", target: "<area or concept id>"|null,
 *       prompt: "<free text>" }
 *     plus the shared { type:"cancel" } / { type:"timeout" }.
 */
import { renderPage, escHtml } from '../ui.mjs';

const CSS = `
.wrap{max-width:920px;margin:0 auto;padding:var(--sp-5)}
.panel{border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);background:var(--surface);padding:var(--sp-4);margin:0 0 18px}
.hero{display:grid;gap:14px}.hero h2,.panel h2{font-family:var(--font-display);font-size:var(--fs-lg);margin:0 0 4px}.hero p,.hint,.muted{color:var(--text-muted)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.metrics div{border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg)}
.metrics strong{display:block;font-family:var(--font-display);font-size:var(--fs-lg)}.metrics span{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.metrics .warn strong{color:var(--dot-yellow)}
.actions,.card-actions,.tile-foot,.section-head{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap}
.section-head{justify-content:space-between}
.actions button,.card-actions button,.tile-foot button,.section-head button{font-size:var(--fs-sm);padding:4px var(--sp-3);
  border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface);color:var(--text);font-family:inherit}
.actions button:hover,.card-actions button:hover,.tile-foot button:hover{border-color:var(--accent);color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--sp-3)}
.tile,.memory-card{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);padding:var(--sp-3)}
.tile h3,.memory-card h3{margin:0;font-size:var(--fs-md)}
.tile p,.memory-card p{color:var(--text-muted);font-size:var(--fs-sm);margin:5px 0}
.tile-foot{justify-content:space-between;margin-top:10px;color:var(--text-muted);font-size:var(--fs-xs)}
.memory-group{margin-top:12px}
.card-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.status{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-radius:12px;padding:2px var(--sp-2);border:1px solid var(--border);color:var(--text-muted)}
.badge-stale{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.5px;border-radius:4px;padding:2px 6px;
  background:var(--bg-yellow);color:var(--dot-yellow);border:1px solid var(--dot-yellow);text-transform:uppercase}
.meta{font-size:var(--fs-xs);color:var(--text-muted);margin:5px 0}
.meta code{font-size:var(--fs-xs);margin-right:4px;background:var(--code-bg);border-radius:4px;padding:1px 5px;
  font-family:var(--font-mono)}
.request-box{display:grid;gap:var(--sp-2)}
.request-box textarea,.memory-comment{width:100%;min-height:70px;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-2);font:inherit}
.memory-comment{margin:8px 0;min-height:58px;font-size:var(--fs-sm)}
`;

const statusClass = (status = '') =>
  String(status || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

function statusChip(status) {
  const s = status || 'unknown';
  return `<span class="status ${escHtml(statusClass(s))}">${escHtml(s)}</span>`;
}

function memoryStatus(data) {
  const memory = data.memory || {};
  const initialized = Boolean(memory.initialized);
  const commit = memory.lastMemorizedCommit
    ? String(memory.lastMemorizedCommit).slice(0, 12) : 'not set';
  const stale = memory.staleCount ?? 0;
  return `<section class="panel hero">
  <div>
    <h2>Memory status</h2>
    <p>${initialized ? 'This project has an OKF memory bundle.' : 'No OKF memory bundle detected yet.'}</p>
  </div>
  <div class="metrics">
    <div><strong>${initialized ? 'Initialized' : 'Missing'}</strong><span>state</span></div>
    <div><strong>${escHtml(memory.conceptCount ?? 0)}</strong><span>concepts</span></div>
    <div${stale ? ' class="warn"' : ''}><strong>${escHtml(stale)}</strong><span>stale</span></div>
    <div><strong>${escHtml(memory.unmemorizedCommitCount ?? '?')}</strong><span>unmemorized commits</span></div>
    <div><strong>${escHtml(commit)}</strong><span>last memorized</span></div>
  </div>
  <div class="actions">
    ${initialized ? '' : '<button data-action="okf-init">Initialize</button>'}
    <button data-action="okf-consolidate">Consolidate</button>
    <button data-action="okf-memorize">Memorize commits</button>
    ${data.formatStale ? '<button data-action="refresh-format" title="memory/format.md drifted from the current template">Refresh format.md</button>' : ''}
  </div>
</section>`;
}

function areaCards(data) {
  const areas = Array.isArray(data.areas) ? data.areas : [];
  return `<section class="panel"><h2>Knowledge areas</h2><div class="grid areas">
${areas.map(a => `<article class="tile">
  <h3>${escHtml(a.title || a.id)}</h3>
  <p>${escHtml(a.description || '')}</p>
  <div class="tile-foot"><span>${escHtml(a.count ?? 0)} memories</span><button data-action="draft-memory" data-target="${escHtml(a.id)}">Add memory</button></div>
</article>`).join('\n')}
</div></section>`;
}

function designCard(design) {
  if (!design) return '';
  return `<article class="memory-card" data-id="design">
  <div class="card-head"><h3>${escHtml(design.title || 'Design parameters')}</h3>${statusChip('design')}</div>
  <p>${escHtml(design.description || '')}</p>
  <div class="meta"><span>path: <code>${escHtml(design.path || 'design.md')}</code></span> <span>applied to every UI chunk</span></div>
  <div class="card-actions"><button data-action="design">Revise via /iterator-design</button></div>
</article>`;
}

function memoryCard(m) {
  const files = Array.isArray(m.files) && m.files.length
    ? m.files.map(f => `<code>${escHtml(f)}</code>`).join(' ')
    : '<span class="muted">none</span>';
  return `<article class="memory-card" data-id="${escHtml(m.id)}">
  <div class="card-head"><h3>${escHtml(m.title || m.id)}</h3>${m.stale ? '<span class="badge-stale">STALE</span>' : ''}${m.status ? statusChip(m.status) : ''}</div>
  <p>${escHtml(m.description || '')}</p>
  <div class="meta"><span>type: <code>${escHtml(m.type || 'Concept')}</code></span> <span>path: <code>${escHtml(m.path || `${m.id}.md`)}</code></span></div>
  <div class="meta"><span>files: ${files}</span></div>
  <textarea class="memory-comment" data-comment-for="${escHtml(m.id)}" placeholder="Comment with the update this memory needs."></textarea>
  <div class="card-actions">
    <button data-action="update-memory" data-target="${escHtml(m.id)}">Update via comment</button>
    <button data-action="draft-memory" data-target="${escHtml(m.id)}">Add related memory</button>
  </div>
</article>`;
}

function memoryBrowser(data) {
  const memories = Array.isArray(data.memories) ? data.memories : [];
  const design = designCard(data.design);
  if (!memories.length && !design) {
    return '<section class="panel"><h2>All memories</h2><p class="muted">No concept files found yet.</p></section>';
  }
  const byArea = new Map();
  for (const m of memories) {
    const key = m.area || 'root';
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key).push(m);
  }
  const groups = Array.from(byArea.entries()).map(([area, items]) =>
    `<section class="memory-group"><h3>${escHtml(area)}</h3><div class="grid memories">${items.map(memoryCard).join('\n')}</div></section>`);
  return `<section class="panel">
  <div class="section-head"><h2>All memories</h2><span class="muted">${escHtml(memories.length)} concept files</span></div>
  <p class="hint">Every knowledge concept in the bundle. Paths are bundle-relative; STALE means a files: anchor points at an untracked path.</p>
  ${design ? `<section class="memory-group"><h3>design</h3><div class="grid memories">${design}</div></section>` : ''}
  ${groups.join('\n')}
</section>`;
}

const JS = `
function hasChanges() { return false; }
function onPrimary() { post({ type: 'action', action: 'close', target: null, prompt: '' }, 'Closed'); }
function sendAction(action, target, prompt) {
  post({ type: 'action', action: action, target: target || null, prompt: prompt || '' }, 'Action sent');
}
function onReady() {
  document.querySelectorAll('[data-action]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.dataset.action;
      var prompt = '';
      if (action === 'draft-memory-prompt') prompt = document.getElementById('memory-prompt').value.trim();
      if (action === 'update-memory') {
        var target = btn.dataset.target || '';
        var comment = Array.prototype.find.call(document.querySelectorAll('[data-comment-for]'), function (el) {
          return el.dataset.commentFor === target;
        });
        prompt = comment ? comment.value.trim() : '';
      }
      sendAction(action, btn.dataset.target || null, prompt);
    });
  });
}
onReady();
`;

export function render(data) {
  const BODY = `<div class="wrap">
${memoryStatus(data)}
${areaCards(data)}
${memoryBrowser(data)}
<section class="panel request-box">
  <h2>Ask the agent to add memory</h2>
  <p class="hint">Describe the architecture, decision, pattern, pitfall, or setup fact you want researched. The agent drafts a normal review card for accept/revise/delete.</p>
  <textarea id="memory-prompt" placeholder="Example: Capture how the review server binds ports and why token checks matter."></textarea>
  <div class="actions"><button data-action="draft-memory-prompt">Draft memory from prompt</button></div>
</section>
</div>`;
  return renderPage({
    step: 'knowledge',
    subtitle: '/ knowledge',
    branch: data.branch,
    title: 'knowledge',
    data,
    css: CSS,
    body: BODY,
    clientJs: JS,
    primaryIdle: 'Close',
    primaryChanged: 'Close',
  });
}
