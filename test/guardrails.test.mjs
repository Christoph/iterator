import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OWNED_KEYS, checkBashCommit, checkEdit, checkWrite, featureInFlight,
  isBundleIndexFile, isFeatureFile, isConceptFile,
} from '../lib/guardrails.mjs';

const FEATURE_DOC = `---
type: Feature
title: Auth middleware
description: JWT middleware
status: pending
size: small
lines_estimate: 60
depends_on: [config-module]
files: ["src/auth.ts"]
timestamp: 2026-07-01T00:00:00Z
tests_status: red
---

# Implementation notes

Verify token from config secret.
`;

const withFm = (patch) => FEATURE_DOC.replace(/status: pending/, patch);

// ---------------------------------------------------------------------------
// isFeatureFile

test('isFeatureFile matches feature docs and nothing else', () => {
  const env = {};
  assert.equal(isFeatureFile('memory/features/auth.md', env), true);
  assert.equal(isFeatureFile('/repo/sub/memory/features/auth.md', env), true);
  assert.equal(isFeatureFile('memory/features/index.md', env), false, 'index is generated, not a feature');
  assert.equal(isFeatureFile('memory/plan.md', env), false);
  assert.equal(isFeatureFile('memory/features/nested/x.md', env), false);
  assert.equal(isFeatureFile('src/features/auth.md', env), false);
  assert.equal(isFeatureFile('', env), false);
});

test('isFeatureFile honors ITERATOR_MEMORY_DIR (relative and absolute)', () => {
  assert.equal(isFeatureFile('.mem/features/a.md', { ITERATOR_MEMORY_DIR: '.mem' }), true);
  assert.equal(isFeatureFile('memory/features/a.md', { ITERATOR_MEMORY_DIR: '.mem' }), false);
  assert.equal(isFeatureFile('/abs/mem/features/a.md', { ITERATOR_MEMORY_DIR: '/abs/mem' }), true);
  assert.equal(isFeatureFile('/abs/mem/features/index.md', { ITERATOR_MEMORY_DIR: '/abs/mem' }), false);
});

// ---------------------------------------------------------------------------
// checkWrite (W1–W5)

test('W1: writes outside feature files are allowed', () => {
  assert.equal(checkWrite({ path: 'src/auth.ts', content: 'status: done' }, 'x'), null);
});

test('W2: a write flipping status to done is blocked', () => {
  const v = checkWrite({ path: 'memory/features/auth.md', content: withFm('status: done') }, FEATURE_DOC);
  assert.equal(v.block, true);
  assert.match(v.reason, /status: done/);
  assert.match(v.reason, /update-feature/);
});

test('W3: a write changing other owned frontmatter keys is blocked and names them', () => {
  const v = checkWrite(
    { path: 'memory/features/auth.md', content: FEATURE_DOC.replace('tests_status: red', 'tests_status: green') },
    FEATURE_DOC,
  );
  assert.equal(v.block, true);
  assert.match(v.reason, /tests_status/);
});

test('W4: a body-only rewrite is allowed (hand-editability)', () => {
  const v = checkWrite(
    { path: 'memory/features/auth.md', content: FEATURE_DOC.replace('Verify token', 'Check token') },
    FEATURE_DOC,
  );
  assert.equal(v, null);
});

test('W2b: a write flipping status to implemented is blocked', () => {
  const v = checkWrite({ path: 'memory/features/auth.md', content: withFm('status: implemented') }, FEATURE_DOC);
  assert.equal(v.block, true);
  assert.match(v.reason, /status: implemented/);
  assert.match(v.reason, /update-feature/);
});

test('W5: creating a feature file by hand warns', () => {
  const v = checkWrite({ path: 'memory/features/new-feature.md', content: FEATURE_DOC }, null);
  assert.equal(v.warn, true);
  assert.equal(v.block, undefined);
  assert.match(v.reason, /features op/);
});

// ---------------------------------------------------------------------------
// checkEdit (E1–E4)

test('E1: edits outside feature files are allowed', () => {
  assert.equal(checkEdit({ path: 'src/a.ts', edits: [{ oldText: 'status: pending', newText: 'status: done' }] }, 'status: pending'), null);
});

test('E2: an edit setting status: done is blocked', () => {
  const v = checkEdit(
    { path: 'memory/features/auth.md', edits: [{ oldText: 'status: pending', newText: 'status: done' }] },
    FEATURE_DOC,
  );
  assert.equal(v.block, true);
  assert.match(v.reason, /update-feature/);
});

test('E2b: an edit setting status: implemented is blocked', () => {
  const v = checkEdit(
    { path: 'memory/features/auth.md', edits: [{ oldText: 'status: pending', newText: 'status: implemented' }] },
    FEATURE_DOC,
  );
  assert.equal(v.block, true);
  assert.match(v.reason, /implemented/);
});

test('E3: an edit touching owned frontmatter (not done) warns', () => {
  const v = checkEdit(
    { path: 'memory/features/auth.md', edits: [{ oldText: 'tests_status: red', newText: 'tests_status: green' }] },
    FEATURE_DOC,
  );
  assert.equal(v.warn, true);
  assert.equal(v.block, undefined);
  assert.match(v.reason, /tests_status/);
});

test('E3: single oldText/newText input shape (no edits array) is understood', () => {
  const v = checkEdit(
    { path: 'memory/features/auth.md', oldText: 'timestamp: 2026-07-01T00:00:00Z', newText: 'timestamp: 2026-07-02T00:00:00Z' },
    FEATURE_DOC,
  );
  assert.equal(v.warn, true);
  assert.match(v.reason, /timestamp/);
});

test('E4: body-only edits are allowed', () => {
  const v = checkEdit(
    { path: 'memory/features/auth.md', edits: [{ oldText: 'Verify token from config secret.', newText: 'Check the token.' }] },
    FEATURE_DOC,
  );
  assert.equal(v, null);
});

// ---------------------------------------------------------------------------
// featureInFlight

const feature = (slug, fm) => ({ slug, fm });

test('featureInFlight: pending + red tests is in flight; drafts and done never are', () => {
  assert.deepEqual(
    featureInFlight([feature('a', { status: 'pending', tests_status: 'red' })]),
    { inFlight: true, slug: 'a' });
  assert.equal(featureInFlight([feature('a', { status: 'draft', tests_status: 'red' })]).inFlight, false);
  assert.equal(featureInFlight([feature('a', { status: 'done', tests_status: 'green' })]).inFlight, false);
  assert.equal(featureInFlight([feature('a', { status: 'pending' })]).inFlight, false);
  assert.equal(featureInFlight([feature('a', { status: 'pending', tests: ['test/a.mjs'] })]).inFlight, true);
  assert.deepEqual(
    featureInFlight([feature('a', { status: 'implemented' })]),
    { inFlight: true, slug: 'a' },
    'implemented = code complete, awaiting review — still in flight');
  assert.equal(featureInFlight([]).inFlight, false);
  assert.equal(featureInFlight(undefined).inFlight, false);
});

// ---------------------------------------------------------------------------
// checkBashCommit (B1–B6)

const IN_FLIGHT = [feature('auth-middleware', { status: 'pending', tests_status: 'red' })];
const IDLE = [feature('auth-middleware', { status: 'done', tests_status: 'green' })];

test('B1: non-commit commands are allowed', () => {
  assert.equal(checkBashCommit({ command: 'git status' }, { features: IN_FLIGHT }), null);
  assert.equal(checkBashCommit({ command: 'ls -la' }, { features: IN_FLIGHT }), null);
  assert.equal(checkBashCommit({ command: 'echo commit' }, { features: IN_FLIGHT }), null);
});

test('B2: --amend without a new message is allowed (trailer reused)', () => {
  assert.equal(checkBashCommit({ command: 'git commit --amend --no-edit' }, { features: IN_FLIGHT }), null);
});

test('B3: a commit carrying the Feature: trailer is allowed (incl. heredoc form)', () => {
  assert.equal(checkBashCommit(
    { command: 'git commit -m "feature(auth-middleware): add middleware" -m "Feature: auth-middleware"' },
    { features: IN_FLIGHT }), null);
  assert.equal(checkBashCommit(
    { command: 'git commit -m "$(cat <<EOF\nfeature(auth): x\n\nFeature: auth-middleware\nEOF\n)"' },
    { features: IN_FLIGHT }), null);
});

test('B4: a feature-style message without the trailer warns', () => {
  const v = checkBashCommit({ command: 'git commit -m "feature(auth-middleware): add middleware"' }, { features: IDLE });
  assert.equal(v.warn, true);
  assert.match(v.reason, /Feature: <slug>/);
});

test('B5: any trailerless commit warns while a feature is in flight, naming it', () => {
  const v = checkBashCommit({ command: 'git commit -m "wip"' }, { features: IN_FLIGHT });
  assert.equal(v.warn, true);
  assert.match(v.reason, /auth-middleware/);
});

test('B6: a trailerless commit with nothing in flight is allowed', () => {
  assert.equal(checkBashCommit({ command: 'git commit -m "wip"' }, { features: IDLE }), null);
});

test('OWNED_KEYS covers exactly the writer-owned frontmatter', () => {
  assert.deepEqual(OWNED_KEYS, ['status', 'tests_status', 'commits', 'timestamp', 'done', 'reviewed']);
});

// ---------------------------------------------------------------------------
// knowledge-side guardrails (concepts + indexes) — warn-only by design

test('isConceptFile and isBundleIndexFile classify bundle paths', () => {
  assert.equal(isConceptFile('memory/pitfalls/grace-timer.md'), true);
  assert.equal(isConceptFile('/abs/repo/memory/patterns/x.md'), true);
  assert.equal(isConceptFile('memory/pitfalls/index.md'), false);
  assert.equal(isConceptFile('memory/features/auth.md'), false, 'features are not concepts');
  assert.equal(isConceptFile('memory/plan.md'), false);
  assert.equal(isConceptFile('src/pitfalls/x.md'), false, 'outside the bundle');

  assert.equal(isBundleIndexFile('memory/index.md'), true);
  assert.equal(isBundleIndexFile('memory/pitfalls/index.md'), true);
  assert.equal(isBundleIndexFile('memory/features/index.md'), true);
  assert.equal(isBundleIndexFile('memory/pitfalls/x.md'), false);
  assert.equal(isBundleIndexFile('index.md'), false, 'outside the bundle');
});

test('concept writes: frontmatter changes warn, body-only changes stay silent', () => {
  const concept = '---\ntype: Pitfall\ntitle: T\ndescription: D\nfiles: ["lib/server.mjs"]\n---\n\nbody\n';
  const created = checkWrite({ path: 'memory/pitfalls/x.md', content: concept }, null);
  assert.equal(created.warn, true, 'hand-creating a concept warns');
  assert.match(created.reason, /memorize/);

  const fmChanged = checkWrite(
    { path: 'memory/pitfalls/x.md', content: concept.replace('title: T', 'title: Renamed') },
    concept);
  assert.equal(fmChanged.warn, true);
  assert.equal(fmChanged.block, undefined, 'knowledge side never blocks');

  const bodyChanged = checkWrite(
    { path: 'memory/pitfalls/x.md', content: concept.replace('body', 'better body') },
    concept);
  assert.equal(bodyChanged, null, 'body prose stays hand-editable');
});

test('concept edits: frontmatter touches warn, body edits stay silent', () => {
  const concept = '---\ntype: Pitfall\ntitle: T\ndescription: D\n---\n\nSome body prose.\n';
  const fmEdit = checkEdit(
    { path: 'memory/pitfalls/x.md', oldText: 'description: D', newText: 'description: E' },
    concept);
  assert.equal(fmEdit.warn, true);
  const bodyEdit = checkEdit(
    { path: 'memory/pitfalls/x.md', oldText: 'Some body prose.', newText: 'Better prose.' },
    concept);
  assert.equal(bodyEdit, null);
});

test('bundle index writes and edits always warn toward the writer', () => {
  const w = checkWrite({ path: 'memory/index.md', content: 'x' }, '---\nokf_version: "0.1"\n---\n');
  assert.equal(w.warn, true);
  assert.match(w.reason, /last_memorized_commit/);
  const e = checkEdit(
    { path: 'memory/pitfalls/index.md', oldText: 'a', newText: 'b' }, '# Pitfalls\n');
  assert.equal(e.warn, true);
});

test('with a resolved root, a project\'s own memory/ subtree is not the bundle', () => {
  const env = {};
  const root = '/repo';
  // Anchored: only <root>/memory/** classifies.
  assert.equal(isFeatureFile('/repo/memory/features/a.md', env, root), true);
  assert.equal(isFeatureFile('/repo/src/memory/features/a.md', env, root), false);
  assert.equal(isConceptFile('/repo/src/memory/pitfalls/x.md', env, root), false);
  assert.equal(isBundleIndexFile('/repo/vendor/memory/index.md', env, root), false);
  // checkWrite must not block edits to the look-alike path.
  const verdict = checkWrite(
    { path: '/repo/src/memory/features/a.md', content: '---\nstatus: done\n---\n' },
    '---\nstatus: pending\n---\n',
    { root },
  );
  assert.equal(verdict, null);
});

test('runtime docs (settings/state/usage) warn on direct writes and edits', () => {
  for (const f of ['settings.md', 'state.md', 'usage.md']) {
    const w = checkWrite({ path: `memory/${f}`, content: '---\ntype: X\n---\n' }, '---\ntype: X\n---\n');
    assert.ok(w?.warn, `${f} write warns`);
    assert.match(w.reason, /settings\/state\/usage ops/);
    const e = checkEdit({ path: `memory/${f}`, oldText: 'a', newText: 'b' }, 'a');
    assert.ok(e?.warn, `${f} edit warns`);
  }
  assert.equal(checkWrite({ path: 'src/settings.md', content: 'x' }, 'x'), null, 'outside the bundle stays free');
});
