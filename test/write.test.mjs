import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyOp, topoSort, setFmKeys } from '../skills/iterator/write.mjs';
import { frontmatter, loadBundle } from '../skills/iterator/gather.mjs';

process.env.ITERATOR_NOW = '2026-07-06T12:00:00Z';

const git = (dir, ...args) => execFileSync('git', args, {
  cwd: dir, encoding: 'utf8',
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  },
}).trim();

const makeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'iterator-write-'));
  git(root, 'init', '-q');
  return root;
};

const read = (root, ...p) => readFileSync(join(root, 'memory', ...p), 'utf8');

const PLAN_OP = {
  op: 'plan',
  title: 'Add JWT auth',
  sections: {
    goal: 'Protect the API with JWT.',
    architecture: 'Middleware in src/auth.',
    keyDecisions: 'HS256.',
    productFit: 'Matches middleware pattern.',
  },
  dependencies: ['jsonwebtoken — token signing/verification'],
};

const CHUNKS_OP = {
  op: 'chunks',
  chunks: [
    {
      name: 'auth-middleware',
      title: 'Auth middleware',
      description: 'JWT middleware',
      implementationNotes: 'Verify token from config secret.',
      files: ['src/auth/*.ts'],
      dependsOn: ['config-module'],
      linesEstimate: 60,
      size: 'small',
      snippets: [{ lang: 'ts', code: 'export function requireAuth(){}' }],
      blastRadius: 'All protected routes.',
    },
    {
      name: 'config-module',
      title: 'Config module',
      description: 'Centralize env access',
      implementationNotes: 'Read env once.',
      files: ['src/config.ts'],
      dependsOn: [],
      linesEstimate: 30,
      size: 'small',
    },
  ],
};

test('plan op writes a conformant bundle and log entry', () => {
  const root = makeRepo();
  try {
    const res = applyOp(PLAN_OP, root);
    assert.equal(res.op, 'plan');

    const fm = frontmatter(read(root, 'plan.md'));
    assert.equal(fm.type, 'Plan');
    assert.equal(fm.status, 'approved');
    assert.equal(fm.title, 'Add JWT auth');
    assert.equal(fm.timestamp, '2026-07-06T12:00:00Z');
    assert.match(read(root, 'plan.md'), /\* `jsonwebtoken` — token signing\/verification/);

    assert.match(read(root, 'index.md'), /okf_version: "0\.1"/);
    assert.ok(existsSync(join(root, 'memory', 'format.md')), 'format.md copied');
    assert.match(read(root, 'log.md'), /## 2026-07-06\n\* \*\*Creation\*\*: Plan "Add JWT auth" approved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('chunks op writes files, topo-orders the index, regenerates plan # Chunks', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    const res = applyOp(CHUNKS_OP, root);
    assert.deepEqual(res.written.sort(), ['auth-middleware', 'config-module']);

    const auth = read(root, 'chunks', 'auth-middleware.md');
    const fm = frontmatter(auth);
    assert.equal(fm.type, 'Chunk');
    assert.deepEqual(fm.depends_on, ['config-module']);
    assert.match(auth, /# Implementation notes\n\nVerify token/);
    assert.match(auth, /```ts\nexport function requireAuth/);
    assert.match(auth, /\* \[Config module\]\(\/chunks\/config-module\.md\)/);

    const index = read(root, 'chunks', 'index.md');
    assert.ok(index.indexOf('config-module.md') < index.indexOf('auth-middleware.md'),
      'dependency-first order');
    assert.match(index, /⬜ pending · small · depends: config-module/);
    assert.match(read(root, 'plan.md'), /# Chunks\n\n\* \[Config module\]\(\/chunks\/config-module\.md\) - Centralize env access/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('chunks op rejects cycles and missing references before writing', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    assert.throws(() => applyOp({
      op: 'chunks',
      chunks: [
        { name: 'a', description: 'a', files: [], dependsOn: ['b'] },
        { name: 'b', description: 'b', files: [], dependsOn: ['a'] },
      ],
    }, root), /cycle/);
    assert.throws(() => applyOp({
      op: 'chunks',
      chunks: [{ name: 'a', description: 'a', files: [], dependsOn: ['ghost'] }],
    }, root), /missing/);
    assert.ok(!existsSync(join(root, 'memory', 'chunks', 'a.md')), 'nothing written on failure');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('update-chunk flips status, appends commits and review notes', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    applyOp(CHUNKS_OP, root);
    applyOp({
      op: 'update-chunk',
      chunk: 'config-module',
      set: { status: 'done', tests: ['test/config.test.ts'], tests_status: 'green' },
      appendCommit: { sha: 'abc1234', kind: 'implement' },
      log: '**Implementation**: Committed chunk(config-module).',
    }, root);

    const raw = read(root, 'chunks', 'config-module.md');
    const fm = frontmatter(raw);
    assert.equal(fm.status, 'done');
    assert.equal(fm.done, '2026-07-06', 'done date derived from ITERATOR_NOW');
    assert.equal(fm.tests_status, 'green');
    assert.match(raw, /commits:\n  - sha: abc1234\n    kind: implement\n    date: 2026-07-06/);
    assert.match(read(root, 'chunks', 'index.md'), /✅ done · 🟢 tests green/);
    assert.match(read(root, 'log.md'), /Committed chunk\(config-module\)/);

    applyOp({
      op: 'update-chunk',
      chunk: 'config-module',
      appendReview: '* **Approved** — no changes requested.',
    }, root);
    const reviewed = read(root, 'chunks', 'config-module.md');
    assert.match(reviewed, /# Review\n\n## 2026-07-06\n\* \*\*Approved\*\*/);
    assert.equal(frontmatter(reviewed).reviewed, '2026-07-06');

    assert.throws(() => applyOp({ op: 'update-chunk', chunk: 'config-module', set: { files: [] } }, root),
      /cannot set/);
    assert.throws(() => applyOp({ op: 'update-chunk', chunk: 'nope', set: { status: 'done' } }, root),
      /no chunk/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('chunks op never rewrites or deletes a done chunk', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    applyOp(CHUNKS_OP, root);
    applyOp({ op: 'update-chunk', chunk: 'config-module', set: { status: 'done' } }, root);

    const before = read(root, 'chunks', 'config-module.md');
    const res = applyOp({
      op: 'chunks',
      chunks: [
        { ...CHUNKS_OP.chunks[1], description: 'REWRITTEN' },
        CHUNKS_OP.chunks[0],
      ],
    }, root);
    assert.deepEqual(res.skipped, ['config-module']);
    assert.equal(read(root, 'chunks', 'config-module.md'), before, 'done chunk untouched');

    assert.throws(() => applyOp({
      op: 'chunks',
      chunks: [CHUNKS_OP.chunks[0]],
      deletes: ['config-module'],
    }, root), /done chunk/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adjustments op applies moves, renames (with rewiring), and descUpdates', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    applyOp(CHUNKS_OP, root);
    const res = applyOp({
      type: 'plan-adjustments', // server output pipes in verbatim
      moves: [{ file: 'src/config.ts', from: 'config-module', to: 'auth-middleware' }],
      renames: [{ from: 'config-module', to: 'app-config' }],
      descUpdates: [{ chunk: 'auth-middleware', description: 'JWT middleware for every protected route' }],
    }, root);
    assert.equal(res.applied.length, 3);

    assert.ok(existsSync(join(root, 'memory', 'chunks', 'app-config.md')));
    assert.ok(!existsSync(join(root, 'memory', 'chunks', 'config-module.md')));
    const auth = frontmatter(read(root, 'chunks', 'auth-middleware.md'));
    assert.deepEqual(auth.depends_on, ['app-config'], 'depends_on rewired');
    assert.deepEqual(auth.files, ['src/auth/*.ts', 'src/config.ts'], 'file moved in');
    assert.equal(auth.description, 'JWT middleware for every protected route');
    assert.deepEqual(frontmatter(read(root, 'chunks', 'app-config.md')).files, [], 'file moved out');
    assert.match(read(root, 'chunks', 'auth-middleware.md'), /\(\/chunks\/app-config\.md\)/, 'body links rewired');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('topoSort orders dependency-first and reports cycles', () => {
  const { order, cycle } = topoSort([
    { slug: 'b', dependsOn: ['a'] },
    { slug: 'a', dependsOn: [] },
    { slug: 'c', dependsOn: ['b'] },
  ]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(cycle, []);
  assert.deepEqual(topoSort([{ slug: 'x', dependsOn: ['x'] }]).cycle, ['x']);
});

test('setFmKeys replaces existing keys and appends new ones', () => {
  const fm = setFmKeys('type: Chunk\nstatus: pending', { status: 'done', done: '2026-07-06' });
  assert.match(fm, /status: done/);
  assert.match(fm, /\ndone: 2026-07-06$/);
  assert.doesNotMatch(fm, /pending/);
});

test('chunks op writes drafts, badges them, and returns sizing warnings', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    const res = applyOp({
      op: 'chunks',
      chunks: [
        { ...CHUNKS_OP.chunks[1], status: 'draft', linesEstimate: 120 },    // healthy size, no warning
        { ...CHUNKS_OP.chunks[0], status: 'draft', linesEstimate: 9 },      // way too small
        { name: 'big-refactor', title: 'Big refactor', description: 'x', status: 'draft', linesEstimate: 450, dependsOn: [] },
        { name: 'no-estimate', title: 'No estimate', description: 'x', status: 'draft', dependsOn: [] },
      ],
    }, root);
    assert.equal(frontmatter(read(root, 'chunks', 'auth-middleware.md')).status, 'draft');
    assert.match(read(root, 'chunks', 'index.md'), /📝 draft/);
    assert.ok(res.warnings.some(w => /auth-middleware: ~9 lines.*too small/.test(w)), res.warnings.join('|'));
    assert.ok(res.warnings.some(w => /big-refactor: ~450 lines.*too big/.test(w)));
    assert.ok(res.warnings.some(w => /no-estimate: no lines_estimate/.test(w)));
    assert.ok(!res.warnings.some(w => /config-module/.test(w)), '120 lines is healthy, no warning');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('chunks op rejects a status other than draft|pending', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    assert.throws(
      () => applyOp({ op: 'chunks', chunks: [{ name: 'x', status: 'done' }] }, root),
      /invalid chunk status 'done'/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepting the chunk set promotes drafts to pending (accept flag and plan-approved verbatim)', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    applyOp({ op: 'chunks', chunks: CHUNKS_OP.chunks.map(c => ({ ...c, status: 'draft' })) }, root);

    // The chunk UI's Accept line pipes in verbatim.
    const res = applyOp({ type: 'plan-approved', branch: 'test' }, root);
    assert.equal(res.op, 'adjustments');
    assert.equal(res.applied.filter(a => a.startsWith('accept ')).length, 2);
    assert.equal(frontmatter(read(root, 'chunks', 'auth-middleware.md')).status, 'pending');
    assert.equal(frontmatter(read(root, 'chunks', 'config-module.md')).status, 'pending');
    assert.doesNotMatch(read(root, 'chunks', 'index.md'), /📝 draft/);

    // accept:true on a normal adjustments payload does the same.
    applyOp({ op: 'chunks', chunks: [{ name: 'late-extra', title: 'Late', description: 'x', status: 'draft', linesEstimate: 50, dependsOn: [] }] }, root);
    applyOp({ op: 'adjustments', accept: true }, root);
    assert.equal(frontmatter(read(root, 'chunks', 'late-extra.md')).status, 'pending');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('update-chunk accepts draft and pending status values', () => {
  const root = makeRepo();
  try {
    applyOp(PLAN_OP, root);
    applyOp(CHUNKS_OP, root);
    applyOp({ op: 'update-chunk', chunk: 'config-module', set: { status: 'draft' } }, root);
    assert.equal(frontmatter(read(root, 'chunks', 'config-module.md')).status, 'draft');
    applyOp({ op: 'update-chunk', chunk: 'config-module', set: { status: 'pending' } }, root);
    assert.equal(frontmatter(read(root, 'chunks', 'config-module.md')).status, 'pending');
    assert.throws(
      () => applyOp({ op: 'update-chunk', chunk: 'config-module', set: { status: 'wip' } }, root),
      /invalid status 'wip'/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
