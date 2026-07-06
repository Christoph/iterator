#!/usr/bin/env node
/**
 * iterator: deterministic state gathering for every step of the flow.
 *
 * Prints a step payload JSON to stdout so the SKILL.mds can pipe it straight
 * into server.mjs — no LLM-improvised file reading or git parsing:
 *
 *   node <skill-dir>/gather.mjs [project-root] [--step <step>] [--chunk <slug>]
 *
 * Steps:
 *   hub        (default) full dashboard payload: plan, chunks, badges,
 *              hasDiff/hasCommits per chunk
 *   plan       plan-review skeleton: branch + existing plan sections/deps
 *              (the agent fills/edits the semantic text, then pipes to server)
 *   chunk      chunk-plan payload: existing chunks with notes/snippets bodies
 *   review     complete review payload: git diff parsed into hunks, mapped to
 *              chunks via their `files` globs, with stats/complexity; for a
 *              done chunk with a clean tree the diff is rebuilt from its
 *              recorded commits (or the `Chunk: <slug>` trailer)
 *   test       test-plan skeleton: chunk contract, red/green mode from
 *              status, detected runner + existing test-file conventions
 *   implement  not a server payload — the next dependency-ready chunk with
 *              its full contract, plus what is blocked on what
 *
 * Resolves the bundle at <git-root>/memory (or $ITERATOR_MEMORY_DIR relative
 * to the git root). No bundle → hub prints `"plan": null` (Create-plan hero).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Coerce a frontmatter value to a list (absent → [], scalar → [scalar]). */
export const listy = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Minimal YAML frontmatter parser for the bundle's schema (see format.md):
 * scalars (optionally quoted), inline lists `[a, b]`, and block lists
 * (`- item`, including `- { sha: …, … }` entries, kept as raw strings).
 */
export function frontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end === -1) return {};
  const unquote = s =>
    (/^".*"$/.test(s) || /^'.*'$/.test(s)) ? s.slice(1, -1) : s;
  const fm = {};
  let key = null;
  for (const line of text.slice(4, end).split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const val = kv[2].trim();
      if (val === '') fm[key] = null; // may be followed by a block list
      else if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = val.slice(1, -1).split(',')
          .map(s => unquote(s.trim())).filter(Boolean);
      } else fm[key] = unquote(val);
    } else if (key) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item) {
        if (!Array.isArray(fm[key])) fm[key] = [];
        fm[key].push(unquote(item[1].trim()));
      }
    }
  }
  return fm;
}

/** The markdown body after the frontmatter block (or the whole text). */
export function body(text) {
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end !== -1) {
      const nl = text.indexOf('\n', end + 4);
      return nl === -1 ? '' : text.slice(nl + 1);
    }
  }
  return text;
}

/**
 * Split a document body into its `# Heading` sections (fence-aware, so a
 * `# comment` line inside a snippet's code block is not a heading).
 */
export function sections(text) {
  const out = {};
  let name = null, buf = [], fence = false;
  for (const line of body(text).split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence && /^# /.test(line)) {
      if (name) out[name] = buf.join('\n').trim();
      name = line.slice(2).trim();
      buf = [];
    } else if (name) buf.push(line);
  }
  if (name) out[name] = buf.join('\n').trim();
  return out;
}

/** Parse fenced code blocks out of a `# Snippets` section. */
export function snippets(text) {
  const out = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text || ''))) {
    out.push({ lang: m[1] || '', code: m[2].replace(/\n$/, '') });
  }
  return out;
}

/** `files` entries are exact paths or simple globs (`*`, `**`). */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if ('.+^$()|{}[]\\?'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

/**
 * Load the whole bundle once: root/branch from git, plan + chunk documents
 * with parsed frontmatter and body sections, chunks in index (topological)
 * order. Shared by every gather step and by write.mjs.
 */
export function loadBundle(startDir) {
  const cwd = startDir || process.cwd();
  const root = git(['rev-parse', '--show-toplevel'], cwd) || cwd;
  const memName = process.env.ITERATOR_MEMORY_DIR || 'memory';
  const memDir = isAbsolute(memName) ? memName : join(root, memName);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root) || 'HEAD';

  let plan = null;
  const planFile = join(memDir, 'plan.md');
  if (existsSync(planFile)) {
    const raw = readFileSync(planFile, 'utf8');
    plan = { raw, fm: frontmatter(raw), sections: sections(raw) };
  }

  const chunksDir = join(memDir, 'chunks');
  let slugs = [];
  if (existsSync(chunksDir)) {
    slugs = readdirSync(chunksDir)
      .filter(f => f.endsWith('.md') && f !== 'index.md')
      .map(f => f.slice(0, -3));
  }
  // Keep the index's (topological) order when it exists; append strays.
  const indexFile = join(chunksDir, 'index.md');
  if (existsSync(indexFile)) {
    const ordered = [...readFileSync(indexFile, 'utf8').matchAll(/\]\(([^)]+)\.md\)/g)]
      .map(m => m[1]).filter(s => slugs.includes(s));
    slugs = [...ordered, ...slugs.filter(s => !ordered.includes(s))];
  }
  const chunks = slugs.map(slug => {
    const raw = readFileSync(join(chunksDir, `${slug}.md`), 'utf8');
    return { slug, raw, fm: frontmatter(raw), sections: sections(raw) };
  });

  return { cwd, root, memName, memDir, branch, plan, chunks };
}

/** A chunk document in the shape the chunk-plan UI expects. */
function chunkToUi(c) {
  return {
    name: c.slug,
    title: c.fm.title || c.slug,
    description: c.fm.description || '',
    implementationNotes: c.sections['Implementation notes'] || '',
    files: listy(c.fm.files),
    dependsOn: listy(c.fm.depends_on),
    linesEstimate: c.fm.lines_estimate ? Number(c.fm.lines_estimate) || 0 : 0,
    size: c.fm.size || 'small',
    status: c.fm.status || 'pending',
    snippets: snippets(c.sections['Snippets']),
  };
}

const progress = (chunks) => ({
  done: chunks.filter(c => (c.fm.status || 'pending') === 'done').length,
  total: chunks.length,
});

// ---------------------------------------------------------------------------
// hub

export function gather(startDir) {
  const b = loadBundle(startDir);
  if (!b.plan) {
    return { step: 'hub', branch: b.branch, plan: null, progress: { done: 0, total: 0 }, chunks: [] };
  }

  // Working-tree changes: diff vs HEAD when HEAD exists (fresh repos don't).
  const hasHead = git(['rev-parse', '--verify', 'HEAD'], b.root) !== '';
  const diffFiles = (hasHead
    ? git(['diff', 'HEAD', '--name-only'], b.root)
    : git(['diff', '--name-only'], b.root)
  ).split('\n').filter(Boolean);

  const chunks = b.chunks.map(c => {
    const files = listy(c.fm.files);
    const globs = files.map(globToRegExp);
    const hasDiff = diffFiles.some(f => globs.some(re => re.test(f)));
    const recorded = Array.isArray(c.fm.commits) && c.fm.commits.length > 0;
    const hasCommits = recorded ||
      git(['log', '--format=%H', '--grep', `^Chunk: ${c.slug}$`], b.root) !== '';
    return {
      name: c.slug,
      title: c.fm.title || c.slug,
      description: c.fm.description || '',
      status: c.fm.status || 'pending',
      size: c.fm.size || 'small',
      linesEstimate: c.fm.lines_estimate ? Number(c.fm.lines_estimate) || 0 : 0,
      testsStatus: c.fm.tests_status || 'none',
      dependsOn: listy(c.fm.depends_on),
      hasDiff,
      hasCommits,
    };
  });

  return {
    step: 'hub',
    branch: b.branch,
    plan: { title: b.plan.fm.title || 'Plan', status: b.plan.fm.status || 'draft' },
    progress: progress(b.chunks),
    chunks,
  };
}

// ---------------------------------------------------------------------------
// plan

export function gatherPlan(startDir) {
  const b = loadBundle(startDir);
  const s = b.plan?.sections || {};
  const dependencies = (s['Dependencies'] || '').split('\n')
    .map(l => l.match(/^[*-]\s+(.*)$/))
    .filter(Boolean)
    .map(m => m[1].replaceAll('`', '').trim());
  return {
    step: 'plan',
    branch: b.branch,
    title: b.plan?.fm.title || '',
    exists: !!b.plan,
    status: b.plan?.fm.status || null,
    legacy: {
      plan: existsSync(join(b.root, 'PLAN.md')),
      chunks: existsSync(join(b.root, 'CHUNKS.md')),
    },
    plan: {
      goal: s['Goal'] || '',
      architecture: s['Architecture'] || '',
      keyDecisions: s['Key decisions'] || '',
      productFit: s['Product fit'] || '',
    },
    dependencies,
  };
}

// ---------------------------------------------------------------------------
// chunk

export function gatherChunk(startDir) {
  const b = loadBundle(startDir);
  return {
    step: 'chunk',
    branch: b.branch,
    plan: b.plan?.fm.title || null,
    planStatus: b.plan?.fm.status || null,
    chunks: b.chunks.map(chunkToUi),
  };
}

// ---------------------------------------------------------------------------
// implement (agent-facing, not a server payload)

export function gatherImplement(startDir) {
  const b = loadBundle(startDir);
  const done = new Set(b.chunks.filter(c => c.fm.status === 'done').map(c => c.slug));
  const pending = b.chunks.filter(c => (c.fm.status || 'pending') !== 'done');
  const ready = pending.filter(c => listy(c.fm.depends_on).every(d => done.has(d)));
  const nextChunk = ready[0] || null;
  return {
    step: 'implement',
    branch: b.branch,
    plan: b.plan?.fm.title || null,
    progress: progress(b.chunks),
    next: nextChunk && {
      ...chunkToUi(nextChunk),
      blastRadius: nextChunk.sections['Blast radius'] || '',
      tests: listy(nextChunk.fm.tests),
      testsStatus: nextChunk.fm.tests_status || 'none',
    },
    ready: ready.map(c => c.slug),
    blocked: pending.filter(c => !ready.includes(c)).map(c => ({
      name: c.slug,
      waitingOn: listy(c.fm.depends_on).filter(d => !done.has(d)),
    })),
    // pending chunks remain but none is ready → cycle or missing dependency
    stuck: pending.length > 0 && ready.length === 0,
  };
}

// ---------------------------------------------------------------------------
// test

function detectRunner(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const script = pkg.scripts?.test || '';
    const deps = { ...pkg.devDependencies, ...pkg.dependencies };
    for (const r of ['vitest', 'jest', 'mocha', 'ava', 'tap']) {
      if (script.includes(r) || deps?.[r]) return r;
    }
    if (script.includes('node --test') || script.includes('node:test')) return 'node:test';
    if (script) return script.split(' ')[0];
  } catch { /* no package.json */ }
  if (existsSync(join(root, 'pytest.ini'))) return 'pytest';
  try {
    if (readFileSync(join(root, 'pyproject.toml'), 'utf8').includes('pytest')) return 'pytest';
  } catch { /* no pyproject */ }
  return null;
}

export function gatherTest(startDir, slug) {
  const b = loadBundle(startDir);
  const c = b.chunks.find(x => x.slug === slug);
  if (!c) {
    return { step: 'test', error: `no chunk '${slug || ''}'`, chunks: b.chunks.map(x => x.slug) };
  }
  const existingTests = git(['ls-files'], b.root).split('\n')
    .filter(f => /(\.test\.|\.spec\.|_test\.|(^|\/)tests?\/)/i.test(f))
    .slice(0, 5);
  return {
    step: 'test',
    branch: b.branch,
    mode: c.fm.status === 'done' ? 'green' : 'red',
    chunk: { name: c.slug, description: c.fm.description || '' },
    contract: {
      implementationNotes: c.sections['Implementation notes'] || '',
      snippets: snippets(c.sections['Snippets']),
      files: listy(c.fm.files),
      dependsOn: listy(c.fm.depends_on),
    },
    runner: detectRunner(b.root),
    existingTests,
    cases: [],
  };
}

// ---------------------------------------------------------------------------
// review

/** Parse unified `git diff` output into the review UI's files/hunks shape. */
export function parseDiff(text) {
  const files = [];
  let cur = null, hunk = null, minus = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) { cur = null; hunk = null; minus = null; continue; }
    if (!hunk && line.startsWith('--- ')) { minus = line.slice(4); continue; }
    if (!hunk && line.startsWith('+++ ')) {
      let p = line.slice(4);
      if (p === '/dev/null') p = minus || '';
      cur = { path: p.replace(/^[ab]\//, ''), hunks: [] };
      files.push(cur);
      continue;
    }
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h && cur) {
      hunk = { header: line, oldStart: +h[1], newStart: +h[2], lines: [] };
      cur.hunks.push(hunk);
      continue;
    }
    if (hunk) {
      if (line.startsWith('+')) hunk.lines.push({ type: 'addition', content: line.slice(1) });
      else if (line.startsWith('-')) hunk.lines.push({ type: 'deletion', content: line.slice(1) });
      else if (line.startsWith(' ')) hunk.lines.push({ type: 'context', content: line.slice(1) });
      // '\ No newline at end of file' markers are dropped
    }
  }
  return files.filter(f => f.hunks.length);
}

/** Validated commit shas for a chunk, oldest first (recorded → trailer). */
function resolveChunkCommits(root, c) {
  const recorded = listy(c.fm.commits)
    .map(e => String(e).match(/sha:\s*([0-9a-f]{6,40})/i)?.[1])
    .filter(Boolean)
    .filter(sha => git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], root) !== '');
  if (recorded.length) return recorded;
  return git(['log', '--reverse', '--format=%H', '--grep', `^Chunk: ${c.slug}$`], root)
    .split('\n').filter(Boolean);
}

export function gatherReview(startDir, opts = {}) {
  const b = loadBundle(startDir);
  const hasHead = git(['rev-parse', '--verify', 'HEAD'], b.root) !== '';
  let diffText = hasHead ? git(['diff', 'HEAD'], b.root) : git(['diff'], b.root);
  let commitLabel = git(['log', '-1', '--format=%h %s'], b.root);
  let source = 'working-tree';

  const selected = opts.chunk ? b.chunks.filter(c => c.slug === opts.chunk) : b.chunks;

  // Done chunk + clean tree: rebuild the diff from the chunk's commits,
  // excluding the bundle's own bookkeeping paths.
  if (!diffText.trim() && opts.chunk && selected[0]?.fm.status === 'done') {
    const shas = resolveChunkCommits(b.root, selected[0]);
    if (shas.length) {
      const pathspec = ['--', '.', `:(exclude)${b.memName}`];
      diffText = shas.length === 1
        ? git(['show', '--format=', shas[0], ...pathspec], b.root)
        : git(['diff', `${shas[0]}^`, shas[shas.length - 1], ...pathspec], b.root);
      commitLabel = shas.length === 1
        ? shas[0].slice(0, 7)
        : `${shas[0].slice(0, 7)}..${shas[shas.length - 1].slice(0, 7)}`;
      source = 'commits';
    }
  }

  // Map each changed file to the first chunk whose `files` globs match.
  const parsed = parseDiff(diffText)
    .filter(f => !f.path.startsWith(`${b.memName}/`));
  const owners = b.chunks.map(c => ({ slug: c.slug, res: listy(c.fm.files).map(globToRegExp) }));
  const byChunk = new Map();
  const uncategorized = [];
  for (const f of parsed) {
    const owner = owners.find(o => o.res.some(re => re.test(f.path)));
    if (!owner) { uncategorized.push(f); continue; }
    if (opts.chunk && owner.slug !== opts.chunk) continue;
    if (!byChunk.has(owner.slug)) byChunk.set(owner.slug, []);
    byChunk.get(owner.slug).push(f);
  }

  const chunks = [];
  for (const c of selected) {
    const files = byChunk.get(c.slug) || [];
    if (!files.length && !opts.chunk) continue;
    let added = 0, removed = 0;
    for (const f of files) for (const h of f.hunks) for (const l of h.lines) {
      if (l.type === 'addition') added++;
      else if (l.type === 'deletion') removed++;
    }
    const total = added + removed;
    chunks.push({
      name: c.slug,
      description: c.fm.description || '',
      blastRadius: c.sections['Blast radius'] || '',
      dependsOn: listy(c.fm.depends_on),
      stats: {
        added, removed, files: files.length,
        complexity: total <= 100 ? 'green' : total <= 200 ? 'yellow' : 'red',
      },
      files,
    });
  }

  return {
    step: 'review',
    branch: b.branch,
    commit: commitLabel,
    plan: b.plan?.fm.title || '',
    progress: progress(b.chunks),
    hasChunksFile: b.chunks.length > 0,
    source,
    chunks,
    uncategorized,
  };
}

// ---------------------------------------------------------------------------
// CLI

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let step = 'hub', chunk = null, rootArg = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--step') step = args[++i];
    else if (args[i] === '--chunk') chunk = args[++i];
    else rootArg = args[i];
  }
  const steps = {
    hub: () => gather(rootArg),
    plan: () => gatherPlan(rootArg),
    chunk: () => gatherChunk(rootArg),
    implement: () => gatherImplement(rootArg),
    test: () => gatherTest(rootArg, chunk),
    review: () => gatherReview(rootArg, { chunk }),
  };
  if (!steps[step]) {
    process.stderr.write(`iterator gather: unknown step '${step}' (hub|plan|chunk|implement|test|review)\n`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(steps[step]()) + '\n');
}
