#!/usr/bin/env node
/**
 * iterator: deterministic state gathering for the hub dashboard.
 *
 * Prints the `step:"hub"` payload JSON to stdout so the SKILL.md can pipe it
 * straight into server.mjs — no LLM-improvised file reading:
 *
 *   node <skill-dir>/gather.mjs [project-root] | node <skill-dir>/server.mjs
 *
 * Resolves the bundle at <git-root>/memory (or $ITERATOR_MEMORY_DIR relative
 * to the git root), reads plan/chunk frontmatter, and computes per chunk:
 *   hasDiff    — any working-tree change matches the chunk's `files` globs
 *   hasCommits — recorded `commits` entries, or a `Chunk: <slug>` trailer hit
 * No bundle → `"plan": null` (the UI renders the Create-plan hero).
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

export function gather(startDir) {
  const cwd = startDir || process.cwd();
  const root = git(['rev-parse', '--show-toplevel'], cwd) || cwd;
  const memName = process.env.ITERATOR_MEMORY_DIR || 'memory';
  const memDir = isAbsolute(memName) ? memName : join(root, memName);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root) || 'HEAD';

  const planFile = join(memDir, 'plan.md');
  if (!existsSync(planFile)) {
    return { step: 'hub', branch, plan: null, progress: { done: 0, total: 0 }, chunks: [] };
  }
  const planFm = frontmatter(readFileSync(planFile, 'utf8'));
  const plan = {
    title: planFm.title || 'Plan',
    status: planFm.status || 'draft',
  };

  // Working-tree changes: diff vs HEAD when HEAD exists (fresh repos don't).
  const hasHead = git(['rev-parse', '--verify', 'HEAD'], root) !== '';
  const diffFiles = (hasHead
    ? git(['diff', 'HEAD', '--name-only'], root)
    : git(['diff', '--name-only'], root)
  ).split('\n').filter(Boolean);

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
    const fm = frontmatter(readFileSync(join(chunksDir, `${slug}.md`), 'utf8'));
    const files = Array.isArray(fm.files) ? fm.files : fm.files ? [fm.files] : [];
    const dependsOn = Array.isArray(fm.depends_on) ? fm.depends_on
      : fm.depends_on ? [fm.depends_on] : [];
    const globs = files.map(globToRegExp);
    const hasDiff = diffFiles.some(f => globs.some(re => re.test(f)));
    const recorded = Array.isArray(fm.commits) && fm.commits.length > 0;
    const hasCommits = recorded ||
      git(['log', '--format=%H', '--grep', `^Chunk: ${slug}$`], root) !== '';
    return {
      name: slug,
      title: fm.title || slug,
      description: fm.description || '',
      status: fm.status || 'pending',
      size: fm.size || 'small',
      linesEstimate: fm.lines_estimate ? Number(fm.lines_estimate) || 0 : 0,
      testsStatus: fm.tests_status || 'none',
      dependsOn,
      hasDiff,
      hasCommits,
    };
  });

  return {
    step: 'hub',
    branch,
    plan,
    progress: {
      done: chunks.filter(c => c.status === 'done').length,
      total: chunks.length,
    },
    chunks,
  };
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(JSON.stringify(gather(process.argv[2])) + '\n');
}
