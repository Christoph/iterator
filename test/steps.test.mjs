import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  gatherPlan, gatherFeature, gatherImplement, gatherTest, gatherReview,
  parseDiff, sections, snippets,
} from '../lib/gather.mjs';

const git = (dir, ...args) => execFileSync('git', args, {
  cwd: dir, encoding: 'utf8',
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  },
}).trim();

/** Repo with a full bundle: done feature committed with a `Feature:` trailer,
 * pending feature owning src/auth/**, and a vitest test setup. */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'iterator-steps-'));
  git(root, 'init', '-q');
  mkdirSync(join(root, 'memory', 'features'), { recursive: true });
  mkdirSync(join(root, 'src', 'auth'), { recursive: true });
  writeFileSync(join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', scripts: { test: 'vitest run' }, devDependencies: { vitest: '^1' } }));
  writeFileSync(join(root, 'memory', 'plan.md'), `---
type: Plan
title: Add JWT auth
description: JWT-based auth for all protected API routes.
status: approved
---

# Goal

Protect the API with JWT.

# Architecture

Middleware layer in src/auth.

# Dependencies

* \`jsonwebtoken\` — token signing/verification

# Key decisions

HS256 for simplicity.

# Product fit

Follows the middleware pattern.

# Features

* [Config module](/features/config-module.md) - Centralize env access
`);
  writeFileSync(join(root, 'memory', 'features', 'config-module.md'), `---
type: Feature
title: Config module
description: Centralize env access
status: done
size: small
lines_estimate: 30
depends_on: []
files: ["src/config.ts"]
tests_status: green
---

# Implementation notes

Read env once.

# Snippets

\`\`\`ts
export const cfg = 1;
\`\`\`
`);
  writeFileSync(join(root, 'memory', 'features', 'auth-middleware.md'), `---
type: Feature
title: Auth middleware
description: JWT middleware
status: pending
size: medium
lines_estimate: 160
depends_on: [config-module]
files: ["src/auth/*.ts"]
---

# Implementation notes

Verify the token from the config secret.

# Blast radius

All protected routes.
`);
  writeFileSync(join(root, 'memory', 'features', 'index.md'), `# Features

* [Config module](config-module.md) - done
* [Auth middleware](auth-middleware.md) - pending
`);
  writeFileSync(join(root, 'src', 'config.ts'), 'export const cfg = 1;\n');
  writeFileSync(join(root, 'src', 'auth', 'index.ts'), 'export {};\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'feature(config-module): config\n\nFeature: config-module');
  return root;
}

test('gatherPlan returns existing sections and parsed dependencies', () => {
  const root = makeFixture();
  try {
    const p = gatherPlan(root);
    assert.equal(p.step, 'plan');
    assert.equal(p.exists, true);
    assert.equal(p.title, 'Add JWT auth');
    assert.equal(p.plan.goal, 'Protect the API with JWT.');
    assert.equal(p.plan.keyDecisions, 'HS256 for simplicity.');
    assert.equal(p.plan.productFit, undefined, 'product fit dropped from the plan payload');
    assert.deepEqual(p.dependencies, ['jsonwebtoken — token signing/verification']);
    // The planner's knowledge payload: always present, one list per area.
    assert.deepEqual(Object.keys(p.knowledge), ['architecture', 'decisions', 'pitfalls']);
    assert.deepEqual(p.knowledge.architecture, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherFeature returns feature bodies in UI shape', () => {
  const root = makeFixture();
  try {
    const p = gatherFeature(root);
    assert.equal(p.plan, 'Add JWT auth');
    const config = p.features.find(c => c.name === 'config-module');
    assert.equal(config.implementationNotes, 'Read env once.');
    assert.deepEqual(config.snippets, [{ lang: 'ts', code: 'export const cfg = 1;' }]);
    assert.equal(config.status, 'done');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherImplement picks the next dependency-ready feature with its contract', () => {
  const root = makeFixture();
  try {
    const p = gatherImplement(root);
    assert.equal(p.next.name, 'auth-middleware');
    assert.equal(p.next.blastRadius, 'All protected routes.');
    assert.deepEqual(p.ready, ['auth-middleware']);
    assert.deepEqual(p.blocked, []);
    assert.equal(p.stuck, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherTest detects runner and red mode from the feature status', () => {
  const root = makeFixture();
  try {
    const p = gatherTest(root, 'auth-middleware');
    assert.equal(p.mode, 'red', 'pending feature → red mode');
    assert.equal(p.runner, 'vitest');
    assert.deepEqual(p.contract.files, ['src/auth/*.ts']);
    assert.equal(gatherTest(root, 'config-module').mode, 'green');
    assert.ok(gatherTest(root, 'nope').error);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherReview attributes every changed file to a feature (no floating uncategorized)', () => {
  const root = makeFixture();
  try {
    appendFileSync(join(root, 'src', 'auth', 'index.ts'), 'export const x = 1;\n');
    writeFileSync(join(root, 'stray.txt'), 'stray\n');
    git(root, 'add', 'stray.txt'); // pre-staged before the round → bootstrap
    writeFileSync(join(root, 'notes.txt'), 'incidental\n'); // untracked → incidental
    const p = gatherReview(root);
    assert.equal(p.source, 'working-tree');
    assert.deepEqual(p.features.map(c => c.name), ['auth-middleware']);
    const auth = p.features[0];
    const declared = auth.files.find(f => f.path === 'src/auth/index.ts');
    assert.equal(declared.group, 'declared');
    assert.ok(declared.hunks[0].lines.some(l => l.type === 'addition'));
    assert.equal(auth.stats.complexity, 'green');
    // Pre-staged unmatched content defaults to its own bootstrap commit.
    const stray = auth.files.find(f => f.path === 'stray.txt');
    assert.equal(stray.group, 'bootstrap');
    assert.equal(stray.defaulted, true);
    assert.equal(stray.disposition, 'bootstrap');
    // Fresh unmatched changes default into the active feature's commit.
    const notes = auth.files.find(f => f.path === 'notes.txt');
    assert.equal(notes.group, 'incidental');
    assert.equal(notes.disposition, 'auth-middleware');
    assert.deepEqual(p.uncategorized, [], 'nothing floats uncategorized');
    assert.deepEqual([...p.defaulted].sort(), ['notes.txt', 'stray.txt']);
    assert.equal(p.activeFeature, 'auth-middleware');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherReview rebuilds a done feature diff from its trailer commits', () => {
  const root = makeFixture();
  try {
    const p = gatherReview(root, { feature: 'config-module' });
    assert.equal(p.source, 'commits', 'clean tree + done feature → commit fallback');
    const config = p.features.find(c => c.name === 'config-module');
    assert.ok(config.files.some(f => f.path === 'src/config.ts'));
    assert.ok(!config.files.some(f => f.path.startsWith('memory/')), 'bundle bookkeeping excluded');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseDiff parses unified diffs into files/hunks/lines', () => {
  const files = parseDiff(`diff --git a/src/a.ts b/src/a.ts
index 000..111 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 context
-old line
+new line
+another
`);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/a.ts');
  const h = files[0].hunks[0];
  assert.equal(h.oldStart, 1);
  assert.equal(h.newStart, 1);
  assert.deepEqual(h.lines.map(l => l.type), ['context', 'deletion', 'addition', 'addition']);
});

test('sections is fence-aware; snippets extracts fenced blocks', () => {
  const s = sections(`---
type: Feature
---

# Notes

text

# Snippets

\`\`\`py
# not a heading
x = 1
\`\`\`
`);
  assert.equal(s['Notes'], 'text');
  assert.ok(!('not a heading' in s));
  assert.deepEqual(snippets(s['Snippets']), [{ lang: 'py', code: '# not a heading\nx = 1' }]);
});

test('every skill folder ships a SKILL.md with discoverable frontmatter', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const skillsDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'skills');
  const skills = readdirSync(skillsDir).filter(d => !d.startsWith('.'));
  assert.ok(skills.includes('iterator-knowledge') && skills.includes('iterator-init')
    && skills.includes('iterator-consolidate') && skills.includes('iterator-memorize'),
  'the absorbed knowledge skills are present');
  for (const skill of skills) {
    const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, `${skill}/SKILL.md is missing frontmatter`);
    assert.match(match[1], /^name:\s*\S+/m, `${skill}/SKILL.md missing name`);
    assert.match(match[1], /^description:\s*\S+/m, `${skill}/SKILL.md missing description`);
  }
});

test('parseDiff keeps binary files, decodes quoted paths, tracks renames', () => {
  const files = parseDiff([
    'diff --git a/img/logo.png b/img/logo.png',
    'index 0000000..1111111 100644',
    'Binary files a/img/logo.png and b/img/logo.png differ',
    'diff --git "a/docs/caf\\303\\251.md" "b/docs/caf\\303\\251.md"',
    'index 2222222..3333333 100644',
    '--- "a/docs/caf\\303\\251.md"',
    '+++ "b/docs/caf\\303\\251.md"',
    '@@ -1,1 +1,1 @@',
    '-old',
    '+new',
    'diff --git a/src/old-name.ts b/src/new-name.ts',
    'similarity index 100%',
    'rename from src/old-name.ts',
    'rename to src/new-name.ts',
  ].join('\n'));
  assert.equal(files.length, 3);
  assert.deepEqual(files[0], { path: 'img/logo.png', binary: true, hunks: [] });
  assert.equal(files[1].path, 'docs/café.md');
  assert.equal(files[1].hunks.length, 1);
  assert.equal(files[2].path, 'src/new-name.ts');
  assert.equal(files[2].renamedFrom, 'src/old-name.ts');
  assert.equal(files[2].hunks.length, 0);
});

test('parseDiff keeps hunks of a rename with modifications under the new path', () => {
  const files = parseDiff([
    'diff --git a/src/a.ts b/src/b.ts',
    'similarity index 90%',
    'rename from src/a.ts',
    'rename to src/b.ts',
    'index 1111111..2222222 100644',
    '--- a/src/a.ts',
    '+++ b/src/b.ts',
    '@@ -1,1 +1,1 @@',
    '-x',
    '+y',
  ].join('\n'));
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/b.ts');
  assert.equal(files[0].renamedFrom, 'src/a.ts');
  assert.equal(files[0].hunks.length, 1);
});

test('gatherReview surfaces untracked files as all-addition diffs', () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, 'src', 'brand-new.ts'), 'export const fresh = 1;\n');
    const review = gatherReview(dir, {});
    const all = [
      ...review.features.flatMap((c) => c.files),
      ...review.uncategorized,
    ];
    const fresh = all.find((f) => f.path === 'src/brand-new.ts');
    assert.ok(fresh, 'untracked file appears in the review payload');
    assert.equal(fresh.untracked, true);
    assert.ok(fresh.hunks.length > 0, 'rendered as an all-addition diff');
    assert.ok(
      fresh.hunks.every((h) => h.lines.every((l) => l.type === 'addition')),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gatherTest suggests a convention-derived test path', () => {
  const root = makeFixture();
  try {
    writeFileSync(join(root, 'test-existing.test.ts'), 'x');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'seed test');
    const p = gatherTest(root, 'auth-middleware');
    assert.match(p.suggestedTestPath, /auth-middleware\.test\.ts$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherImplement carries a pre-composed advice string', () => {
  const root = makeFixture();
  try {
    const p = gatherImplement(root);
    assert.match(p.advice, /auth-middleware/);
    assert.match(p.advice, /exactly ONE feature/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
