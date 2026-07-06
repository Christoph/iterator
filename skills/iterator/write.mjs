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
 *   memorize      create/update/delete okf knowledge concepts
 *                 (architecture/decisions/patterns/pitfalls/setup areas),
 *                 regenerate their area indexes, and/or advance
 *                 `last_memorized_commit` in the root index
 *   apply-review  the okf skills' verdict-based writer: the memory review
 *                 UI's decisions plus the original draft cards pipe in
 *                 verbatim (accept/keep/reject/delete per concept), the
 *                 pointer advances to headCommit, the bundle is validated
 *   accept-commit process the review UI's accept-commit result end to end:
 *                 branch safety, per-chunk staging + chunk(<slug>) commits,
 *                 done flips, sha recording, okf memory verdicts, pointer
 *                 advance, bookkeeping commit (the UI result pipes verbatim)
 *   record-review record a standalone review's outcome from the UI's
 *                 review-feedback payload verbatim (statuses + notes; line
 *                 comments stay with the model)
 *
 * Every op updates timestamps (override with $ITERATOR_NOW for tests),
 * regenerates memory/chunks/index.md + the plan `# Chunks` section +
 * memory/index.md, and prepends a memory/log.md entry. On success prints
 * {"ok":true,...}; on any validation error prints {"ok":false,"error":...}
 * and exits 1 without writing.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gatherReview, loadBundle } from './gather.mjs';
import {
  fmScalar, frontmatter, joinDoc, listy, mergeRootIndex, nowIso, OKF_AREAS,
  prependLog as prependLogShared, regenerateAreaIndex, setFmKeys, splitDoc,
  today, updateRootIndex, validateBundle,
} from './lib/bundle.mjs';

// Re-export the shared helpers this module used to own (tests and the okf
// skills import them from here).
export { mergeRootIndex, OKF_AREAS, setFmKeys };

const fail = (msg) => { throw new Error(msg); };

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

/** Iterator's own root-index link lines (only for files that exist). */
function iteratorIndexLinks(b) {
  const links = [];
  if (b.plan) links.push(['plan.md', `* [Plan](plan.md) - ${b.plan.fm.description || 'The plan concept.'}`]);
  if (existsSync(join(b.memDir, 'format.md'))) {
    links.push(['format.md', '* [Format](format.md) - Metadata schema for this bundle.']);
  }
  if (b.design) {
    links.push(['design.md', `* [Design](design.md) - ${b.design.fm.description || 'Project design parameters.'}`]);
  }
  if (existsSync(join(b.memDir, 'chunks'))) {
    links.push(['chunks/', '* [Chunks](chunks/) - One document per implementation chunk.']);
  }
  links.push(['log.md', '* [Log](log.md) - Chronological history of plan/chunk/implement/review events.']);
  return links;
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

  const indexFile = join(b.memDir, 'index.md');
  const existing = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;
  writeFileSync(indexFile, mergeRootIndex(existing, iteratorIndexLinks(b)));
}

/** Prepend log entries, creating the file with iterator's header. */
export function prependLog(memDir, entries) {
  prependLogShared(memDir, entries, { header: '# iterator update log' });
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
// op: accept-commit / record-review (deterministic result processing — the
// UI's output pipes in and every mechanical consequence happens in code)

/** git for write ops: throws a readable error instead of returning ''. */
function gitW(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    fail(`git ${args.join(' ')} failed: ${String(e.stderr || e.message || '').trim()}`);
  }
}

const hasStaged = (root) => {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: root, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
};

/**
 * Process the review UI's `accept-commit` result end to end: branch safety,
 * per-chunk staging (the same diff→chunk mapping the review showed), one
 * `chunk(<slug>)` commit per chunk with a `Chunk:` trailer, `status: done`
 * flips, commit-sha recording, okf-memory verdict application, and an
 * optional `last_memorized_commit` advance — then one bookkeeping commit.
 * Resumable: chunks already done are skipped, so a rerun after a mid-way
 * failure completes the remainder.
 */
function acceptCommit(payload, root) {
  const b = loadBundle(root);
  const entries = listy(payload.chunks || payload.chunk)
    .map(c => (typeof c === 'string' ? { slug: c } : c));
  if (!entries.length) fail('accept-commit needs a non-empty chunks list');

  const bySlug = new Map(b.chunks.map(c => [c.slug, c]));
  const done = new Set(b.chunks.filter(c => c.fm.status === 'done').map(c => c.slug));
  for (const e of entries) {
    const c = bySlug.get(e.slug) || fail(`no chunk '${e.slug || ''}'`);
    if (c.fm.status === 'done') continue; // already landed — resumable rerun
    if ((c.fm.status || 'pending') !== 'pending') fail(`chunk '${e.slug}' is ${c.fm.status}, not pending`);
    const waiting = listy(c.fm.depends_on).filter(d => !done.has(d));
    if (waiting.length) fail(`chunk '${e.slug}' is waiting on: ${waiting.join(', ')}`);
  }

  // Branch safety: never commit to the default branch.
  let branch = gitW(['rev-parse', '--abbrev-ref', 'HEAD'], b.root);
  if (branch === 'main' || branch === 'master') {
    branch = `iterator/${entries[0].slug}`;
    gitW(['checkout', '-b', branch], b.root);
  }

  // Stage exactly what the review showed: the diff mapped chunk-by-chunk.
  const review = gatherReview(root, {});
  const filesFor = new Map(review.chunks.map(rc => [rc.name, rc.files.map(f => f.path)]));
  const memStageable = !isAbsolute(b.memName);

  const committed = [];
  const skipped = [];
  for (const e of entries) {
    if (bySlug.get(e.slug).fm.status === 'done') { skipped.push(e.slug); continue; }
    const set = { status: 'done' };
    if (e.testsStatus && e.testsStatus !== 'none') set.tests_status = e.testsStatus;
    updateChunk({
      chunk: e.slug, set,
      log: `**Implementation**: Committed chunk(${e.slug}) on branch ${branch}.`,
    }, root);
    const paths = filesFor.get(e.slug) || [];
    gitW(['add', '-A', '--', ...paths, ...(memStageable ? [b.memName] : [])], b.root);
    const c = bySlug.get(e.slug);
    const summary = e.summary || c.fm.title || c.fm.description || e.slug;
    gitW(['commit', '-m', `chunk(${e.slug}): ${summary}\n\nChunk: ${e.slug}`], b.root);
    committed.push({ chunk: e.slug, sha: gitW(['rev-parse', 'HEAD'], b.root) });
  }

  // A commit cannot contain its own sha — record them all afterwards.
  for (const { chunk, sha } of committed) {
    updateChunk({ chunk, appendCommit: { sha, kind: 'implement' } }, root);
  }

  // okf-memory: apply the user's card decisions and advance the pointer to
  // the last chunk commit (`advance: true` — the skill asserts the pointer
  // rules). The writes land in the bookkeeping commit, which touches only
  // the bundle and is therefore excluded from the memorize pending range.
  let memorize = null;
  const lastSha = committed.length ? committed[committed.length - 1].sha : null;
  const mem = payload.memory || {};
  const acceptedIds = mem.accepted ? new Set(listy(mem.accepted)) : null;
  const memories = listy(mem.proposals)
    .filter(p => !acceptedIds || acceptedIds.has(`${p.area}/${p.slug}`));
  const advanceTo = payload.advance && lastSha ? lastSha : undefined;
  if (memories.length || advanceTo) {
    memorize = writeMemorize({ memories, advanceTo }, root);
  }

  if (committed.length && memStageable) {
    gitW(['add', '-A', '--', b.memName], b.root);
    if (hasStaged(b.root)) {
      gitW(['commit', '-m', 'chore(iterator): record chunk commits and memory updates'], b.root);
    }
  }

  return {
    op: 'accept-commit', branch, committed, skipped,
    uncommitted: (review.uncategorized || []).map(f => f.path),
    memorize,
  };
}

/**
 * Record a standalone review's outcome — accepts the review UI's
 * `review-feedback` payload verbatim. Line comments stay with the model
 * (they are semantic); everything recordable is written here.
 */
function recordReview(payload, root) {
  const b = loadBundle(root);
  const feats = listy(payload.features).filter(f => f.name && f.name !== 'uncategorized');
  if (!feats.length) fail('record-review needs features (pipe the review-feedback payload in)');
  const LEAD = { approved: 'Approved', changes: 'Needs changes', question: 'Question' };
  const recorded = [];
  for (const f of feats) {
    const c = b.chunks.find(x => x.slug === f.name) || fail(`no chunk '${f.name}'`);
    const lead = LEAD[f.status] || 'Note';
    updateChunk({
      chunk: f.name,
      appendReview: `* **${lead}** — ${f.note || 'no changes requested'}`,
      log: `**Review**: Reviewed [${c.fm.title || f.name}](/chunks/${f.name}.md); ${f.status || 'note'}.`,
    }, root);
    recorded.push(f.name);
  }
  return { op: 'record-review', recorded, lineComments: listy(payload.lineComments).length };
}

// ---------------------------------------------------------------------------
// op: memorize (okf-memory knowledge areas — shared-bundle integration)

/** Build a fresh okf memory concept document. */
function memoryDoc(m) {
  const fm = [
    `type: ${fmScalar(m.type)}`,
    `title: ${fmScalar(m.title)}`,
    `description: ${fmScalar(m.description)}`,
  ];
  if (m.status) fm.push(`status: ${fmScalar(m.status)}`);
  if (m.date) fm.push(`date: ${fmScalar(m.date)}`);
  if (listy(m.tags).length) fm.push(`tags: [${listy(m.tags).map(fmScalar).join(', ')}]`);
  if (listy(m.files).length) fm.push(`files: [${listy(m.files).map(f => JSON.stringify(String(f))).join(', ')}]`);
  fm.push(`timestamp: ${nowIso()}`);
  const bodyText = `\n${String(m.body || '').trim()}\n`;
  return joinDoc(fm.join('\n'), bodyText);
}

/**
 * Apply okf-memory concept writes (create/update/delete) and/or advance
 * `last_memorized_commit` in the root index. Never touches chunks/plan —
 * this op is the shared-bundle bridge to okf-memory's knowledge areas.
 */
function writeMemorize(payload, root) {
  const b = loadBundle(root);
  const mems = listy(payload.memories);
  const advanceTo = payload.advanceTo || null;
  if (!mems.length && !advanceTo) fail('memorize op needs memories and/or advanceTo');
  if (advanceTo && !/^[0-9a-f]{7,40}$/i.test(String(advanceTo))) {
    fail(`memorize: advanceTo '${advanceTo}' is not a commit sha`);
  }

  // Validate everything before writing anything.
  for (const m of mems) {
    const action = m.action || 'create';
    if (!['create', 'update', 'delete'].includes(action)) fail(`memorize: invalid action '${m.action}'`);
    if (['chunks', 'plans'].includes(m.area)) fail(`memorize: area '${m.area}' is owned by the plan/chunk ops`);
    if (!OKF_AREAS[m.area] && !existsSync(join(b.memDir, String(m.area || ''), 'index.md'))) {
      fail(`memorize: unknown area '${m.area || ''}' (${Object.keys(OKF_AREAS).join('|')})`);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(m.slug || '')) fail(`memorize: invalid slug '${m.slug || ''}' (kebab-case required)`);
    const file = join(b.memDir, m.area, `${m.slug}.md`);
    if (action === 'create' && existsSync(file)) fail(`memorize: '${m.area}/${m.slug}' exists — use action update`);
    if (action !== 'create' && !existsSync(file)) fail(`memorize: no concept '${m.area}/${m.slug}' to ${action}`);
    if (action === 'create' && !(m.type && m.title && m.description && m.body)) {
      fail(`memorize: create '${m.area}/${m.slug}' needs type, title, description, body`);
    }
  }

  const applied = [];
  const logLines = [];
  const touched = new Set();
  for (const m of mems) {
    const action = m.action || 'create';
    const dir = join(b.memDir, m.area);
    const file = join(dir, `${m.slug}.md`);
    const ref = `[${m.title || `${m.area}/${m.slug}`}](/${m.area}/${m.slug}.md)`;
    if (action === 'delete') {
      rmSync(file);
      logLines.push(`**Deletion**: Removed memory /${m.area}/${m.slug}.md.`);
    } else if (action === 'update') {
      const { fm, body: bodyText } = splitDoc(readFileSync(file, 'utf8'));
      if (fm === null) fail(`memorize: '${m.area}/${m.slug}' has no frontmatter`);
      const next = setFmKeys(fm, {
        type: m.type, title: m.title, description: m.description,
        status: m.status, date: m.date,
        tags: listy(m.tags).length ? listy(m.tags) : undefined,
        files: listy(m.files).length ? listy(m.files) : undefined,
        timestamp: nowIso(),
      });
      writeFileSync(file, joinDoc(next, m.body ? `\n${String(m.body).trim()}\n` : bodyText));
      logLines.push(`**Update**: Memorized ${ref}.`);
    } else {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, memoryDoc(m));
      logLines.push(`**Creation**: Memorized ${ref}.`);
    }
    applied.push(`${action} ${m.area}/${m.slug}`);
    touched.add(m.area);
  }
  for (const area of touched) {
    if (existsSync(join(b.memDir, area))) regenerateAreaIndex(b.memDir, area);
  }

  // Root index: add missing area links (never replace foreign lines) and
  // advance the memorize pointer; everything else in the file is preserved.
  updateRootIndex(b.memDir, [...touched], { advanceTo });

  if (advanceTo) logLines.push(`**Memorize**: Advanced last_memorized_commit to ${String(advanceTo).slice(0, 7)}.`);
  if (payload.log) prependLog(b.memDir, payload.log);
  else for (const line of logLines.reverse()) prependLog(b.memDir, line);
  return { op: 'memorize', applied, advancedTo: advanceTo, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: refresh-format

/**
 * Copy the current templates/format.md over the bundle's format.md. The
 * writer copies the template only on the first plan write, so the bundle's
 * copy drifts as the schema evolves; the knowledge view's `formatStale` flag
 * surfaces that and this op is the fix.
 */
function refreshFormat(payload, root) {
  const b = loadBundle(root);
  if (!existsSync(b.memDir)) fail('no memory/ bundle to refresh');
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'iterator-plan', 'templates', 'format.md'),
    join(here, '..', '..', 'templates', 'format.md'),
  ];
  const src = candidates.find(existsSync)
    || fail('cannot find templates/format.md — is the full iterator plugin installed?');
  copyFileSync(src, join(b.memDir, 'format.md'));
  prependLog(b.memDir, payload.log
    || '**Update**: Refreshed format.md from the current schema template.');
  return { op: 'refresh-format', written: ['format.md', 'log.md'], memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: apply-review (the okf skills' verdict-based writer — okf-init,
// okf-consolidate, and okf-memorize pipe the review server's output plus the
// original draft cards in verbatim)

function conceptFmValue(key, value) {
  if (Array.isArray(value)) {
    if (!value.length) return null;
    return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
  }
  const s = String(value).replace(/\s+/g, ' ').trim();
  // ISO timestamps/dates stay bare (house style); other ':'-bearing scalars quote.
  const bare = /^[0-9][0-9T:.Z+-]*$/.test(s) || !/[:#[\]{}"'`|>&*!%@\n]/.test(s);
  return `${key}: ${bare ? s : JSON.stringify(s)}`;
}

/** Build a concept document from a draft card, carrying over unknown keys. */
function conceptDoc(card, existingRaw) {
  const prev = existingRaw ? frontmatter(existingRaw) : {};
  const ORDER = ['type', 'title', 'description', 'status', 'date', 'tags', 'files'];
  const merged = { ...prev };
  for (const k of ORDER) if (card[k] != null && card[k] !== '') merged[k] = card[k];
  merged.timestamp = nowIso();
  const keys = [
    ...ORDER.filter(k => merged[k] != null && merged[k] !== ''),
    'timestamp',
    ...Object.keys(merged).filter(k => !ORDER.includes(k) && k !== 'timestamp' && merged[k] != null),
  ];
  const fm = keys.map(k => conceptFmValue(k, merged[k])).filter(Boolean).join('\n');
  const bodyText = card.body != null && card.body !== ''
    ? String(card.body).trim()
    : (existingRaw ? splitDoc(existingRaw).body.trim() : '');
  return `---\n${fm}\n---\n\n${bodyText}\n`;
}

/**
 * Apply a memory review's verdicts: accept → write/delete the concept,
 * keep/reject → leave disk unchanged, delete → remove the existing concept.
 * Afterwards regenerate touched area indexes, update the root index (adding
 * missing area links, advancing `last_memorized_commit` when headCommit is
 * given), log, and validate the bundle.
 */
function applyReview(payload, root) {
  const b = loadBundle(root);
  const mem = payload.bundlePath
    ? join(b.root, String(payload.bundlePath).replace(/\/+$/, ''))
    : b.memDir;
  const mode = payload.mode || 'memorize';
  const headCommit = payload.headCommit || null;
  if (!['init', 'consolidate', 'memorize'].includes(mode)) {
    fail(`apply-review: invalid mode '${mode}' (init|consolidate|memorize)`);
  }
  if (mode === 'consolidate' && headCommit) {
    fail('apply-review: consolidate reviews must not include headCommit (the memorize pointer is not advanced by consolidation)');
  }
  if (headCommit && !/^[0-9a-f]{7,40}$/i.test(String(headCommit))) {
    fail(`apply-review: headCommit '${headCommit}' is not a commit sha`);
  }
  const cards = new Map(listy(payload.memories).map(m => [m.id, m]));
  const decisions = listy(payload.decisions);
  if (!decisions.length) fail('apply-review needs decisions (the review-approved output)');

  // Validate before writing anything.
  for (const d of decisions) {
    if (!['accept', 'reject', 'keep', 'delete'].includes(d.verdict)) {
      fail(`invalid verdict '${d.verdict}' for '${d.id}'`);
    }
    if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i.test(String(d.id || ''))) {
      fail(`invalid concept id '${d.id || ''}' (expected <area>/<slug>)`);
    }
    const area = String(d.id).split('/')[0];
    if (['chunks', 'plans'].includes(area)) {
      fail(`apply-review: area '${area}' is owned by the plan/chunk ops`);
    }
    if (!OKF_AREAS[area]) {
      fail(`apply-review: unknown area '${area}' (${Object.keys(OKF_AREAS).join('|')})`);
    }
    const card = cards.get(d.id);
    if (card?.area && card.area !== area) {
      fail(`card '${d.id}' area '${card.area}' does not match id area '${area}'`);
    }
    if (d.verdict === 'accept') {
      if (!card) fail(`decision '${d.id}' has no matching draft card`);
      if (card.action !== 'delete' && !(card.type && card.title && card.description)) {
        fail(`card '${d.id}' needs type, title, description to be written`);
      }
    }
  }

  const written = [];
  const deleted = [];
  let kept = 0;
  let rejected = 0;
  const touched = new Set();
  const log = [];
  for (const d of decisions) {
    const card = cards.get(d.id) || { id: d.id };
    const file = join(mem, `${d.id}.md`);
    const area = d.id.split('/')[0];
    const ref = `[${card.title || d.id}](/${d.id}.md)`;
    if (d.verdict === 'delete' || (d.verdict === 'accept' && card.action === 'delete')) {
      if (existsSync(file)) {
        rmSync(file);
        deleted.push(d.id);
        touched.add(area);
        log.push(`**Deletion**: Removed memory /${d.id}.md.`);
      }
    } else if (d.verdict === 'accept') {
      const existing = existsSync(file) ? readFileSync(file, 'utf8') : null;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, conceptDoc(card, existing));
      written.push(d.id);
      touched.add(area);
      log.push(`**${existing ? 'Update' : 'Creation'}**: Memorized ${ref}.`);
    } else if (d.verdict === 'keep') kept += 1;
    else rejected += 1;
  }

  for (const area of touched) regenerateAreaIndex(mem, area);
  updateRootIndex(mem, [...touched], { advanceTo: headCommit });
  if (headCommit) {
    log.push(`**${mode === 'init' ? 'Initialization' : 'Memorize'}**: Set last_memorized_commit to ${String(headCommit).slice(0, 12)}.`);
  }
  prependLogShared(mem, log.reverse());

  return {
    op: 'apply-review',
    mode,
    written,
    deleted,
    kept,
    rejected,
    advancedTo: headCommit,
    validation: validateBundle(mem),
  };
}

// ---------------------------------------------------------------------------
// op: retire-plan

/**
 * A finished plan is knowledge: condense it into a decisions/ concept (the
 * semantic text comes from the model) and archive the plan + chunk files to
 * memory/chunks/archive/<created>-<slug>/ — loadBundle reads chunks/
 * non-recursively, so archived work is invisible to every gather step while
 * staying browsable in git. The bundle is left plan-less, ready for the next
 * /iterator-plan.
 */
function retirePlan(payload, root) {
  const b = loadBundle(root);
  if (!b.plan) fail('retire-plan: no memory/plan.md to retire');
  const c = payload.concept || {};
  if (!/^[a-z0-9][a-z0-9-]*$/.test(c.slug || '')) {
    fail(`retire-plan: invalid concept slug '${c.slug || ''}' (kebab-case required)`);
  }
  if (!(c.title && c.description && c.body)) {
    fail('retire-plan: concept needs title, description, body (what was built, why, key trade-offs)');
  }
  const unfinished = b.chunks
    .filter(ch => (ch.fm.status || 'pending') !== 'done').map(ch => ch.slug);
  if (unfinished.length && !payload.force) {
    fail(`retire-plan: chunks not done: ${unfinished.join(', ')} (pass force:true to retire anyway)`);
  }

  // 1. The condensed decision concept, through the memorize machinery
  //    (area index + root area link + log all handled there).
  const files = listy(c.files).length
    ? listy(c.files)
    : [...new Set(b.chunks.flatMap(ch => listy(ch.fm.files)))];
  const archiveName = `${b.plan.fm.created || today()}-${c.slug}`;
  writeMemorize({
    memories: [{
      action: 'create', area: 'decisions', slug: c.slug,
      type: 'Decision', title: c.title, description: c.description,
      status: 'accepted', date: today(),
      tags: listy(c.tags), files,
      body: `${String(c.body).trim()}\n\n# Retired plan\n\nCondensed from plan "${b.plan.fm.title || ''}" (${b.chunks.length} chunks, archived under /chunks/archive/${archiveName}/).`,
    }],
    log: `**Retirement**: Plan "${b.plan.fm.title || ''}" condensed into [${c.title}](/decisions/${c.slug}.md).`,
  }, root);

  // 2. Archive plan.md + chunks (incl. their index) out of the readers' view.
  const chunksDir = join(b.memDir, 'chunks');
  const archiveDir = join(chunksDir, 'archive', archiveName);
  mkdirSync(archiveDir, { recursive: true });
  renameSync(join(b.memDir, 'plan.md'), join(archiveDir, 'plan.md'));
  const archived = ['plan.md'];
  if (existsSync(chunksDir)) {
    for (const f of readdirSync(chunksDir)) {
      if (!f.endsWith('.md')) continue;
      renameSync(join(chunksDir, f), join(archiveDir, f));
      archived.push(f);
    }
  }

  // 3. Root index: drop the plan/chunks bullets (regenerate() only merges,
  //    never removes); the knowledge side of the file stays untouched.
  const indexFile = join(b.memDir, 'index.md');
  if (existsSync(indexFile)) {
    const doc = splitDoc(readFileSync(indexFile, 'utf8'));
    const kept = doc.body.split('\n')
      .filter(l => !(/^\s*[*-]\s+\[/.test(l) && /\]\(\/?(plan\.md|chunks\/)\)/.test(l)));
    writeFileSync(indexFile, doc.fm === null
      ? kept.join('\n')
      : joinDoc(doc.fm, kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n')));
  }

  return {
    op: 'retire-plan',
    concept: `decisions/${c.slug}`,
    archived: `chunks/archive/${archiveName}`,
    archivedFiles: archived,
    validation: validateBundle(b.memDir),
  };
}

// ---------------------------------------------------------------------------
// dispatch + CLI

export function applyOp(payload, root) {
  const op = payload.op
    || (['plan-adjustments', 'plan-approved'].includes(payload.type) ? 'adjustments'
      : payload.type === 'accept-commit' ? 'accept-commit'
        : payload.type === 'review-feedback' ? 'record-review' : null);
  const ops = {
    plan: writePlan, chunks: writeChunks, design: writeDesign,
    'update-chunk': updateChunk, adjustments: applyAdjustments,
    memorize: writeMemorize, 'apply-review': applyReview,
    'refresh-format': refreshFormat, 'retire-plan': retirePlan,
    'accept-commit': acceptCommit, 'record-review': recordReview,
  };
  if (!ops[op]) fail(`unknown op '${payload.op || payload.type || ''}' (plan|chunks|design|update-chunk|adjustments|memorize|apply-review|refresh-format|retire-plan|accept-commit|record-review)`);
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
