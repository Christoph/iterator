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

test('actionToCommand carries a typed plan goal through to the skills', () => {
  assert.equal(
    actionToCommand({ type: 'action', action: 'plan', chunk: null, prompt: 'Build a CLI for tides' }),
    '/skill:iterator-plan — Build a CLI for tides',
  );
  assert.equal(
    actionToCommand({ type: 'action', action: 'okf-init', prompt: 'Build a CLI for tides' }),
    '/skill:okf-init — when initialization finishes, continue into /skill:iterator-plan — Build a CLI for tides',
  );
  // No prompt → unchanged classic forms.
  assert.equal(actionToCommand({ type: 'action', action: 'plan', chunk: null }), '/skill:iterator-plan');
  assert.equal(actionToCommand({ type: 'action', action: 'okf-init' }), '/skill:okf-init');
});

test('attributionFromInput maps flow commands to ledger steps', async () => {
  const { attributionFromInput } = await import('../lib/pi-tools.mjs');
  assert.deepEqual(attributionFromInput('/skill:iterator-implement auth-middleware'),
    { step: 'implement', chunk: 'auth-middleware' });
  assert.deepEqual(attributionFromInput('/iterator-plan — build a tide CLI'),
    { step: 'plan', chunk: null });
  assert.deepEqual(attributionFromInput('/okf-memorize'), { step: 'memory', chunk: null });
  assert.deepEqual(attributionFromInput('/iterator-next'), { step: 'implement', chunk: null });
  assert.equal(attributionFromInput('fix the login bug'), null, 'plain prose keeps the previous attribution');
  assert.equal(attributionFromInput('/help'), null);
});

test('usageRowFromMessage extracts assistant usage with attribution', async () => {
  const { usageRowFromMessage } = await import('../lib/pi-tools.mjs');
  const msg = {
    role: 'assistant', provider: 'openai', model: 'gpt-5.5',
    usage: { input: 100, output: 40, cacheRead: 10, cacheWrite: 2 },
  };
  assert.deepEqual(usageRowFromMessage(msg, { step: 'review', chunk: 'auth' }), {
    step: 'review', chunk: 'auth', provider: 'openai', model: 'gpt-5.5',
    input: 100, output: 40, cacheRead: 10, cacheWrite: 2,
  });
  assert.equal(usageRowFromMessage(msg, null).step, 'other');
  assert.equal(usageRowFromMessage({ role: 'user' }, null), null);
  assert.equal(usageRowFromMessage({ role: 'assistant' }, null), null, 'no usage → no row');
});

// ---------------------------------------------------------------------------
// Auto mode state machine

const { nextAutoAction, roleModelSpec, AUTO_PHASE_FOR_STEP } = await import('../lib/pi-tools.mjs');

const S = (over = {}) => ({
  auto_mode: 'on', testing_default: 'on', max_review_iterations: 3,
  block_commit_on_leftovers: 'on', ...over,
});
const ST = (over = {}) => ({ mode: 'auto', paused: false, phase: 'implementing', active_chunk: null, strikes: {}, ...over });
const sess = ({ chunks = [], next = null, drafts = [], stuck = false, done = 0, total = chunks.length } = {}) => ({
  hub: { plan: { title: 'P' }, progress: { done, total }, chunks },
  implement: { next, drafts, stuck },
});

test('nextAutoAction is inert outside active auto mode', () => {
  const s = sess({ chunks: [{ name: 'a', status: 'pending' }], next: { name: 'a', testsStatus: 'none' } });
  assert.equal(nextAutoAction(s, S(), ST({ mode: 'manual' })), null);
  assert.equal(nextAutoAction(s, S(), ST({ paused: true })), null);
  assert.equal(nextAutoAction({ hub: { plan: null } }, S(), ST()), null, 'no plan');
});

test('nextAutoAction dispatches test → implement → review from bundle state', () => {
  const chunk = { name: 'a', status: 'pending', hasDiff: false };
  // No tests yet + testing on → tester turn.
  let a = nextAutoAction(sess({ chunks: [chunk], next: { name: 'a', testsStatus: 'none' } }), S(), ST());
  assert.deepEqual(a, { step: 'test', role: 'tester', chunk: 'a', cmd: '/skill:iterator-test a --auto' });
  assert.equal(AUTO_PHASE_FOR_STEP[a.step], 'testing');
  // Tests red, no diff → implementer turn.
  a = nextAutoAction(sess({ chunks: [chunk], next: { name: 'a', testsStatus: 'red' } }), S(), ST());
  assert.equal(a.step, 'implement');
  assert.equal(a.cmd, '/skill:iterator-implement a --auto');
  // Testing off skips straight to implement.
  a = nextAutoAction(sess({ chunks: [chunk], next: { name: 'a', testsStatus: 'none' } }), S({ testing_default: 'off' }), ST());
  assert.equal(a.step, 'implement');
  // Implementation diff exists → reviewer turn.
  a = nextAutoAction(sess({ chunks: [{ ...chunk, hasDiff: true }], next: { name: 'a', testsStatus: 'red' } }), S(), ST());
  assert.deepEqual(a, { step: 'review', role: 'reviewer', chunk: 'a', cmd: '/skill:iterator-review a --agent' });
});

test('nextAutoAction reads the review verdict from the bundle and strikes', () => {
  // Review round returned, chunk NOT done → needs-work → strike + rework.
  const s = sess({ chunks: [{ name: 'a', status: 'pending', hasDiff: true }], next: { name: 'a', testsStatus: 'red' } });
  let a = nextAutoAction(s, S(), ST({ phase: 'reviewing', active_chunk: 'a' }));
  assert.equal(a.step, 'implement');
  assert.equal(a.strike, 'a');
  // Two prior strikes: the third failure escalates.
  a = nextAutoAction(s, S(), ST({ phase: 'reviewing', active_chunk: 'a', strikes: { a: 2 } }));
  assert.equal(a.escalate, true);
  assert.match(a.reason, /failed agent review 3/);
  // Chunk done → approved: fall through to the next chunk (none → done).
  const approved = sess({ chunks: [{ name: 'a', status: 'done' }], next: null, done: 1, total: 1 });
  a = nextAutoAction(approved, S(), ST({ phase: 'reviewing', active_chunk: 'a' }));
  assert.deepEqual(a, { done: true });
});

test('nextAutoAction escalates on conflicts, prior strikes, drafts, and stuck graphs', () => {
  let a = nextAutoAction(
    sess({ chunks: [{ name: 'a', status: 'pending' }], next: { name: 'a', testsStatus: 'red', conflicts: [{ decision: 'decisions/no-orm' }] } }),
    S(), ST(),
  );
  assert.equal(a.escalate, true);
  assert.match(a.reason, /decisions\/no-orm/);

  a = nextAutoAction(
    sess({ chunks: [{ name: 'a', status: 'pending' }], next: { name: 'a', testsStatus: 'red' } }),
    S(), ST({ strikes: { a: 3 } }),
  );
  assert.equal(a.escalate, true);

  a = nextAutoAction(sess({ chunks: [], next: null, drafts: ['d'] }), S(), ST());
  assert.match(a.reason, /draft/);

  a = nextAutoAction(sess({ chunks: [{ name: 'a', status: 'pending' }], next: null, stuck: true, total: 1 }), S(), ST());
  assert.match(a.reason, /cycle or missing/);
});

test('roleModelSpec resolves overrides and leaves active alone', () => {
  const settings = {
    reviewer_model: 'anthropic/claude-opus-4-8', reviewer_thinking: 'high',
    implementer_model: 'active', implementer_thinking: 'medium',
  };
  assert.deepEqual(roleModelSpec(settings, 'reviewer'), { model: 'anthropic/claude-opus-4-8', thinking: 'high' });
  assert.deepEqual(roleModelSpec(settings, 'implementer'), { model: null, thinking: 'medium' });
  assert.deepEqual(roleModelSpec({}, 'tester'), { model: null, thinking: null });
});
