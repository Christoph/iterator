import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  gatherPlan, gatherChunk, gatherImplement, gatherTest, gatherReview,
  parseDiff, sections, snippets,
} from '../skills/iterator/gather.mjs';

const git = (dir, ...args) => execFileSync('git', args, {
  cwd: dir, encoding: 'utf8',
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  },
}).trim();

/** Repo with a full bundle: done chunk committed with a `Chunk:` trailer,
 * pending chunk owning src/auth/**, and a vitest test setup. */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'iterator-steps-'));
  git(root, 'init', '-q');
  mkdirSync(join(root, 'memory', 'chunks'), { recursive: true });
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

# Chunks

* [Config module](/chunks/config-module.md) - Centralize env access
`);
  writeFileSync(join(root, 'memory', 'chunks', 'config-module.md'), `---
type: Chunk
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
  writeFileSync(join(root, 'memory', 'chunks', 'auth-middleware.md'), `---
type: Chunk
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
  writeFileSync(join(root, 'memory', 'chunks', 'index.md'), `# Chunks

* [Config module](config-module.md) - done
* [Auth middleware](auth-middleware.md) - pending
`);
  writeFileSync(join(root, 'src', 'config.ts'), 'export const cfg = 1;\n');
  writeFileSync(join(root, 'src', 'auth', 'index.ts'), 'export {};\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'chunk(config-module): config\n\nChunk: config-module');
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
    assert.deepEqual(p.dependencies, ['jsonwebtoken — token signing/verification']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherChunk returns chunk bodies in UI shape', () => {
  const root = makeFixture();
  try {
    const p = gatherChunk(root);
    assert.equal(p.plan, 'Add JWT auth');
    const config = p.chunks.find(c => c.name === 'config-module');
    assert.equal(config.implementationNotes, 'Read env once.');
    assert.deepEqual(config.snippets, [{ lang: 'ts', code: 'export const cfg = 1;' }]);
    assert.equal(config.status, 'done');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherImplement picks the next dependency-ready chunk with its contract', () => {
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

test('gatherTest detects runner and red mode from the chunk status', () => {
  const root = makeFixture();
  try {
    const p = gatherTest(root, 'auth-middleware');
    assert.equal(p.mode, 'red', 'pending chunk → red mode');
    assert.equal(p.runner, 'vitest');
    assert.deepEqual(p.contract.files, ['src/auth/*.ts']);
    assert.equal(gatherTest(root, 'config-module').mode, 'green');
    assert.ok(gatherTest(root, 'nope').error);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherReview maps working-tree hunks to chunks via files globs', () => {
  const root = makeFixture();
  try {
    appendFileSync(join(root, 'src', 'auth', 'index.ts'), 'export const x = 1;\n');
    writeFileSync(join(root, 'stray.txt'), 'stray\n');
    git(root, 'add', 'stray.txt');
    const p = gatherReview(root);
    assert.equal(p.source, 'working-tree');
    assert.deepEqual(p.chunks.map(c => c.name), ['auth-middleware']);
    const auth = p.chunks[0];
    assert.equal(auth.files[0].path, 'src/auth/index.ts');
    assert.equal(auth.stats.added, 1);
    assert.equal(auth.stats.complexity, 'green');
    assert.ok(auth.files[0].hunks[0].lines.some(l => l.type === 'addition'));
    assert.deepEqual(p.uncategorized.map(f => f.path), ['stray.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gatherReview rebuilds a done chunk diff from its trailer commits', () => {
  const root = makeFixture();
  try {
    const p = gatherReview(root, { chunk: 'config-module' });
    assert.equal(p.source, 'commits', 'clean tree + done chunk → commit fallback');
    const config = p.chunks.find(c => c.name === 'config-module');
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
type: Chunk
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
