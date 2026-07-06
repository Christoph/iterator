import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OWNED_KEYS, checkBashCommit, checkEdit, checkWrite, chunkInFlight, isChunkFile,
} from '../lib/guardrails.mjs';

const CHUNK_DOC = `---
type: Chunk
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

const withFm = (patch) => CHUNK_DOC.replace(/status: pending/, patch);

// ---------------------------------------------------------------------------
// isChunkFile

test('isChunkFile matches chunk docs and nothing else', () => {
  const env = {};
  assert.equal(isChunkFile('memory/chunks/auth.md', env), true);
  assert.equal(isChunkFile('/repo/sub/memory/chunks/auth.md', env), true);
  assert.equal(isChunkFile('memory/chunks/index.md', env), false, 'index is generated, not a chunk');
  assert.equal(isChunkFile('memory/plan.md', env), false);
  assert.equal(isChunkFile('memory/chunks/nested/x.md', env), false);
  assert.equal(isChunkFile('src/chunks/auth.md', env), false);
  assert.equal(isChunkFile('', env), false);
});

test('isChunkFile honors ITERATOR_MEMORY_DIR (relative and absolute)', () => {
  assert.equal(isChunkFile('.mem/chunks/a.md', { ITERATOR_MEMORY_DIR: '.mem' }), true);
  assert.equal(isChunkFile('memory/chunks/a.md', { ITERATOR_MEMORY_DIR: '.mem' }), false);
  assert.equal(isChunkFile('/abs/mem/chunks/a.md', { ITERATOR_MEMORY_DIR: '/abs/mem' }), true);
  assert.equal(isChunkFile('/abs/mem/chunks/index.md', { ITERATOR_MEMORY_DIR: '/abs/mem' }), false);
});

// ---------------------------------------------------------------------------
// checkWrite (W1–W5)

test('W1: writes outside chunk files are allowed', () => {
  assert.equal(checkWrite({ path: 'src/auth.ts', content: 'status: done' }, 'x'), null);
});

test('W2: a write flipping status to done is blocked', () => {
  const v = checkWrite({ path: 'memory/chunks/auth.md', content: withFm('status: done') }, CHUNK_DOC);
  assert.equal(v.block, true);
  assert.match(v.reason, /status: done/);
  assert.match(v.reason, /update-chunk/);
});

test('W3: a write changing other owned frontmatter keys is blocked and names them', () => {
  const v = checkWrite(
    { path: 'memory/chunks/auth.md', content: CHUNK_DOC.replace('tests_status: red', 'tests_status: green') },
    CHUNK_DOC,
  );
  assert.equal(v.block, true);
  assert.match(v.reason, /tests_status/);
});

test('W4: a body-only rewrite is allowed (hand-editability)', () => {
  const v = checkWrite(
    { path: 'memory/chunks/auth.md', content: CHUNK_DOC.replace('Verify token', 'Check token') },
    CHUNK_DOC,
  );
  assert.equal(v, null);
});

test('W5: creating a chunk file by hand warns', () => {
  const v = checkWrite({ path: 'memory/chunks/new-chunk.md', content: CHUNK_DOC }, null);
  assert.equal(v.warn, true);
  assert.equal(v.block, undefined);
  assert.match(v.reason, /chunks op/);
});

// ---------------------------------------------------------------------------
// checkEdit (E1–E4)

test('E1: edits outside chunk files are allowed', () => {
  assert.equal(checkEdit({ path: 'src/a.ts', edits: [{ oldText: 'status: pending', newText: 'status: done' }] }, 'status: pending'), null);
});

test('E2: an edit setting status: done is blocked', () => {
  const v = checkEdit(
    { path: 'memory/chunks/auth.md', edits: [{ oldText: 'status: pending', newText: 'status: done' }] },
    CHUNK_DOC,
  );
  assert.equal(v.block, true);
  assert.match(v.reason, /update-chunk/);
});

test('E3: an edit touching owned frontmatter (not done) warns', () => {
  const v = checkEdit(
    { path: 'memory/chunks/auth.md', edits: [{ oldText: 'tests_status: red', newText: 'tests_status: green' }] },
    CHUNK_DOC,
  );
  assert.equal(v.warn, true);
  assert.equal(v.block, undefined);
  assert.match(v.reason, /tests_status/);
});

test('E3: single oldText/newText input shape (no edits array) is understood', () => {
  const v = checkEdit(
    { path: 'memory/chunks/auth.md', oldText: 'timestamp: 2026-07-01T00:00:00Z', newText: 'timestamp: 2026-07-02T00:00:00Z' },
    CHUNK_DOC,
  );
  assert.equal(v.warn, true);
  assert.match(v.reason, /timestamp/);
});

test('E4: body-only edits are allowed', () => {
  const v = checkEdit(
    { path: 'memory/chunks/auth.md', edits: [{ oldText: 'Verify token from config secret.', newText: 'Check the token.' }] },
    CHUNK_DOC,
  );
  assert.equal(v, null);
});

// ---------------------------------------------------------------------------
// chunkInFlight

const chunk = (slug, fm) => ({ slug, fm });

test('chunkInFlight: pending + red tests is in flight; drafts and done never are', () => {
  assert.deepEqual(
    chunkInFlight([chunk('a', { status: 'pending', tests_status: 'red' })]),
    { inFlight: true, slug: 'a' });
  assert.equal(chunkInFlight([chunk('a', { status: 'draft', tests_status: 'red' })]).inFlight, false);
  assert.equal(chunkInFlight([chunk('a', { status: 'done', tests_status: 'green' })]).inFlight, false);
  assert.equal(chunkInFlight([chunk('a', { status: 'pending' })]).inFlight, false);
  assert.equal(chunkInFlight([chunk('a', { status: 'pending', tests: ['test/a.mjs'] })]).inFlight, true);
  assert.equal(chunkInFlight([]).inFlight, false);
  assert.equal(chunkInFlight(undefined).inFlight, false);
});

// ---------------------------------------------------------------------------
// checkBashCommit (B1–B6)

const IN_FLIGHT = [chunk('auth-middleware', { status: 'pending', tests_status: 'red' })];
const IDLE = [chunk('auth-middleware', { status: 'done', tests_status: 'green' })];

test('B1: non-commit commands are allowed', () => {
  assert.equal(checkBashCommit({ command: 'git status' }, { chunks: IN_FLIGHT }), null);
  assert.equal(checkBashCommit({ command: 'ls -la' }, { chunks: IN_FLIGHT }), null);
  assert.equal(checkBashCommit({ command: 'echo commit' }, { chunks: IN_FLIGHT }), null);
});

test('B2: --amend without a new message is allowed (trailer reused)', () => {
  assert.equal(checkBashCommit({ command: 'git commit --amend --no-edit' }, { chunks: IN_FLIGHT }), null);
});

test('B3: a commit carrying the Chunk: trailer is allowed (incl. heredoc form)', () => {
  assert.equal(checkBashCommit(
    { command: 'git commit -m "chunk(auth-middleware): add middleware" -m "Chunk: auth-middleware"' },
    { chunks: IN_FLIGHT }), null);
  assert.equal(checkBashCommit(
    { command: 'git commit -m "$(cat <<EOF\nchunk(auth): x\n\nChunk: auth-middleware\nEOF\n)"' },
    { chunks: IN_FLIGHT }), null);
});

test('B4: a chunk-style message without the trailer warns', () => {
  const v = checkBashCommit({ command: 'git commit -m "chunk(auth-middleware): add middleware"' }, { chunks: IDLE });
  assert.equal(v.warn, true);
  assert.match(v.reason, /Chunk: <slug>/);
});

test('B5: any trailerless commit warns while a chunk is in flight, naming it', () => {
  const v = checkBashCommit({ command: 'git commit -m "wip"' }, { chunks: IN_FLIGHT });
  assert.equal(v.warn, true);
  assert.match(v.reason, /auth-middleware/);
});

test('B6: a trailerless commit with nothing in flight is allowed', () => {
  assert.equal(checkBashCommit({ command: 'git commit -m "wip"' }, { chunks: IDLE }), null);
});

test('OWNED_KEYS covers exactly the writer-owned frontmatter', () => {
  assert.deepEqual(OWNED_KEYS, ['status', 'tests_status', 'commits', 'timestamp', 'done', 'reviewed']);
});
