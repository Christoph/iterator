import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gather, gatherImplement, gatherReview, frontmatter, globToRegExp } from '../skills/iterator/gather.mjs';

const git = (dir, ...args) => execFileSync('git', args, {
  cwd: dir, encoding: 'utf8',
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  },
}).trim();

/** Build a throwaway repo with a memory bundle: one done chunk (committed
 * with a `Chunk:` trailer), one pending chunk with a working-tree diff. */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'iterator-gather-'));
  git(root, 'init', '-q');
  mkdirSync(join(root, 'memory', 'chunks'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'memory', 'plan.md'), `---
type: Plan
title: Add JWT auth
status: approved
---

# Goal
g
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
`);
  writeFileSync(join(root, 'memory', 'chunks', 'index.md'), `# Chunks

* [Config module](config-module.md) - done
* [Auth middleware](auth-middleware.md) - pending
`);
  writeFileSync(join(root, 'src', 'config.ts'), 'export const cfg = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'chunk(config-module): config\n\nChunk: config-module');
  // Working-tree change matching only auth-middleware's glob.
  mkdirSync(join(root, 'src', 'auth'), { recursive: true });
  writeFileSync(join(root, 'src', 'auth', 'index.ts'), 'export {};\n');
  git(root, 'add', 'src/auth/index.ts'); // staged counts via `git diff HEAD`
  return root;
}

test('gather builds the hub payload from bundle + git state', () => {
  const root = makeFixture();
  try {
    const p = gather(root);
    assert.equal(p.step, 'hub');
    assert.deepEqual(p.plan, { title: 'Add JWT auth', status: 'approved' });
    assert.deepEqual(p.progress, { done: 1, total: 2 });
    assert.deepEqual(p.chunks.map(c => c.name), ['config-module', 'auth-middleware']);

    const [config, auth] = p.chunks;
    assert.equal(config.status, 'done');
    assert.equal(config.testsStatus, 'green');
    assert.equal(config.hasCommits, true, 'trailer commit must be found');
    assert.equal(config.hasDiff, false);

    assert.equal(auth.status, 'pending');
    assert.deepEqual(auth.dependsOn, ['config-module']);
    assert.equal(auth.linesEstimate, 160);
    assert.equal(auth.hasDiff, true, 'staged src/auth/index.ts matches src/auth/*.ts');
    assert.equal(auth.hasCommits, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gather without a bundle returns the create-plan shape', () => {
  const root = mkdtempSync(join(tmpdir(), 'iterator-gather-'));
  try {
    git(root, 'init', '-q');
    const p = gather(root);
    assert.equal(p.plan, null);
    assert.deepEqual(p.progress, { done: 0, total: 0 });
    assert.deepEqual(p.chunks, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('frontmatter parses scalars, inline lists, and block lists', () => {
  const fm = frontmatter(`---
title: "Quoted title"
status: pending
depends_on: [a, b]
commits:
  - { sha: abc, kind: implement }
files:
---

body`);
  assert.equal(fm.title, 'Quoted title');
  assert.deepEqual(fm.depends_on, ['a', 'b']);
  assert.equal(fm.commits.length, 1);
  assert.equal(fm.files, null);
});

test('implement excludes drafts from ready/next and lists them separately', () => {
  const root = makeFixture();
  try {
    // A dependency-free draft: would be "next" if drafts were implementable.
    writeFileSync(join(root, 'memory', 'chunks', 'a-draft.md'), `---
type: Chunk
title: A draft
description: Unaccepted proposal
status: draft
size: small
lines_estimate: 50
depends_on: []
files: ["src/draft.ts"]
---
`);
    const p = gatherImplement(root);
    assert.equal(p.next.name, 'auth-middleware', 'draft must not become next');
    assert.deepEqual(p.ready, ['auth-middleware']);
    assert.deepEqual(p.drafts, ['a-draft']);
    assert.equal(p.stuck, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('review payload carries lines_estimate next to the actual stats', () => {
  const root = makeFixture();
  try {
    const p = gatherReview(root, { chunk: 'auth-middleware' });
    assert.equal(p.chunks.length, 1);
    assert.equal(p.chunks[0].linesEstimate, 160);
    assert.ok(p.chunks[0].stats, 'actual stats still present');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('review groups a chunk\'s tests with it and excludes comment/doc lines from code stats', () => {
  const root = makeFixture();
  try {
    // Give the chunk recorded tests (as /iterator-test would) and stage a
    // change mixing code, a comment, and a blank line, plus the test file.
    writeFileSync(join(root, 'memory', 'chunks', 'auth-middleware.md'), `---
type: Chunk
title: Auth middleware
description: JWT middleware
status: pending
size: medium
lines_estimate: 160
depends_on: [config-module]
files: ["src/auth/*.ts"]
tests: ["test/auth.test.mjs"]
---
`);
    writeFileSync(join(root, 'src', 'auth', 'index.ts'),
      '// verify the token against the config secret\nexport const auth = 1;\n\n');
    mkdirSync(join(root, 'test'), { recursive: true });
    writeFileSync(join(root, 'test', 'auth.test.mjs'),
      'import assert from "node:assert";\nassert.ok(true);\n');
    git(root, 'add', '.');

    const p = gatherReview(root, { chunk: 'auth-middleware' });
    const paths = p.chunks[0].files.map(f => f.path);
    assert.ok(paths.includes('test/auth.test.mjs'), 'test file must be grouped with its chunk');
    assert.equal(p.uncategorized.length, 0, 'nothing falls to uncategorized');

    const s = p.chunks[0].stats;
    assert.ok(s.codeAdded < s.added, 'comment/blank lines excluded from the code count');
    assert.equal(s.codeAdded, 3, 'one code line in src + two in the test file');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('globToRegExp handles exact paths, * and **', () => {
  assert.ok(globToRegExp('src/config.ts').test('src/config.ts'));
  assert.ok(!globToRegExp('src/config.ts').test('src/config_ts'));
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/deep/a.ts'));
  assert.ok(globToRegExp('src/**').test('src/deep/a.ts'));
});
