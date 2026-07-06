import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The session server runs in-process; env must be pinned BEFORE the lib
// modules load (CANCEL_GRACE_MS / REMOTE / BIND_HOST are module constants).
process.env.ITERATOR_NO_OPEN = '1';
process.env.ITERATOR_PORT = '0';
process.env.ITERATOR_REMOTE = '0';
process.env.ITERATOR_CANCEL_GRACE_MS = '250';
const CANCEL_GRACE_MS = 250;

const srvMod = await import('../lib/server.mjs'); // namespace: live RUN_ID binding
const { createSessionServer } = await import('../lib/session-server.mjs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Start a fresh session server on an ephemeral port + its own registry. */
async function startSession(opts = {}) {
  process.env.ITERATOR_REGISTRY = join(tmpdir(), `iterator-session-${randomUUID()}.json`);
  const session = createSessionServer({ log: () => {}, ...opts });
  const { port, url } = await session.start();
  return { session, port, url, origin: url.replace(/\/$/, ''), registry: process.env.ITERATOR_REGISTRY };
}

const viewHtml = (marker) => `<!DOCTYPE html><html><body>${marker} run=${srvMod.RUN_ID}</body></html>`;

/** Read the first SSE event from /events. */
function firstSseEvent(origin) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${origin}/events`, res => {
      let buf = '';
      res.on('data', d => {
        buf += d;
        const m = buf.match(/event: (\w+)\ndata: (.*)\n/);
        if (m) { req.destroy(); resolve({ event: m[1], data: JSON.parse(m[2]) }); }
      });
    });
    req.on('error', () => {}); // destroyed on purpose
    setTimeout(() => reject(new Error('no SSE event')), 3000).unref();
  });
}

test('GET / serves the persistent shell (iframe + EventSource); status says session', async () => {
  const { session, origin } = await startSession();
  try {
    const shell = await (await fetch(origin + '/')).text();
    assert.ok(shell.includes("new EventSource('/events')"));
    assert.ok(shell.includes('<iframe id="v" src="/view">'));
    const status = await (await fetch(origin + '/__iterator/status')).json();
    assert.equal(status.app, 'iterator');
    assert.equal(status.mode, 'session');
    assert.equal(status.pid, process.pid);
  } finally {
    await session.stop();
  }
});

test('GET /view serves a placeholder before the first step', async () => {
  const { session, origin } = await startSession();
  try {
    const view = await (await fetch(origin + '/view')).text();
    assert.match(view, /waiting for the next step/);
  } finally {
    await session.stop();
  }
});

test('showStep pushes an SSE view event, serves the html, and resolves on /submit', async () => {
  const { session, origin } = await startSession();
  try {
    const round = session.showStep({ step: 'plan', render: () => viewHtml('PLAN-VIEW') });
    const view = await (await fetch(origin + '/view')).text();
    assert.ok(view.includes('PLAN-VIEW'));
    const sse = await firstSseEvent(origin);
    assert.equal(sse.event, 'view');

    const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
      method: 'POST', body: '{"type":"plan-approved"}',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await round, { type: 'plan-approved' });
    // After a submit the dashboard shows the working overlay state.
    const after = await firstSseEvent(origin);
    assert.equal(after.event, 'working');
  } finally {
    await session.stop();
  }
});

test('a /submit with a stale run id is rejected and the round stays pending', async () => {
  const { session, origin } = await startSession();
  try {
    const round = session.showStep({ step: 'plan', render: () => viewHtml('X') });
    const res = await fetch(`${origin}/submit?r=deadbeefdeadbeef`, { method: 'POST', body: '{"type":"evil"}' });
    assert.equal(res.status, 409);
    assert.equal(session.hasPending(), true);
    await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, { method: 'POST', body: '{"type":"ok"}' });
    assert.deepEqual(await round, { type: 'ok' });
  } finally {
    await session.stop();
  }
});

test('a /submit with no pending round is handed to onUnsolicited (idle dashboard click)', async () => {
  let unsolicited = null;
  const { session, origin } = await startSession({ onUnsolicited: r => (unsolicited = r) });
  try {
    session.showView({ step: 'hub', render: () => viewHtml('HUB') });
    const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
      method: 'POST', body: '{"type":"action","action":"implement","chunk":"auth"}',
    });
    assert.equal(res.status, 200);
    await sleep(20);
    assert.deepEqual(unsolicited, { type: 'action', action: 'implement', chunk: 'auth' });
  } finally {
    await session.stop();
  }
});

test('a second showStep supersedes the first, and the old view\'s cancel beacon is ignored', async () => {
  const { session, origin } = await startSession();
  try {
    const first = session.showStep({ step: 'plan', render: () => viewHtml('ONE') });
    const oldRun = srvMod.RUN_ID;
    const second = session.showStep({ step: 'chunk', render: () => viewHtml('TWO') });
    assert.deepEqual(await first, { type: 'cancel' }, 'superseded round resolves as cancel');
    assert.notEqual(srvMod.RUN_ID, oldRun, 'run id must rotate per round');

    // The outgoing iframe fires its pagehide beacon with the OLD id — ignored.
    await fetch(`${origin}/cancel?r=${oldRun}`, { method: 'POST', body: '{}' });
    await sleep(CANCEL_GRACE_MS + 100);
    assert.equal(session.hasPending(), true, 'live round must survive the stale beacon');

    await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, { method: 'POST', body: '{"type":"ok"}' });
    assert.deepEqual(await second, { type: 'ok' });
  } finally {
    await session.stop();
  }
});

test('cancel grace: a reload (GET /view) keeps the round; ?now=1 cancels immediately', async () => {
  const { session, origin } = await startSession();
  try {
    const round = session.showStep({ step: 'plan', render: () => viewHtml('X') });
    await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}`, { method: 'POST', body: '{}' });
    await fetch(origin + '/view'); // the reloaded iframe arrives within the grace window
    await sleep(CANCEL_GRACE_MS + 100);
    assert.equal(session.hasPending(), true, 'reload must not cancel the round');

    await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}&now=1`, { method: 'POST', body: '{}' });
    assert.deepEqual(await round, { type: 'cancel' });
  } finally {
    await session.stop();
  }
});

test('an aborted signal resolves the round as cancel', async () => {
  const { session } = await startSession();
  try {
    const ac = new AbortController();
    const round = session.showStep({ step: 'plan', render: () => viewHtml('X'), signal: ac.signal });
    ac.abort();
    assert.deepEqual(await round, { type: 'cancel' });
    assert.equal(session.hasPending(), false);
  } finally {
    await session.stop();
  }
});

test('stop() resolves a pending round, frees the port, and removes the registry entry', async () => {
  const { session, origin, port, registry } = await startSession();
  const round = session.showStep({ step: 'plan', render: () => viewHtml('X') });
  await session.stop();
  assert.deepEqual(await round, { type: 'cancel' });
  assert.equal(session.isRunning(), false);
  assert.equal(existsSync(registry), false, 'registry entry must be cleaned up');
  await assert.rejects(() => fetch(origin + '/view'), undefined, `port ${port} must be free`);
});

test('a legacy one-shot takeover pass leaves the session server alive (mode guard)', async () => {
  const { session, origin, registry } = await startSession();
  try {
    // Simulate what a concurrently-launched one-shot server does before
    // binding: read the registry, probe the holder, and (normally) kill it.
    await srvMod.takeoverStale(registry);
    assert.equal(session.isRunning(), true, 'session server must never be killed');
    assert.equal(existsSync(registry), true, 'registry entry must survive');
    const status = await (await fetch(origin + '/__iterator/status')).json();
    assert.equal(status.mode, 'session');
  } finally {
    await session.stop();
  }
});
