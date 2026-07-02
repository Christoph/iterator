# Feature Planner HTML Template

Use this template to generate the self-contained HTML planning summary page for `/plan-features`.

## Overview

A planning dashboard showing the proposed feature breakdown as interactive cards. Users can adjust groupings, rename features, split oversized ones, and merge small ones. The feedback panel generates a structured adjustment prompt to paste back into Claude.

## Full HTML Structure

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>local-review — plan features — [branch]</title>
  <style>
    [data-theme="dark"] {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --add-fg: #7ee787;
      --del-fg: #f85149;
      --green: #238636;
      --yellow: #9e6a03;
      --red: #da3633;
      --dot-green: #3fb950;
      --dot-yellow: #d29922;
      --dot-red: #f85149;
      --accent: #388bfd;
      --bar-green: #238636;
      --bar-yellow: #9e6a03;
      --bar-red: #da3633;
      --feedback-bg: #1c2128;
      --drag-over: rgba(56, 139, 253, 0.15);
    }
    [data-theme="light"] {
      --bg: #f6f8fa;
      --surface: #ffffff;
      --border: #d0d7de;
      --text: #1f2328;
      --text-muted: #57606a;
      --add-fg: #1a7f37;
      --del-fg: #cf222e;
      --dot-green: #1a7f37;
      --dot-yellow: #9a6700;
      --dot-red: #cf222e;
      --accent: #0969da;
      --bar-green: #1a7f37;
      --bar-yellow: #9a6700;
      --bar-red: #cf222e;
      --feedback-bg: #f0f6fc;
      --drag-over: rgba(9, 105, 218, 0.1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding-bottom: 160px;
    }

    /* Header */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .logo { font-weight: 600; font-size: 14px; }
    .subtitle { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
    .branch-tag {
      font-size: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2px 8px;
      color: var(--text-muted);
      font-family: monospace;
    }
    .theme-toggle {
      background: none;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }

    /* Summary bar */
    .summary-bar {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-wrap: wrap;
    }
    .summary-stat { display: flex; flex-direction: column; gap: 2px; }
    .summary-stat-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); }
    .summary-stat-value { font-size: 16px; font-weight: 600; }

    /* Size bar chart */
    .chart-section {
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .bar-label {
      width: 160px;
      font-size: 12px;
      text-align: right;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text);
    }
    .bar-track {
      flex: 1;
      height: 18px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 3px;
      display: flex;
      align-items: center;
      padding: 0 6px;
      font-size: 10px;
      color: #fff;
      font-weight: 500;
      transition: width 0.3s;
    }
    .bar-green { background: var(--bar-green); }
    .bar-yellow { background: var(--bar-yellow); }
    .bar-red { background: var(--bar-red); }
    .bar-meta { width: 80px; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

    /* Feature cards grid */
    .cards-section {
      padding: 0 20px 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .cards-title { font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding-top: 20px; }
    .feature-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .feature-card.drag-over { background: var(--drag-over); border-color: var(--accent); }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .card-header-left { display: flex; align-items: center; gap: 10px; }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      cursor: text;
      border: 1px solid transparent;
      border-radius: 3px;
      padding: 1px 4px;
    }
    .card-title:hover { border-color: var(--border); }
    .card-title:focus { border-color: var(--accent); outline: none; }
    .size-chip {
      font-size: 11px;
      border-radius: 10px;
      padding: 2px 8px;
    }
    .chip-small { background: rgba(46,160,67,0.15); color: var(--dot-green); }
    .chip-medium { background: rgba(210,153,34,0.15); color: var(--dot-yellow); }
    .chip-large { background: rgba(248,81,73,0.15); color: var(--dot-red); }
    .card-actions { display: flex; gap: 6px; }
    .card-btn {
      font-size: 11px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
    }
    .card-btn:hover { color: var(--text); border-color: var(--text-muted); }
    .card-btn.split-btn:hover { color: var(--dot-yellow); border-color: var(--dot-yellow); }
    .card-btn.merge-btn { cursor: default; }
    .card-btn.merge-btn.merge-selected { background: var(--accent); border-color: var(--accent); color: #fff; }

    .card-body { padding: 12px 16px; }
    .card-description {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 10px;
      cursor: text;
      border: 1px solid transparent;
      border-radius: 3px;
      padding: 2px 4px;
      line-height: 1.4;
    }
    .card-description:hover { border-color: var(--border); }
    .card-description:focus { border-color: var(--accent); outline: none; }

    .blast-section {
      background: var(--bg);
      border: 1px solid var(--border);
      border-left: 3px solid var(--dot-yellow);
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-muted);
    }
    .blast-label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--dot-yellow);
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .oversized-warning {
      background: rgba(248,81,73,0.08);
      border: 1px solid rgba(248,81,73,0.4);
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 12px;
      color: var(--dot-red);
    }

    .depends-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .dep-chip {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1px 8px;
      font-size: 11px;
      color: var(--accent);
    }

    .files-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 4px;
    }
    .file-chip {
      font-size: 11px;
      font-family: monospace;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 2px 7px;
      cursor: grab;
      user-select: none;
      color: var(--text-muted);
    }
    .file-chip:hover { border-color: var(--accent); color: var(--text); }
    .file-chip.dragging { opacity: 0.4; }

    /* Feedback panel */
    .feedback-panel {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 420px;
      background: var(--feedback-bg);
      border-top: 1px solid var(--border);
      border-left: 1px solid var(--border);
      border-radius: 8px 0 0 0;
      z-index: 100;
      transition: transform 0.2s;
    }
    .feedback-panel.collapsed { transform: translateY(calc(100% - 36px)); }
    .feedback-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
    }
    .feedback-title { font-size: 13px; font-weight: 500; }
    .feedback-count {
      font-size: 11px;
      background: var(--accent);
      color: #fff;
      border-radius: 10px;
      padding: 1px 7px;
      display: none;
    }
    .feedback-count.visible { display: inline; }
    .feedback-toggle { font-size: 11px; color: var(--text-muted); }
    .feedback-body { padding: 0 12px 12px; }
    .feedback-output {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 10px;
      font-family: monospace;
      font-size: 11px;
      color: var(--text);
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 60px;
    }
    .feedback-empty { color: var(--text-muted); font-style: italic; }
    .copy-feedback {
      margin-top: 8px;
      width: 100%;
      padding: 6px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    .copy-feedback:hover { opacity: 0.85; }
  </style>
</head>
<body>

<header>
  <div style="display:flex;align-items:center;gap:8px;">
    <span class="logo">local-review</span>
    <span class="subtitle">/ plan features</span>
    <span class="branch-tag" id="branch-tag"></span>
  </div>
  <button class="theme-toggle" onclick="toggleTheme()">Toggle theme</button>
</header>

<div class="summary-bar">
  <div class="summary-stat">
    <div class="summary-stat-label">Features</div>
    <div class="summary-stat-value" id="stat-features">0</div>
  </div>
  <div class="summary-stat">
    <div class="summary-stat-label">Total changed</div>
    <div class="summary-stat-value" id="stat-total">0 lines</div>
  </div>
  <div class="summary-stat">
    <div class="summary-stat-label">Oversized</div>
    <div class="summary-stat-value" id="stat-oversized" style="color:var(--dot-red)">0</div>
  </div>
  <div class="summary-stat">
    <div class="summary-stat-label">Avg size</div>
    <div class="summary-stat-value" id="stat-avg">0 lines</div>
  </div>
</div>

<div class="chart-section">
  <div class="chart-title">Feature sizes</div>
  <div id="bar-chart"></div>
</div>

<div class="cards-section">
  <div class="cards-title">Features</div>
  <div id="feature-cards"></div>
</div>

<div class="feedback-panel collapsed" id="feedback-panel">
  <div class="feedback-header" onclick="toggleFeedback()">
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="feedback-title">Adjustments</span>
      <span class="feedback-count" id="feedback-count">0</span>
    </div>
    <span class="feedback-toggle" id="feedback-toggle">▲ expand</span>
  </div>
  <div class="feedback-body">
    <div class="feedback-output" id="feedback-output">
      <span class="feedback-empty">Drag files between features, rename, split or merge to generate adjustments...</span>
    </div>
    <button class="copy-feedback" onclick="copyFeedback()">Copy adjustments prompt</button>
  </div>
</div>

<script id="plan-data" type="application/json">
INJECT_DATA_HERE
</script>

<script>
const data = JSON.parse(document.getElementById('plan-data').textContent);

// State: tracks all adjustments vs original data
const state = {
  features: JSON.parse(JSON.stringify(data.features || [])),
  moves: [],        // { file, from, to }
  renames: [],      // { from, to }
  splits: [],       // { feature, into: [{name, files}] }
  merges: [],       // { a, b, newName }
  descUpdates: [],  // { feature, description }
  mergeCandidate: null,
};

// Init
document.getElementById('branch-tag').textContent = data.branch || 'HEAD';
renderAll();

function renderAll() {
  updateSummaryBar();
  renderBarChart();
  renderCards();
  updateFeedback();
}

function updateSummaryBar() {
  const features = state.features;
  const total = features.reduce((s, f) => s + (f.linesAdded || 0) + (f.linesRemoved || 0), 0);
  const oversized = features.filter(f => (f.linesAdded + f.linesRemoved) > 200).length;
  const avg = features.length ? Math.round(total / features.length) : 0;
  document.getElementById('stat-features').textContent = features.length;
  document.getElementById('stat-total').textContent = `${total} lines`;
  document.getElementById('stat-oversized').textContent = oversized;
  document.getElementById('stat-avg').textContent = `${avg} lines`;
}

function renderBarChart() {
  const chart = document.getElementById('bar-chart');
  const features = state.features;
  if (!features.length) { chart.innerHTML = ''; return; }

  const maxLines = Math.max(...features.map(f => (f.linesAdded || 0) + (f.linesRemoved || 0)));

  chart.innerHTML = features.map(f => {
    const total = (f.linesAdded || 0) + (f.linesRemoved || 0);
    const pct = maxLines > 0 ? Math.max(2, Math.round((total / maxLines) * 100)) : 2;
    const colorClass = total <= 100 ? 'bar-green' : total <= 200 ? 'bar-yellow' : 'bar-red';
    return `
      <div class="bar-row">
        <div class="bar-label" title="${f.name}">${f.name}</div>
        <div class="bar-track">
          <div class="bar-fill ${colorClass}" style="width:${pct}%">${total > 30 ? total + ' lines' : ''}</div>
        </div>
        <div class="bar-meta">${total <= 30 ? total + ' lines' : ''} ${f.size ? `<span style="opacity:0.6">(${f.size})</span>` : ''}</div>
      </div>
    `;
  }).join('');
}

function renderCards() {
  const container = document.getElementById('feature-cards');
  container.innerHTML = '';
  state.features.forEach(f => container.appendChild(makeCard(f)));
}

function makeCard(f) {
  const total = (f.linesAdded || 0) + (f.linesRemoved || 0);
  const sizeLabel = total <= 100 ? 'small' : total <= 200 ? 'medium' : 'large';
  const chipClass = `chip-${sizeLabel}`;
  const isOversized = total > 200;
  const isMergeSelected = state.mergeCandidate === f.name;

  const card = document.createElement('div');
  card.className = 'feature-card';
  card.dataset.feature = f.name;

  // Drag-over handlers for file drops
  card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const { file, from } = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (from !== f.name) moveFile(file, from, f.name);
  });

  card.innerHTML = `
    <div class="card-header">
      <div class="card-header-left">
        <span class="card-title" contenteditable="true" data-feature="${f.name}"
              onblur="renameFeature('${f.name}', this.textContent.trim())"
              onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}">${f.name}</span>
        <span class="size-chip ${chipClass}">${sizeLabel} · ${total} lines</span>
      </div>
      <div class="card-actions">
        ${isOversized ? `<button class="card-btn split-btn" onclick="promptSplit('${f.name}')">Split</button>` : ''}
        <button class="card-btn merge-btn ${isMergeSelected ? 'merge-selected' : ''}"
                onclick="toggleMergeCandidate('${f.name}')">
          ${isMergeSelected ? 'Cancel merge' : 'Merge with...'}
        </button>
      </div>
    </div>
    <div class="card-body">
      ${isOversized ? `<div class="oversized-warning">⚠️ ${total} lines — exceeds 200-line review guideline. Consider splitting this feature into smaller parts.</div>` : ''}
      <div class="card-description" contenteditable="true" data-feature="${f.name}"
           onblur="updateDescription('${f.name}', this.textContent.trim())"
           >${f.description || ''}</div>
      ${f.blastRadius ? `<div class="blast-section"><div class="blast-label">⚡ Blast Radius</div>${f.blastRadius}</div>` : ''}
      ${f.dependsOn?.length ? `<div class="depends-row">Depends on: ${f.dependsOn.map(d => `<span class="dep-chip">${d}</span>`).join('')}</div>` : ''}
      <div class="files-list">
        ${(f.files || []).map(file => `
          <div class="file-chip" draggable="true"
               ondragstart="onFileDragStart(event, '${escAttr(file)}', '${escAttr(f.name)}')"
               ondragend="onFileDragEnd(event)">${file}</div>
        `).join('')}
      </div>
    </div>
  `;

  // If this is the merge target, clicking other cards should complete the merge
  if (state.mergeCandidate && state.mergeCandidate !== f.name) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => completeMerge(f.name));
  }

  return card;
}

// ── Interactions ─────────────────────────────────────────────────────────
function onFileDragStart(e, file, fromFeature) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ file, from: fromFeature }));
  e.target.classList.add('dragging');
}
function onFileDragEnd(e) { e.target.classList.remove('dragging'); }

function moveFile(file, from, to) {
  const fromFeature = state.features.find(f => f.name === from);
  const toFeature = state.features.find(f => f.name === to);
  if (!fromFeature || !toFeature) return;
  fromFeature.files = (fromFeature.files || []).filter(f => f !== file);
  toFeature.files = [...(toFeature.files || []), file];
  state.moves.push({ file, from, to });
  renderAll();
}

function renameFeature(oldName, newName) {
  if (!newName || newName === oldName) return;
  const feature = state.features.find(f => f.name === oldName);
  if (!feature) return;
  feature.name = newName;
  // Update dependsOn references
  state.features.forEach(f => {
    if (f.dependsOn) f.dependsOn = f.dependsOn.map(d => d === oldName ? newName : d);
  });
  state.renames.push({ from: oldName, to: newName });
  renderAll();
}

function updateDescription(featureName, newDesc) {
  const feature = state.features.find(f => f.name === featureName);
  if (!feature || newDesc === feature.description) return;
  feature.description = newDesc;
  state.descUpdates.push({ feature: featureName, description: newDesc });
  updateFeedback();
}

function promptSplit(featureName) {
  const feature = state.features.find(f => f.name === featureName);
  if (!feature) return;
  const files = feature.files || [];
  const mid = Math.ceil(files.length / 2);
  const nameA = featureName + '-a';
  const nameB = featureName + '-b';
  if (!confirm(`Split "${featureName}" into "${nameA}" (${files.slice(0, mid).join(', ')}) and "${nameB}" (${files.slice(mid).join(', ')})?`)) return;

  // Replace the feature with two new ones
  const idx = state.features.findIndex(f => f.name === featureName);
  const newA = { ...feature, name: nameA, files: files.slice(0, mid) };
  const newB = { ...feature, name: nameB, files: files.slice(mid) };
  state.features.splice(idx, 1, newA, newB);
  state.splits.push({ feature: featureName, into: [{ name: nameA, files: files.slice(0, mid) }, { name: nameB, files: files.slice(mid) }] });
  renderAll();
}

function toggleMergeCandidate(featureName) {
  state.mergeCandidate = state.mergeCandidate === featureName ? null : featureName;
  renderCards();
}

function completeMerge(targetName) {
  const candidateName = state.mergeCandidate;
  if (!candidateName || candidateName === targetName) { state.mergeCandidate = null; renderCards(); return; }

  const newName = candidateName + '-' + targetName;
  const a = state.features.find(f => f.name === candidateName);
  const b = state.features.find(f => f.name === targetName);
  if (!a || !b) return;

  const merged = {
    name: newName,
    description: a.description || b.description,
    files: [...(a.files || []), ...(b.files || [])],
    linesAdded: (a.linesAdded || 0) + (b.linesAdded || 0),
    linesRemoved: (a.linesRemoved || 0) + (b.linesRemoved || 0),
    blastRadius: [a.blastRadius, b.blastRadius].filter(Boolean).join(' '),
    dependsOn: [...new Set([...(a.dependsOn || []), ...(b.dependsOn || [])])].filter(d => d !== candidateName && d !== targetName),
    size: '',
  };

  state.features = state.features.filter(f => f.name !== candidateName && f.name !== targetName);
  state.features.push(merged);
  state.merges.push({ a: candidateName, b: targetName, newName });
  state.mergeCandidate = null;
  renderAll();
}

// ── Feedback ─────────────────────────────────────────────────────────────
function updateFeedback() {
  const parts = [];
  let count = 0;

  if (state.moves.length) {
    state.moves.forEach(m => {
      parts.push(`MOVE: ${m.file} → from [${m.from}] to [${m.to}]`);
      count++;
    });
  }
  if (state.renames.length) {
    state.renames.forEach(r => {
      parts.push(`RENAME: [${r.from}] → [${r.to}]`);
      count++;
    });
  }
  if (state.splits.length) {
    state.splits.forEach(s => {
      parts.push(`SPLIT: [${s.feature}] into [${s.into[0].name}] (${s.into[0].files.join(', ')}) and [${s.into[1].name}] (${s.into[1].files.join(', ')})`);
      count++;
    });
  }
  if (state.merges.length) {
    state.merges.forEach(m => {
      parts.push(`MERGE: [${m.a}] and [${m.b}] → [${m.newName}]`);
      count++;
    });
  }
  if (state.descUpdates.length) {
    state.descUpdates.forEach(u => {
      parts.push(`DESCRIPTION UPDATE: [${u.feature}] → "${u.description}"`);
      count++;
    });
  }

  const output = document.getElementById('feedback-output');
  const countEl = document.getElementById('feedback-count');

  if (parts.length === 0) {
    output.innerHTML = '<span class="feedback-empty">Drag files between features, rename, split or merge to generate adjustments...</span>';
    countEl.classList.remove('visible');
  } else {
    output.textContent = `Feature plan adjustments for PLAN.md:\n\n${parts.join('\n')}`;
    countEl.textContent = count;
    countEl.classList.add('visible');
    document.getElementById('feedback-panel').classList.remove('collapsed');
    document.getElementById('feedback-toggle').textContent = '▼ collapse';
  }
}

function toggleFeedback() {
  const panel = document.getElementById('feedback-panel');
  const toggle = document.getElementById('feedback-toggle');
  panel.classList.toggle('collapsed');
  toggle.textContent = panel.classList.contains('collapsed') ? '▲ expand' : '▼ collapse';
}

function copyFeedback() {
  const text = document.getElementById('feedback-output').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-feedback');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
}

// ── Utils ─────────────────────────────────────────────────────────────────
function escAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
</script>
</body>
</html>
```

## Data format to inject

Replace `INJECT_DATA_HERE` with:

```json
{
  "branch": "feature/auth",
  "totalChanged": 350,
  "features": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware wired into all protected routes",
      "files": ["src/auth.ts", "src/middleware/auth.ts", "src/types/user.ts"],
      "blastRadius": "All routes behind auth guard; token shape changes affect the client SDK and any integration tests that mock auth.",
      "dependsOn": [],
      "linesAdded": 42,
      "linesRemoved": 8,
      "size": "small"
    },
    {
      "name": "api-routes",
      "description": "New REST handlers for /users and /sessions endpoints",
      "files": ["src/routes/api.ts", "src/handlers/users.ts", "src/handlers/sessions.ts"],
      "blastRadius": "Public API contract — breaking changes in request/response shape affect all API consumers and the OpenAPI spec.",
      "dependsOn": ["auth-middleware"],
      "linesAdded": 220,
      "linesRemoved": 80,
      "size": "large"
    }
  ]
}
```

## Sizing rules reference

| Lines changed | Label | Color | Review time |
|---|---|---|---|
| ≤ 100 | small | green | ~10 min |
| 101–200 | medium | yellow | ~30 min |
| > 200 | large | red | Needs splitting |
