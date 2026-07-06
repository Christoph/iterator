import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  actionToCommand, bundleExists, chunksDirEntries, composeAmbientContext,
  extractPathsFromBash, footerText, mergePayload, runJson, scriptPath,
  shouldNudge,
} from '../lib/pi-tools.mjs';

test('mergePayload: extra wins, gathered object untouched, junk extra ignored', () => {
  const gathered = { step: 'plan', title: 'old', dependencies: [] };
  const merged = mergePayload(gathered, { title: 'new', plan: { goal: 'g' } });
  assert.equal(merged.title, 'new');
  assert.deepEqual(merged.plan, { goal: 'g' });
  assert.equal(gathered.title, 'old', 'input must not be mutated');
  assert.deepEqual(mergePayload(gathered, null), gathered);
  assert.deepEqual(mergePayload(gathered, 'nonsense'), gathered);
});

test('actionToCommand maps hub actions to skill commands', () => {
  assert.equal(actionToCommand({ type: 'action', action: 'plan', chunk: null }), '/skill:iterator-plan');
  assert.equal(actionToCommand({ type: 'action', action: 'chunk', chunk: null }), '/skill:iterator-chunk');
  assert.equal(actionToCommand({ type: 'action', action: 'test', chunk: 'auth' }), '/skill:iterator-test auth');
  assert.equal(actionToCommand({ type: 'action', action: 'implement', chunk: 'auth' }), '/skill:iterator-implement auth');
  assert.equal(actionToCommand({ type: 'action', action: 'review', chunk: 'auth' }), '/skill:iterator-review auth');
});

test('actionToCommand returns null for cancel/timeout/garbage', () => {
  assert.equal(actionToCommand({ type: 'cancel' }), null);
  assert.equal(actionToCommand({ type: 'timeout' }), null);
  assert.equal(actionToCommand({ type: 'action', action: 'rm -rf' }), null);
  assert.equal(actionToCommand(null), null);
  assert.equal(actionToCommand({}), null);
});

test('bundleExists and chunksDirEntries read the fixture bundle', () => {
  const root = mkdtempSync(join(tmpdir(), 'iterator-pitools-'));
  try {
    mkdirSync(join(root, '.git'), { recursive: true }); // git root marker
    assert.equal(bundleExists(root), false);

    mkdirSync(join(root, 'memory', 'chunks'), { recursive: true });
    writeFileSync(join(root, 'memory', 'plan.md'), '---\ntype: Plan\n---\n');
    assert.equal(bundleExists(root), true);
    assert.equal(bundleExists(join(root)), true);

    writeFileSync(join(root, 'memory', 'chunks', 'auth.md'),
      '---\ntype: Chunk\nstatus: pending\ntests_status: red\n---\n');
    writeFileSync(join(root, 'memory', 'chunks', 'index.md'), '# Chunks\n');
    const entries = chunksDirEntries(root);
    assert.deepEqual(entries.map(e => e.slug), ['auth']);
    assert.equal(entries[0].fm.tests_status, 'red');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runJson surfaces gather output and writer validation errors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'iterator-pitools-run-'));
  try {
    mkdirSync(join(root, '.git'), { recursive: true });
    // gather hub on an empty dir → create-plan shape
    const hub = await runJson(scriptPath('gather'), ['--step', 'hub', root], {});
    assert.equal(hub.step, 'hub');
    assert.equal(hub.plan, null);
    // writer refuses an unknown op with its own error message
    await assert.rejects(
      () => runJson(scriptPath('write'), [root], { stdin: '{"op":"nope"}' }),
      /unknown op/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actionToCommand maps knowledge actions to okf skills', () => {
  assert.equal(actionToCommand({ type: 'action', action: 'okf-init' }), '/skill:okf-init');
  assert.equal(actionToCommand({ type: 'action', action: 'okf-consolidate' }), '/skill:okf-consolidate');
  assert.equal(actionToCommand({ type: 'action', action: 'okf-memorize' }), '/skill:okf-memorize');
  assert.equal(actionToCommand({ type: 'action', action: 'design' }), '/skill:iterator-design');
  assert.equal(
    actionToCommand({ type: 'action', action: 'draft-memory', target: 'pitfalls', prompt: '' }),
    '/skill:okf draft-memory pitfalls');
  assert.equal(
    actionToCommand({ type: 'action', action: 'update-memory', target: 'pitfalls/gone-anchor', prompt: 'Re-anchor it.' }),
    '/skill:okf update-memory pitfalls/gone-anchor — Re-anchor it.');
  assert.equal(
    actionToCommand({ type: 'action', action: 'draft-memory-prompt', target: null, prompt: 'Capture the port story.' }),
    '/skill:okf draft-memory-prompt — Capture the port story.');
  assert.equal(actionToCommand({ type: 'action', action: 'refresh-format' }), '/skill:okf refresh-format');
  assert.equal(actionToCommand({ type: 'action', action: 'close' }), null);
});

test('actionToCommand maps retire to the hub retirement flow', () => {
  assert.equal(actionToCommand({ type: 'action', action: 'retire', chunk: null }),
    '/skill:iterator retire-plan');
});

test('extractPathsFromBash finds path-looking tokens and dedupes', () => {
  assert.deepEqual(
    extractPathsFromBash('node ./lib/server.mjs test/a.test.mjs && cat lib/server.mjs'),
    ['lib/server.mjs', 'test/a.test.mjs']);
  assert.deepEqual(extractPathsFromBash('git status'), []);
  assert.deepEqual(extractPathsFromBash(''), []);
});

test('composeAmbientContext builds the state line and anchored-knowledge list', () => {
  const hub = {
    plan: { title: 'Add JWT auth', status: 'approved' },
    progress: { done: 3, total: 7 },
    chunks: [
      { name: 'auth-middleware', testsStatus: 'red' },
      { name: 'config-module', testsStatus: 'green' },
    ],
  };
  const implement = { next: { name: 'auth-middleware' } };
  const concepts = [{
    id: 'pitfalls/token-clock-skew', title: 'JWT clock skew',
    description: 'Fresh tokens fail without leeway.',
    ref: 'memory/pitfalls/token-clock-skew.md',
  }];
  const out = composeAmbientContext(hub, implement, concepts);
  assert.match(out, /Plan "Add JWT auth" — 3\/7 chunks done/);
  assert.match(out, /next ready: auth-middleware/);
  assert.match(out, /tests red: auth-middleware/);
  assert.match(out, /\[pitfalls\/token-clock-skew\] JWT clock skew — Fresh tokens fail without leeway\. \(memory\/pitfalls\/token-clock-skew\.md\)/);

  // Knowledge lines alone still inject; nothing at all → null.
  assert.match(composeAmbientContext({ plan: null }, null, concepts), /token-clock-skew/);
  assert.equal(composeAmbientContext({ plan: null }, null, []), null);
  // No red tests → no red segment.
  const quiet = composeAmbientContext({ ...hub, chunks: [] }, { next: null }, []);
  assert.doesNotMatch(quiet, /tests red/);
  assert.match(quiet, /next ready: none/);
});

test('footerText composes segments and omits what is absent', () => {
  const hub = {
    plan: { title: 'X' }, progress: { done: 3, total: 7 },
    chunks: [{ name: 'a', testsStatus: 'red' }, { name: 'b', testsStatus: 'green' }],
  };
  assert.equal(footerText(hub, { next: { name: 'auth-middleware' } }, 4),
    '⛭ 3/7 · next: auth-middleware · 🔴 1 red · 🧠 4 unmemorized');
  assert.equal(footerText(hub, { next: null }, 0), '⛭ 3/7 · 🔴 1 red');
  assert.equal(footerText({ plan: null }, null, 4), '🧠 4 unmemorized');
  assert.equal(footerText({ plan: null }, null, 0), null);
});

test('shouldNudge fires once per threshold-multiple and can be disabled', () => {
  assert.equal(shouldNudge(4, 0, 5), false, 'below threshold');
  assert.equal(shouldNudge(5, 0, 5), true, 'reaches threshold');
  assert.equal(shouldNudge(7, 5, 5), false, 'already nudged at 5 — wait for 10');
  assert.equal(shouldNudge(10, 5, 5), true, 'a full threshold past the last nudge');
  assert.equal(shouldNudge(100, 0, 0), false, 'threshold 0 disables');
  assert.equal(shouldNudge(100, 0, NaN), false, 'unparseable env disables');
});
