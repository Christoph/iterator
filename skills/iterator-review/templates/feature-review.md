# Feature Review HTML Template

Use this template to generate the self-contained HTML review page for `/iterator-review`.

## Overview

A two-panel layout: feature list on the left, feature detail (hunks + feedback) on the right. Fixed feedback panel at bottom-right. Dark theme default. All CSS/JS inlined — no external dependencies.

## Full HTML Structure

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iterator — [branch]</title>
  <style>
    /* === Design tokens === */
    [data-theme="dark"] {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --text-code: #e6edf3;
      --add-bg: rgba(46, 160, 67, 0.15);
      --add-fg: #7ee787;
      --del-bg: rgba(248, 81, 73, 0.15);
      --del-fg: #f85149;
      --hunk-bg: rgba(56, 139, 253, 0.1);
      --hunk-fg: #79c0ff;
      --green: #238636;
      --yellow: #9e6a03;
      --red: #da3633;
      --dot-green: #3fb950;
      --dot-yellow: #d29922;
      --dot-red: #f85149;
      --accent: #388bfd;
      --feedback-bg: #1c2128;
    }
    [data-theme="light"] {
      --bg: #f6f8fa;
      --surface: #ffffff;
      --border: #d0d7de;
      --text: #1f2328;
      --text-muted: #57606a;
      --text-code: #1f2328;
      --add-bg: #dafbe1;
      --add-fg: #1a7f37;
      --del-bg: #ffebe9;
      --del-fg: #cf222e;
      --hunk-bg: #ddf4ff;
      --hunk-fg: #0969da;
      --dot-green: #1a7f37;
      --dot-yellow: #9a6700;
      --dot-red: #cf222e;
      --accent: #0969da;
      --feedback-bg: #f0f6fc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* === Header === */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo { font-weight: 600; font-size: 14px; color: var(--text); }
    .branch-tag {
      font-size: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2px 8px;
      color: var(--text-muted);
      font-family: monospace;
    }
    .commit-tag {
      font-size: 12px;
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

    /* === Main layout === */
    .main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* === Sidebar === */
    .sidebar {
      width: 220px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      background: var(--surface);
      padding: 8px 0;
    }
    .sidebar-section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      padding: 8px 12px 4px;
    }
    .feature-item {
      padding: 8px 12px;
      cursor: pointer;
      border-left: 3px solid transparent;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .feature-item:hover { background: var(--bg); }
    .feature-item.active {
      border-left-color: var(--accent);
      background: var(--bg);
    }
    .complexity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .dot-green { background: var(--dot-green); }
    .dot-yellow { background: var(--dot-yellow); }
    .dot-red { background: var(--dot-red); }
    .feature-meta { flex: 1; min-width: 0; }
    .feature-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .feature-stats {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .stat-add { color: var(--add-fg); }
    .stat-del { color: var(--del-fg); }
    .status-badge {
      font-size: 10px;
      border-radius: 3px;
      padding: 1px 5px;
      margin-top: 3px;
      display: inline-block;
    }
    .status-approved { background: rgba(46,160,67,0.2); color: var(--dot-green); }
    .status-changes { background: rgba(248,81,73,0.2); color: var(--dot-red); }
    .status-question { background: rgba(210,153,34,0.2); color: var(--dot-yellow); }

    /* === Detail panel === */
    .detail {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 120px; /* room for feedback panel */
    }
    .feature-header {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .feature-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .feature-description {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 12px;
    }
    .feature-note-btn {
      font-size: 12px;
      background: none;
      border: 1px dashed var(--border);
      color: var(--text-muted);
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
    }
    .feature-note-btn:hover { border-color: var(--accent); color: var(--accent); }
    .feature-note-area {
      display: none;
      margin-top: 8px;
    }
    .feature-note-area.open { display: block; }
    .feature-note-area textarea {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      padding: 8px;
      font-size: 13px;
      resize: vertical;
      min-height: 60px;
    }
    .note-actions { margin-top: 4px; display: flex; gap: 6px; }
    .note-save, .note-cancel {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid var(--border);
      cursor: pointer;
      background: var(--surface);
      color: var(--text);
    }
    .note-save { background: var(--accent); border-color: var(--accent); color: #fff; }

    .meta-row {
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); }
    .meta-value { font-size: 13px; }

    .blast-radius {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--dot-yellow);
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.5;
    }
    .blast-radius-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--dot-yellow);
      margin-bottom: 4px;
      letter-spacing: 0.05em;
    }

    .status-buttons {
      display: flex;
      gap: 6px;
      margin-bottom: 20px;
    }
    .status-btn {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid var(--border);
      cursor: pointer;
      background: var(--surface);
      color: var(--text);
    }
    .status-btn:hover { opacity: 0.8; }
    .status-btn.active-approved { background: rgba(46,160,67,0.2); border-color: var(--dot-green); color: var(--dot-green); }
    .status-btn.active-changes { background: rgba(248,81,73,0.2); border-color: var(--dot-red); color: var(--dot-red); }
    .status-btn.active-question { background: rgba(210,153,34,0.2); border-color: var(--dot-yellow); color: var(--dot-yellow); }

    .size-warning {
      background: rgba(248,81,73,0.1);
      border: 1px solid var(--dot-red);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--dot-red);
      margin-bottom: 16px;
    }

    /* === File hunks === */
    .file-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .file-card-header {
      padding: 8px 12px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-family: monospace;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .file-path { color: var(--text); }
    .file-change-stats { color: var(--text-muted); font-size: 11px; }

    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .diff-line { cursor: pointer; }
    .diff-line:hover td { filter: brightness(1.2); }
    .diff-line.selected td { outline: 1px solid var(--accent); }
    .diff-line td { padding: 1px 0; }
    .line-num {
      width: 40px;
      text-align: right;
      padding: 0 8px;
      color: var(--text-muted);
      user-select: none;
    }
    .line-prefix {
      width: 16px;
      text-align: center;
      user-select: none;
    }
    .line-content { padding: 0 8px; white-space: pre-wrap; word-break: break-all; }
    .line-comment-indicator {
      width: 20px;
      text-align: center;
      user-select: none;
      color: var(--accent);
    }

    .diff-line.addition td { background: var(--add-bg); color: var(--add-fg); }
    .diff-line.deletion td { background: var(--del-bg); color: var(--del-fg); }
    .diff-line.hunk-header td { background: var(--hunk-bg); color: var(--hunk-fg); }
    .diff-line.context td { color: var(--text-code); }

    .comment-row { display: none; }
    .comment-row.open { display: table-row; }
    .comment-cell {
      padding: 6px 8px 6px 56px;
      background: var(--bg);
    }
    .comment-cell textarea {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      padding: 6px 8px;
      font-size: 12px;
      font-family: -apple-system, sans-serif;
      resize: vertical;
      min-height: 48px;
    }
    .comment-actions { display: flex; gap: 6px; margin-top: 4px; }
    .comment-save, .comment-cancel {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid var(--border);
      cursor: pointer;
      background: var(--surface);
      color: var(--text);
    }
    .comment-save { background: var(--accent); border-color: var(--accent); color: #fff; }

    /* === Feedback panel === */
    .feedback-panel {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 380px;
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
      max-height: 180px;
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

    /* === Empty state === */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .empty-title { font-size: 16px; margin-bottom: 8px; }
    .empty-hint { font-size: 13px; }

    .no-features-banner {
      background: var(--hunk-bg);
      border: 1px solid var(--hunk-fg);
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--hunk-fg);
      margin-bottom: 20px;
    }
  </style>
</head>
<body>

<header>
  <div class="header-left">
    <span class="logo">iterator</span>
    <span class="branch-tag" id="branch-tag"></span>
    <span class="commit-tag" id="commit-tag"></span>
  </div>
  <button class="theme-toggle" onclick="toggleTheme()">Toggle theme</button>
</header>

<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="detail" id="detail">
    <div class="empty-state">
      <div class="empty-title">Select a feature to review</div>
      <div class="empty-hint">Choose a feature from the left panel</div>
    </div>
  </div>
</div>

<div class="feedback-panel" id="feedback-panel">
  <div class="feedback-header" onclick="toggleFeedback()">
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="feedback-title">Feedback</span>
      <span class="feedback-count" id="feedback-count">0</span>
    </div>
    <span class="feedback-toggle" id="feedback-toggle">▲ expand</span>
  </div>
  <div class="feedback-body">
    <div class="feedback-output" id="feedback-output">
      <span class="feedback-empty">Add comments or notes to generate feedback prompt...</span>
    </div>
    <button class="copy-feedback" onclick="copyFeedback()">Copy feedback prompt</button>
  </div>
</div>

<script id="review-data" type="application/json">
INJECT_DATA_HERE
</script>

<script>
// ── State ────────────────────────────────────────────────────────────────
const data = JSON.parse(document.getElementById('review-data').textContent);
const state = {
  activeFeature: null,
  featureStatuses: {},   // name → 'approved' | 'changes' | 'question' | null
  featureNotes: {},      // name → string
  lineComments: {},      // lineId → string
  feedbackCollapsed: true,
};

// ── Init ─────────────────────────────────────────────────────────────────
document.getElementById('branch-tag').textContent = data.branch || 'HEAD';
document.getElementById('commit-tag').textContent = data.commit ? data.commit.slice(0, 40) : '';

renderSidebar();
if (data.features && data.features.length > 0) {
  selectFeature(data.features[0].name);
} else if (data.uncategorized && data.uncategorized.length > 0) {
  selectFeature('__uncategorized__');
}

// ── Sidebar ──────────────────────────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';

  const allFeatures = [...(data.features || [])];
  const hasUncategorized = data.uncategorized && data.uncategorized.length > 0;
  const hasPlanFile = data.hasPlanFile !== false;

  if (!hasPlanFile) {
    const banner = document.createElement('div');
    banner.style.cssText = 'font-size:11px;padding:8px 12px;color:var(--text-muted);border-bottom:1px solid var(--border);';
    banner.textContent = 'No PLAN.md features found. Run /iterator-plan-features first.';
    sb.appendChild(banner);
  }

  if (allFeatures.length > 0) {
    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.textContent = 'Features';
    sb.appendChild(label);

    allFeatures.forEach(f => sb.appendChild(makeFeatureItem(f)));
  }

  if (hasUncategorized) {
    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.style.marginTop = '8px';
    label.textContent = 'Uncategorized';
    sb.appendChild(label);

    const unc = {
      name: '__uncategorized__',
      description: 'Files not matched by any feature',
      stats: data.uncategorized.reduce((acc, f) => ({
        added: acc.added + (f.stats?.added || 0),
        removed: acc.removed + (f.stats?.removed || 0),
        files: acc.files + 1,
        complexity: 'red',
      }), { added: 0, removed: 0, files: 0, complexity: 'green' }),
    };
    sb.appendChild(makeFeatureItem(unc));
  }
}

function makeFeatureItem(f) {
  const item = document.createElement('div');
  item.className = 'feature-item';
  item.dataset.name = f.name;
  item.onclick = () => selectFeature(f.name);

  const complexity = f.stats?.complexity || 'green';
  const status = state.featureStatuses[f.name];

  item.innerHTML = `
    <div class="complexity-dot dot-${complexity}"></div>
    <div class="feature-meta">
      <div class="feature-name">${f.name === '__uncategorized__' ? 'uncategorized' : f.name}</div>
      <div class="feature-stats">
        ${f.stats ? `<span class="stat-add">+${f.stats.added}</span> <span class="stat-del">-${f.stats.removed}</span> · ${f.stats.files} file${f.stats.files !== 1 ? 's' : ''}` : ''}
      </div>
      ${status ? `<div class="status-badge status-${status === 'changes' ? 'changes' : status === 'approved' ? 'approved' : 'question'}">${status === 'changes' ? 'Needs Changes' : status === 'approved' ? 'Approved' : 'Question'}</div>` : ''}
    </div>
  `;
  return item;
}

// ── Feature detail ────────────────────────────────────────────────────────
function selectFeature(name) {
  state.activeFeature = name;

  document.querySelectorAll('.feature-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === name);
  });

  const detail = document.getElementById('detail');

  let feature = data.features?.find(f => f.name === name);
  const isUncategorized = name === '__uncategorized__';

  if (isUncategorized) {
    feature = {
      name: '__uncategorized__',
      description: 'Files not matched by any feature in PLAN.md. Run /iterator-plan-features to assign them.',
      blastRadius: null,
      dependsOn: [],
      files: data.uncategorized || [],
    };
  }

  if (!feature) {
    detail.innerHTML = '<div class="empty-state"><div class="empty-title">Feature not found</div></div>';
    return;
  }

  const totalChanged = (feature.stats?.added || 0) + (feature.stats?.removed || 0);
  const showWarning = totalChanged > 200;
  const status = state.featureStatuses[name];
  const note = state.featureNotes[name] || '';

  detail.innerHTML = `
    <div class="feature-header">
      <div class="feature-title">${isUncategorized ? 'Uncategorized' : feature.name}</div>
      <div class="feature-description">${feature.description || ''}</div>
      <button class="feature-note-btn" onclick="toggleFeatureNote('${name}')">
        ${note ? 'Edit note' : '+ Add feature note'}
      </button>
      <div class="feature-note-area ${note ? 'open' : ''}" id="feature-note-${name}">
        <textarea id="feature-note-ta-${name}" placeholder="Note about this feature...">${note}</textarea>
        <div class="note-actions">
          <button class="note-save" onclick="saveFeatureNote('${name}')">Save</button>
          <button class="note-cancel" onclick="toggleFeatureNote('${name}')">Cancel</button>
        </div>
      </div>
    </div>

    ${showWarning ? `<div class="size-warning">⚠️ This feature has ${totalChanged} changed lines — larger than the 200-line review guideline. Consider splitting it in /iterator-plan-features.</div>` : ''}

    <div class="meta-row">
      ${feature.dependsOn?.length ? `<div class="meta-item"><div class="meta-label">Depends on</div><div class="meta-value">${feature.dependsOn.join(', ')}</div></div>` : ''}
      ${feature.stats ? `<div class="meta-item"><div class="meta-label">Changed</div><div class="meta-value"><span class="stat-add">+${feature.stats.added}</span> <span class="stat-del">-${feature.stats.removed}</span></div></div>` : ''}
      ${feature.stats ? `<div class="meta-item"><div class="meta-label">Files</div><div class="meta-value">${feature.stats.files}</div></div>` : ''}
    </div>

    ${feature.blastRadius ? `
    <div class="blast-radius">
      <div class="blast-radius-label">⚡ Blast Radius</div>
      ${feature.blastRadius}
    </div>` : ''}

    <div class="status-buttons">
      <button class="status-btn ${status === 'approved' ? 'active-approved' : ''}" onclick="setStatus('${name}', 'approved')">✓ Approved</button>
      <button class="status-btn ${status === 'changes' ? 'active-changes' : ''}" onclick="setStatus('${name}', 'changes')">✗ Needs Changes</button>
      <button class="status-btn ${status === 'question' ? 'active-question' : ''}" onclick="setStatus('${name}', 'question')">? Question</button>
    </div>

    <div id="file-hunks"></div>
  `;

  renderFileHunks(feature);
}

function renderFileHunks(feature) {
  const container = document.getElementById('file-hunks');
  if (!feature.files || feature.files.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">No changes</div></div>';
    return;
  }

  feature.files.forEach((file, fi) => {
    const card = document.createElement('div');
    card.className = 'file-card';

    const fileAdded = file.hunks?.reduce((s, h) => s + h.lines.filter(l => l.type === 'addition').length, 0) || 0;
    const fileRemoved = file.hunks?.reduce((s, h) => s + h.lines.filter(l => l.type === 'deletion').length, 0) || 0;

    card.innerHTML = `
      <div class="file-card-header">
        <span class="file-path">${file.path}</span>
        <span class="file-change-stats"><span class="stat-add">+${fileAdded}</span> <span class="stat-del">-${fileRemoved}</span></span>
      </div>
    `;

    const table = document.createElement('table');
    table.className = 'diff-table';

    (file.hunks || []).forEach((hunk, hi) => {
      // Hunk header row
      const headerRow = document.createElement('tr');
      headerRow.className = 'diff-line hunk-header';
      headerRow.innerHTML = `<td class="line-num"></td><td class="line-num"></td><td class="line-prefix"></td><td class="line-content">${escHtml(hunk.header)}</td><td class="line-comment-indicator"></td>`;
      table.appendChild(headerRow);

      let oldNum = hunk.oldStart || 0;
      let newNum = hunk.newStart || 0;

      hunk.lines.forEach((line, li) => {
        const lineId = `${fi}-${hi}-${li}`;
        const hasComment = !!state.lineComments[lineId];
        const row = document.createElement('tr');
        row.className = `diff-line ${line.type}`;
        row.dataset.lineId = lineId;
        row.dataset.file = file.path;
        row.dataset.content = line.content;

        let oldNumStr = '', newNumStr = '';
        if (line.type === 'context') { oldNumStr = oldNum++; newNumStr = newNum++; }
        else if (line.type === 'deletion') { oldNumStr = oldNum++; }
        else if (line.type === 'addition') { newNumStr = newNum++; }

        const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
        row.innerHTML = `
          <td class="line-num">${oldNumStr}</td>
          <td class="line-num">${newNumStr}</td>
          <td class="line-prefix">${prefix}</td>
          <td class="line-content">${escHtml(line.content)}</td>
          <td class="line-comment-indicator">${hasComment ? '💬' : ''}</td>
        `;
        row.onclick = () => toggleLineComment(lineId, row);
        table.appendChild(row);

        // Comment row
        const commentRow = document.createElement('tr');
        commentRow.className = `comment-row ${hasComment || state.lineComments[lineId] !== undefined ? '' : ''}`;
        commentRow.id = `comment-row-${lineId}`;
        commentRow.innerHTML = `
          <td colspan="5" class="comment-cell">
            <textarea id="comment-ta-${lineId}" placeholder="Add a comment...">${state.lineComments[lineId] || ''}</textarea>
            <div class="comment-actions">
              <button class="comment-save" onclick="saveLineComment('${lineId}')">Save</button>
              <button class="comment-cancel" onclick="cancelLineComment('${lineId}')">Cancel</button>
            </div>
          </td>
        `;
        table.appendChild(commentRow);
      });
    });

    card.appendChild(table);
    container.appendChild(card);
  });
}

// ── Interactions ─────────────────────────────────────────────────────────
function toggleFeatureNote(name) {
  const area = document.getElementById(`feature-note-${name}`);
  area?.classList.toggle('open');
}

function saveFeatureNote(name) {
  const ta = document.getElementById(`feature-note-ta-${name}`);
  state.featureNotes[name] = ta?.value || '';
  updateFeedback();
  // Update button text
  const btn = document.querySelector('.feature-note-btn');
  if (btn) btn.textContent = state.featureNotes[name] ? 'Edit note' : '+ Add feature note';
}

function setStatus(name, status) {
  state.featureStatuses[name] = state.featureStatuses[name] === status ? null : status;
  renderSidebar();
  selectFeature(name);
  updateFeedback();
}

function toggleLineComment(lineId, row) {
  const commentRow = document.getElementById(`comment-row-${lineId}`);
  if (!commentRow) return;
  const isOpen = commentRow.classList.contains('open');

  // Close all open comment rows
  document.querySelectorAll('.comment-row.open').forEach(r => r.classList.remove('open'));
  document.querySelectorAll('.diff-line.selected').forEach(r => r.classList.remove('selected'));

  if (!isOpen) {
    commentRow.classList.add('open');
    row.classList.add('selected');
    document.getElementById(`comment-ta-${lineId}`)?.focus();
  }
}

function saveLineComment(lineId) {
  const ta = document.getElementById(`comment-ta-${lineId}`);
  const val = ta?.value.trim();
  if (val) state.lineComments[lineId] = val;
  else delete state.lineComments[lineId];
  updateFeedback();
  // Re-render to update the 💬 indicator
  selectFeature(state.activeFeature);
}

function cancelLineComment(lineId) {
  document.getElementById(`comment-row-${lineId}`)?.classList.remove('open');
  document.querySelectorAll('.diff-line.selected').forEach(r => r.classList.remove('selected'));
}

// ── Feedback ─────────────────────────────────────────────────────────────
function updateFeedback() {
  const parts = [];
  parts.push(`Code review feedback for ${data.branch || 'HEAD'}:\n`);

  let hasAny = false;

  // Feature-level
  const allFeatureNames = [...(data.features || []).map(f => f.name), '__uncategorized__'];
  allFeatureNames.forEach(name => {
    const status = state.featureStatuses[name];
    const note = state.featureNotes[name];
    const featureLine = name === '__uncategorized__' ? 'uncategorized' : name;

    if (status || note) {
      hasAny = true;
      parts.push(`\n[${featureLine}]${status ? ` STATUS: ${status === 'approved' ? 'Approved' : status === 'changes' ? 'Needs Changes' : 'Question'}` : ''}`);
      if (note) parts.push(`  Feature note: ${note}`);
    }
  });

  // Line-level comments
  Object.entries(state.lineComments).forEach(([lineId, comment]) => {
    hasAny = true;
    const row = document.querySelector(`[data-line-id="${lineId}"]`);
    if (!row) return;
    const file = row.dataset.file;
    const content = row.dataset.content;
    const isAdd = row.classList.contains('addition');
    const isDel = row.classList.contains('deletion');
    const prefix = isAdd ? '(+)' : isDel ? '(-)' : '';
    parts.push(`\n${file} ${prefix}\n  ${content?.trim()}\n  Comment: ${comment}`);
  });

  const output = document.getElementById('feedback-output');
  const count = document.getElementById('feedback-count');
  const totalItems = Object.keys(state.featureStatuses).filter(k => state.featureStatuses[k]).length +
                     Object.keys(state.featureNotes).filter(k => state.featureNotes[k]).length +
                     Object.keys(state.lineComments).length;

  if (!hasAny) {
    output.innerHTML = '<span class="feedback-empty">Add comments or notes to generate feedback prompt...</span>';
    count.classList.remove('visible');
  } else {
    output.textContent = parts.join('\n');
    count.textContent = totalItems;
    count.classList.add('visible');
    // Auto-expand when first item added
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
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
</script>
</body>
</html>
```

## How to embed data

Replace `INJECT_DATA_HERE` with the JSON blob built from the diff analysis. The structure:

```json
{
  "branch": "feature/auth",
  "commit": "abc1234 Add JWT middleware",
  "hasPlanFile": true,
  "features": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware wired into all protected routes",
      "blastRadius": "All routes behind auth guard; token shape changes affect the client SDK",
      "dependsOn": [],
      "stats": {
        "added": 42,
        "removed": 8,
        "files": 3,
        "complexity": "yellow"
      },
      "files": [
        {
          "path": "src/auth.ts",
          "hunks": [
            {
              "header": "@@ -41,5 +41,12 @@ function login",
              "oldStart": 41,
              "newStart": 41,
              "lines": [
                { "type": "context", "content": "function login(user) {" },
                { "type": "addition", "content": "  const jwt = sign(payload, SECRET);" },
                { "type": "deletion", "content": "  return user.id;" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "uncategorized": []
}
```

## Parsing git diff output into this structure

When generating the HTML, Claude should parse `git diff HEAD` output:

1. Split on `diff --git a/...` to get per-file sections
2. For each file, extract the path from the `--- a/path` or `+++ b/path` line
3. Split on `@@ ` to get hunks; parse the `@@ -old,count +new,count @@` header
4. For each line after the header:
   - Lines starting with `+` (not `+++`): type = "addition"
   - Lines starting with `-` (not `---`): type = "deletion"
   - Other lines: type = "context"
   - Strip the leading `+`/`-`/` ` prefix from content

Feature-to-file mapping:
- For each file path, check each feature's `files` list
- Match exact paths or simple glob patterns (e.g., `src/handlers/*.ts` matches `src/handlers/users.ts`)
- First matching feature wins
- Unmatched files go to `uncategorized`

Complexity calculation per feature:
- Sum all `addition` + `deletion` lines across all files in the feature
- ≤ 100 → "green"
- 101–200 → "yellow"
- > 200 → "red"
