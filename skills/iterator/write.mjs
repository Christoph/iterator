#!/usr/bin/env node
/**
 * iterator: deterministic bundle writer.
 *
 * Takes an op payload as JSON on stdin, writes/updates the memory/ OKF bundle,
 * and prints one JSON result line — so the SKILL.mds never hand-author
 * frontmatter, timestamps, indexes, or the log:
 *
 *   node <skill-dir>/write.mjs [project-root] << 'PAYLOAD'
 *   { "op": "...", ... }
 *   PAYLOAD
 *
 * Ops:
 *   plan          write memory/plan.md (+ format.md/index.md/log.md on first
 *                 run) from approved sections + dependencies; preserves an
 *                 existing `# Chunks` section on re-plan
 *   chunks        write the full chunk set (one OKF file per chunk, status
 *                 draft|pending — the chunker writes drafts), delete removed
 *                 slugs, validate acyclic deps + references BEFORE writing,
 *                 regenerate all indexes; never rewrites a done chunk
 *   design        write memory/design.md (type: Design) — the project's design
 *                 parameters captured by /iterator-design; preserves `created`
 *                 on re-run so revisions keep the original capture date
 *   update-chunk  targeted frontmatter update on one chunk (status flips,
 *                 tests, reviewed, done) + optional `# Review` note and
 *                 commits-list entry; regenerates indexes
 *   adjustments   apply the chunk UI's mechanical edits verbatim (moves,
 *                 renames incl. depends_on rewiring, description updates) —
 *                 the server's `plan-adjustments` output pipes in unchanged;
 *                 `accept: true` additionally promotes every draft to pending
 *
 * Every op updates timestamps (override with $ITERATOR_NOW for tests),
 * regenerates memory/chunks/index.md + the plan `# Chunks` section +
 * memory/index.md, and prepends a memory/log.md entry. On success prints
 * {"ok":true,...}; on any validation error prints {"ok":false,"error":...}
 * and exits 1 without writing.
 */
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frontmatter, listy, loadBundle, sections } from './gather.mjs';

const nowIso = () => process.env.ITERATOR_NOW || new Date().toISOString();
const today = () => nowIso().slice(0, 10);

/** Quote a frontmatter scalar only when YAML would misread it bare. */
function fmScalar(v) {
  const s = String(v).replace(/\s+/g, ' ').trim();
  return /[:#[\]{}"'`|>&*!%@\n]/.test(s) ? JSON.stringify(s) : s;
}

const fail = (msg) => { throw new Error(msg); };

// ---------------------------------------------------------------------------
// Textual frontmatter/body editing (preserves everything not being changed —
// the parser in gather.mjs is lossy for block lists, so never round-trip
// through it when updating an existing file).

function splitDoc(raw) {
  if (raw.startsWith('---\n')) {
    const end = raw.indexOf('\n---', 4);
    if (end !== -1) {
      const nl = raw.indexOf('\n', end + 4);
      return { fm: raw.slice(4, end), body: nl === -1 ? '' : raw.slice(nl + 1) };
    }
  }
  return { fm: null, body: raw };
}

const joinDoc = (fm, body) => `---\n${fm}\n---\n${body}`;

function formatFmValue(key, value) {
  if (Array.isArray(value)) {
    const quoted = ['files', 'tests'].includes(key);
    return `[${value.map(v => quoted ? JSON.stringify(String(v)) : fmScalar(v)).join(', ')}]`;
  }
  return fmScalar(value);
}

/** Set/replace top-level scalar or inline-list keys in a frontmatter block. */
export function setFmKeys(fm, obj) {
  let out = fm;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const line = `${k}: ${formatFmValue(k, v)}`;
    const re = new RegExp(`^${k}:.*$`, 'm');
    out = re.test(out) ? out.replace(re, line) : `${out.replace(/\s*$/, '')}\n${line}`;
  }
  return out;
}

/** Append one { sha, kind, date } entry to the commits block list. */
export function appendCommitFm(fm, { sha, kind, date }) {
  if (!sha || !kind) fail('appendCommit needs { sha, kind }');
  const entry = [`  - sha: ${sha}`, `    kind: ${kind}`, `    date: ${date || today()}`];
  const lines = fm.split('\n');
  const i = lines.findIndex(l => /^commits:\s*$/.test(l));
  if (i === -1) return `${fm.replace(/\s*$/, '')}\ncommits:\n${entry.join('\n')}`;
  let j = i + 1;
  while (j < lines.length && /^\s+\S/.test(lines[j])) j++;
  lines.splice(j, 0, ...entry);
  return lines.join('\n');
}

/** Insert a dated review bullet under `# Review`, newest-first. */
export function appendReviewBody(bodyText, line, date) {
  const d = date || today();
  const lines = bodyText.split('\n');
  const h = lines.findIndex(l => /^# Review\s*$/.test(l));
  if (h === -1) {
    return `${bodyText.replace(/\s*$/, '')}\n\n# Review\n\n## ${d}\n${line}\n`;
  }
  let j = h + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  if (lines[j] === `## ${d}`) lines.splice(j + 1, 0, line);
  else lines.splice(j, 0, `## ${d}`, line, '');
  return lines.join('\n');
}

/** Replace one `# Heading` section's content in a body (fence-aware). */
export function replaceSection(raw, name, content) {
  const { fm, body: bodyText } = splitDoc(raw);
  const lines = bodyText.split('\n');
  let fence = false, start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) fence = !fence;
    if (fence) continue;
    if (start === -1 && lines[i].trim() === `# ${name}`) { start = i; continue; }
    if (start !== -1 && /^# /.test(lines[i])) { end = i; break; }
  }
  const block = [`# ${name}`, '', content, ''];
  const out = start === -1
    ? [...lines, ...(lines[lines.length - 1]?.trim() ? [''] : []), ...block]
    : [...lines.slice(0, start), ...block, ...lines.slice(end)];
  const newBody = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  return fm === null ? newBody : joinDoc(fm, newBody);
}

// ---------------------------------------------------------------------------
// Topological order + validation

/** Kahn's algorithm; ties broken by input order (creation order). */
export function topoSort(items) {
  const slugs = new Set(items.map(c => c.slug));
  const missing = [];
  for (const c of items) {
    for (const d of c.dependsOn) {
      if (!slugs.has(d)) missing.push(`${c.slug} → ${d}`);
    }
  }
  const order = [];
  const placed = new Set();
  while (placed.size < items.length) {
    const next = items.find(c => !placed.has(c.slug) &&
      c.dependsOn.every(d => placed.has(d) || !slugs.has(d)));
    if (!next) break; // remaining nodes form a cycle
    placed.add(next.slug);
    order.push(next.slug);
  }
  return {
    order,
    missing,
    cycle: placed.size < items.length
      ? items.filter(c => !placed.has(c.slug)).map(c => c.slug)
      : [],
  };
}

// ---------------------------------------------------------------------------
// Generated files (chunks/index.md, plan # Chunks, memory/index.md, log.md)

function chunkIndexLine(c) {
  const status = c.fm.status === 'done' ? '✅ done'
    : c.fm.status === 'draft' ? '📝 draft' : '⬜ pending';
  const badge = c.fm.tests_status === 'red' ? ' · 🔴 tests red'
    : c.fm.tests_status === 'green' ? ' · 🟢 tests green' : '';
  const deps = listy(c.fm.depends_on).length
    ? ` · depends: ${listy(c.fm.depends_on).join(', ')}` : '';
  return `* [${c.fm.title || c.slug}](${c.slug}.md) - ${status}${badge} · ${c.fm.size || 'small'}${deps} · ${c.fm.description || ''}`;
}

/** Rebuild every generated file from the bundle's current on-disk state. */
export function regenerate(root) {
  const b = loadBundle(root);
  const { order } = topoSort(b.chunks.map(c => ({ slug: c.slug, dependsOn: listy(c.fm.depends_on) })));
  const ordered = [...order, ...b.chunks.map(c => c.slug).filter(s => !order.includes(s))]
    .map(s => b.chunks.find(c => c.slug === s));

  if (existsSync(join(b.memDir, 'chunks')) && ordered.length) {
    writeFileSync(join(b.memDir, 'chunks', 'index.md'),
      `# Chunks\n\n${ordered.map(chunkIndexLine).join('\n')}\n`);
  }

  if (b.plan && ordered.length) {
    const links = ordered
      .map(c => `* [${c.fm.title || c.slug}](/chunks/${c.slug}.md) - ${c.fm.description || ''}`)
      .join('\n');
    writeFileSync(join(b.memDir, 'plan.md'), replaceSection(b.plan.raw, 'Chunks', links));
  }

  const designLine = b.design
    ? `\n* [Design](design.md) - ${b.design.fm.description || 'Project design parameters.'}`
    : '';
  writeFileSync(join(b.memDir, 'index.md'), `---
okf_version: "0.1"
---

# iterator memory

* [Plan](plan.md) - ${b.plan?.fm.description || 'The plan concept.'}
* [Format](format.md) - Metadata schema for this bundle.${designLine}
* [Chunks](chunks/) - One document per implementation chunk.
* [Log](log.md) - Chronological history of plan/chunk/implement/review events.
`);
}

/** Prepend a log entry under today's `## date` heading (newest first). */
export function prependLog(memDir, entry) {
  const file = join(memDir, 'log.md');
  const header = '# iterator update log';
  const day = `## ${today()}`;
  let text = existsSync(file) ? readFileSync(file, 'utf8') : `${header}\n`;
  if (text.includes(`${day}\n`)) {
    text = text.replace(`${day}\n`, `${day}\n* ${entry}\n`);
  } else {
    const lines = text.split('\n');
    const i = lines.findIndex(l => l.startsWith('# '));
    lines.splice(i + 1, 0, '', day, `* ${entry}`);
    text = lines.join('\n');
  }
  writeFileSync(file, text.replace(/\n{3,}/g, '\n\n'));
}

// ---------------------------------------------------------------------------
// op: plan

function writePlan(payload, root) {
  const b = loadBundle(root);
  const title = payload.title || fail('plan op needs a title');
  const s = payload.sections || {};
  if (!s.goal) fail('plan op needs sections.goal');
  mkdirSync(join(b.memDir, 'chunks'), { recursive: true });

  // format.md: the self-describing schema, copied verbatim once.
  const formatDest = join(b.memDir, 'format.md');
  if (!existsSync(formatDest)) {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, '..', 'iterator-plan', 'templates', 'format.md'),
      join(here, '..', '..', 'templates', 'format.md'),
    ];
    const src = candidates.find(existsSync) || fail('cannot find templates/format.md — is the full iterator plugin installed?');
    copyFileSync(src, formatDest);
  }

  const description = (payload.description || s.goal.split('\n')[0]).replace(/\s+/g, ' ').trim();
  const deps = listy(payload.dependencies).map(d => {
    const m = String(d).match(/^(.+?)\s+—\s+(.*)$/);
    return m ? `* \`${m[1].trim().replaceAll('`', '')}\` — ${m[2]}` : `* ${d}`;
  });
  const chunksSection = b.plan?.sections['Chunks']
    || '<!-- regenerated by /iterator-chunk; empty until chunks exist -->';

  const fm = [
    'type: Plan',
    `title: ${fmScalar(title)}`,
    `description: ${fmScalar(description)}`,
    `status: ${payload.status || 'approved'}`,
    `branch: ${fmScalar(payload.branch || b.branch)}`,
    `created: ${b.plan?.fm.created || today()}`,
    `timestamp: ${nowIso()}`,
  ].join('\n');
  const bodyText = `
# Goal

${s.goal}

# Architecture

${s.architecture || ''}

# Dependencies

${deps.join('\n') || '(none)'}

# Key decisions

${s.keyDecisions || ''}

# Product fit

${s.productFit || ''}

# Chunks

${chunksSection}
`.replace(/\n{3,}/g, '\n\n');

  writeFileSync(join(b.memDir, 'plan.md'), joinDoc(fm, bodyText));
  regenerate(root);
  prependLog(b.memDir, payload.log ||
    `**${b.plan ? 'Update' : 'Creation'}**: Plan "${title}" approved on branch ${payload.branch || b.branch}.`);
  return { op: 'plan', written: ['plan.md', 'index.md', 'log.md'], memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: chunks

function chunkDoc(c, titles, existingReview) {
  const fm = [
    'type: Chunk',
    `title: ${fmScalar(c.title || c.name)}`,
    `description: ${fmScalar(c.description || '')}`,
    `status: ${c.status || 'pending'}`,
    `size: ${c.size || 'small'}`,
    `depends_on: [${listy(c.dependsOn).join(', ')}]`,
    `files: [${listy(c.files).map(f => JSON.stringify(String(f))).join(', ')}]`,
    `timestamp: ${nowIso()}`,
    `tags: [${listy(c.tags).join(', ')}]`,
  ].join('\n');

  const parts = ['', '# Implementation notes', '', c.implementationNotes || c.description || '', ''];
  const snips = listy(c.snippets);
  if (snips.length) {
    parts.push('# Snippets', '');
    for (const sn of snips) parts.push('```' + (sn.lang || ''), sn.code || '', '```', '');
  }
  if (listy(c.dependsOn).length) {
    parts.push('# Depends on', '');
    for (const d of c.dependsOn) parts.push(`* [${titles.get(d) || d}](/chunks/${d}.md)`);
    parts.push('');
  }
  if (c.blastRadius) parts.push('# Blast radius', '', c.blastRadius, '');
  if (existingReview) parts.push('# Review', '', existingReview, '');
  return joinDoc(fm, parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n'));
}

function writeChunks(payload, root) {
  const b = loadBundle(root);
  if (!b.plan) fail('no memory/plan.md — run the plan op first');
  const incoming = listy(payload.chunks);
  if (!incoming.length) fail('chunks op needs a non-empty chunks list');
  const deletes = listy(payload.deletes);
  const existing = new Map(b.chunks.map(c => [c.slug, c]));

  for (const c of incoming) {
    if (!c.name || !/^[a-z0-9][a-z0-9-]*$/.test(c.name)) fail(`invalid chunk slug '${c.name || ''}' (kebab-case required)`);
    if (c.status && !['draft', 'pending'].includes(c.status)) {
      fail(`invalid chunk status '${c.status}' (chunks op writes draft|pending; done is owned by update-chunk)`);
    }
    if (c.size && !['small', 'medium', 'large'].includes(c.size)) {
      fail(`invalid chunk size '${c.size}' (small|medium|large)`);
    }
  }
  for (const d of deletes) {
    if (existing.get(d)?.fm.status === 'done') fail(`refusing to delete done chunk '${d}'`);
  }

  // Final set = existing − deletes ∪ incoming; validate deps + cycles first.
  const doneProtected = incoming.filter(c => existing.get(c.name)?.fm.status === 'done').map(c => c.name);
  const finalSlugs = new Set([
    ...b.chunks.map(c => c.slug).filter(s => !deletes.includes(s)),
    ...incoming.map(c => c.name),
  ]);
  const metas = [...finalSlugs].map(slug => {
    const inc = incoming.find(c => c.name === slug);
    const dependsOn = (inc && !doneProtected.includes(slug))
      ? listy(inc.dependsOn)
      : listy(existing.get(slug)?.fm.depends_on);
    return { slug, dependsOn };
  });
  const { cycle, missing } = topoSort(metas);
  if (missing.length) fail(`depends_on references missing chunks: ${missing.join(', ')}`);
  if (cycle.length) fail(`dependency cycle between: ${cycle.join(', ')}`);

  const chunksDir = join(b.memDir, 'chunks');
  mkdirSync(chunksDir, { recursive: true });
  const titles = new Map(metas.map(m => {
    const inc = incoming.find(c => c.name === m.slug);
    return [m.slug, inc?.title || inc?.name || existing.get(m.slug)?.fm.title || m.slug];
  }));

  const written = [];
  for (const c of incoming) {
    if (doneProtected.includes(c.name)) continue; // never rewrite a done chunk
    const prev = existing.get(c.name);
    writeFileSync(join(chunksDir, `${c.name}.md`),
      chunkDoc(c, titles, prev?.sections['Review']));
    written.push(c.name);
  }
  for (const d of deletes) {
    if (existing.has(d)) rmSync(join(chunksDir, `${d}.md`));
  }

  regenerate(root);
  prependLog(b.memDir, payload.log ||
    `**${b.chunks.length ? 'Update' : 'Creation'}**: ${written.length} chunk(s) written${deletes.length ? `, ${deletes.length} removed` : ''}.`);
  return { op: 'chunks', written, skipped: doneProtected, deleted: deletes, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: design

const DESIGN_SECTIONS = [
  ['direction', 'Direction', true],
  ['typography', 'Typography', true],
  ['color', 'Color', true],
  ['spacing', 'Spacing', true],
  ['responsive', 'Responsive', false],
  ['signature', 'Signature', false],
];

function writeDesign(payload, root) {
  const b = loadBundle(root);
  if (!b.plan) fail('no memory/plan.md — run the plan op first');
  const s = payload.sections || {};
  for (const [key, , required] of DESIGN_SECTIONS) {
    if (required && !s[key]) fail(`design op needs sections.${key}`);
  }
  const register = payload.register || 'product';
  if (!['brand', 'product'].includes(register)) fail(`invalid register '${register}' (brand|product)`);

  const fm = [
    'type: Design',
    `title: ${fmScalar(payload.title || 'Design parameters')}`,
    `description: ${fmScalar((payload.description || s.direction.split('\n')[0]).replace(/\s+/g, ' ').trim())}`,
    `register: ${register}`,
    `created: ${b.design?.fm.created || today()}`,
    `timestamp: ${nowIso()}`,
  ].join('\n');
  const bodyText = `\n${DESIGN_SECTIONS
    .filter(([key]) => s[key])
    .map(([key, heading]) => `# ${heading}\n\n${s[key]}\n`)
    .join('\n')}`.replace(/\n{3,}/g, '\n\n');

  writeFileSync(join(b.memDir, 'design.md'), joinDoc(fm, bodyText));
  regenerate(root);
  prependLog(b.memDir, payload.log ||
    `**Design**: ${b.design ? 'Updated' : 'Captured'} project design parameters.`);
  return { op: 'design', written: ['design.md', 'index.md', 'log.md'], memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: update-chunk

function updateChunk(payload, root) {
  const b = loadBundle(root);
  const c = b.chunks.find(x => x.slug === payload.chunk) ||
    fail(`no chunk '${payload.chunk || ''}'`);
  let { fm, body: bodyText } = splitDoc(c.raw);
  if (fm === null) fail(`chunk '${c.slug}' has no frontmatter`);

  const allowed = ['status', 'done', 'reviewed', 'tests', 'tests_status', 'size', 'description', 'title'];
  const set = payload.set || {};
  const bad = Object.keys(set).filter(k => !allowed.includes(k));
  if (bad.length) fail(`update-chunk cannot set: ${bad.join(', ')} (allowed: ${allowed.join(', ')})`);
  if (set.status && !['draft', 'pending', 'done'].includes(set.status)) fail(`invalid status '${set.status}'`);
  if (set.status === 'done' && !set.done) set.done = today();

  fm = setFmKeys(fm, { ...set, timestamp: nowIso() });
  if (payload.appendCommit) fm = appendCommitFm(fm, payload.appendCommit);
  if (payload.appendReview) {
    bodyText = appendReviewBody(bodyText, payload.appendReview, payload.reviewDate);
    if (!set.reviewed) fm = setFmKeys(fm, { reviewed: payload.reviewDate || today() });
  }

  writeFileSync(join(b.memDir, 'chunks', `${c.slug}.md`), joinDoc(fm, bodyText));
  regenerate(root);
  if (payload.log) prependLog(b.memDir, payload.log);
  return { op: 'update-chunk', chunk: c.slug, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: adjustments (the chunk UI's plan-adjustments output, piped verbatim)

function applyAdjustments(payload, root) {
  const b = loadBundle(root);
  const chunksDir = join(b.memDir, 'chunks');
  const applied = [];
  const reload = () => loadBundle(root);

  for (const mv of listy(payload.moves)) {
    const cur = reload();
    const from = cur.chunks.find(c => c.slug === mv.from) || fail(`move: no chunk '${mv.from}'`);
    const to = cur.chunks.find(c => c.slug === mv.to) || fail(`move: no chunk '${mv.to}'`);
    const fromDoc = splitDoc(from.raw);
    const toDoc = splitDoc(to.raw);
    writeFileSync(join(chunksDir, `${from.slug}.md`), joinDoc(
      setFmKeys(fromDoc.fm, { files: listy(from.fm.files).filter(f => f !== mv.file) }), fromDoc.body));
    writeFileSync(join(chunksDir, `${to.slug}.md`), joinDoc(
      setFmKeys(toDoc.fm, { files: [...listy(to.fm.files), mv.file] }), toDoc.body));
    applied.push(`move ${mv.file}: ${mv.from} → ${mv.to}`);
  }

  for (const rn of listy(payload.renames)) {
    const cur = reload();
    const c = cur.chunks.find(x => x.slug === rn.from) || fail(`rename: no chunk '${rn.from}'`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(rn.to || '')) fail(`rename: invalid slug '${rn.to || ''}'`);
    if (cur.chunks.some(x => x.slug === rn.to)) fail(`rename: '${rn.to}' already exists`);
    if (c.fm.status === 'done') fail(`refusing to rename done chunk '${rn.from}'`);
    renameSync(join(chunksDir, `${rn.from}.md`), join(chunksDir, `${rn.to}.md`));
    // Rewire every reference: depends_on entries and bundle-absolute links.
    for (const other of reload().chunks) {
      const deps = listy(other.fm.depends_on);
      let raw = other.raw.replaceAll(`/chunks/${rn.from}.md`, `/chunks/${rn.to}.md`);
      if (deps.includes(rn.from)) {
        const doc = splitDoc(raw);
        raw = joinDoc(setFmKeys(doc.fm, { depends_on: deps.map(d => d === rn.from ? rn.to : d) }), doc.body);
      }
      if (raw !== other.raw) writeFileSync(join(chunksDir, `${other.slug}.md`), raw);
    }
    applied.push(`rename ${rn.from} → ${rn.to}`);
  }

  for (const du of listy(payload.descUpdates)) {
    const cur = reload();
    const c = cur.chunks.find(x => x.slug === du.chunk) || fail(`descUpdate: no chunk '${du.chunk}'`);
    const doc = splitDoc(c.raw);
    writeFileSync(join(chunksDir, `${c.slug}.md`),
      joinDoc(setFmKeys(doc.fm, { description: du.description, timestamp: nowIso() }), doc.body));
    applied.push(`describe ${du.chunk}`);
  }

  // accept: the user approved the chunk set — promote every draft to pending
  // (the mechanical half of the chunk UI's Accept; comments stay semantic).
  // The chunk UI's { type:"plan-approved" } line pipes in verbatim as accept.
  if (payload.accept || payload.type === 'plan-approved') {
    for (const c of reload().chunks) {
      if (c.fm.status !== 'draft') continue;
      const doc = splitDoc(c.raw);
      writeFileSync(join(chunksDir, `${c.slug}.md`),
        joinDoc(setFmKeys(doc.fm, { status: 'pending', timestamp: nowIso() }), doc.body));
      applied.push(`accept ${c.slug}`);
    }
  }

  if (applied.length) {
    regenerate(root);
    prependLog(b.memDir, payload.log || `**Update**: Applied ${applied.length} chunk adjustment(s).`);
  }
  return { op: 'adjustments', applied, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// dispatch + CLI

export function applyOp(payload, root) {
  const op = payload.op
    || (['plan-adjustments', 'plan-approved'].includes(payload.type) ? 'adjustments' : null);
  const ops = { plan: writePlan, chunks: writeChunks, design: writeDesign, 'update-chunk': updateChunk, adjustments: applyAdjustments };
  if (!ops[op]) fail(`unknown op '${payload.op || payload.type || ''}' (plan|chunks|design|update-chunk|adjustments)`);
  return ops[op](payload, root);
}

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (raw += chunk));
    process.stdin.on('end', () => resolve(raw));
    if (process.stdin.isTTY) resolve('');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = await readStdin();
  let result;
  try {
    result = { ok: true, ...applyOp(JSON.parse(raw || '{}'), process.argv[2]) };
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}
