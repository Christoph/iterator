import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  actionToCommand, bundleExists, chunksDirEntries, mergePayload, runJson, scriptPath,
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
