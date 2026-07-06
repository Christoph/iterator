import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isRemoteSession } from '../lib/server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANCEL_GRACE_MS = 250;

/** Spawn a skill server with a payload on stdin; resolve once it prints its URL. */
function startServer(skill, payload, extraEnv = {}) {
  const script = join(root, 'skills', skill, 'server.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        ITERATOR_NO_OPEN: '1',
        ITERATOR_PORT: '0', // ephemeral port, no collisions between tests
        ITERATOR_CANCEL_GRACE_MS: String(CANCEL_GRACE_MS),
        ITERATOR_REMOTE: '0', // deterministic even when the tests run over SSH / in a container
        ...extraEnv,
      },
    });
    let stderr = '', stdout = '';
    const io = { child, url: null, stdout: () => stdout, stderr: () => stderr };
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => {
      stderr += d;
      const m = stderr.match(/listening on (http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]+)/);
      if (m && !io.url) { io.url = new URL(m[1]); resolve(io); }
    });
    child.on('error', reject);
    child.on('exit', code => { if (!io.url) reject(new Error(`exited ${code} before listening: ${stderr}`)); });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
    setTimeout(() => reject(new Error('server did not start: ' + stderr)), 10_000).unref();
  });
}

const waitExit = child => new Promise(r => { child.on('exit', r); if (child.exitCode != null) r(child.exitCode); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pageUrl = io => io.url.href;
const apiUrl = (io, path) => `${io.url.origin}${path}${path.includes('?') ? '&' : '?'}t=${io.url.searchParams.get('t')}`;

const PLAN_PAYLOAD = {
  step: 'plan', branch: 'test', title: 'Add JWT auth',
  plan: { goal: 'g', architecture: 'a', keyDecisions: 'k', productFit: 'p' },
  dependencies: ['jsonwebtoken — signing'],
};

test('GET / serves the page and POST /submit echoes the body to stdout', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  const res = await fetch(pageUrl(io));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('const D = '));
  assert.ok(body.includes('Add JWT auth'));

  const submitted = JSON.stringify({ type: 'plan-approved', ok: true });
  await fetch(apiUrl(io, '/submit'), { method: 'POST', body: submitted });
  const code = await waitExit(io.child);
  assert.equal(code, 0);
  assert.equal(io.stdout().trim(), submitted);
});

test('payload containing </script> is embedded inertly', async () => {
  const io = await startServer('iterator-plan', {
    ...PLAN_PAYLOAD, title: 'x</script><script>alert(1)</script>',
  });
  const body = await (await fetch(pageUrl(io))).text();
  assert.ok(!body.includes('<script>alert(1)'));
  io.child.kill();
  await waitExit(io.child);
});

test('requests without the token are rejected and do not reach Claude', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  assert.equal((await fetch(io.url.origin + '/')).status, 403);
  assert.equal((await fetch(io.url.origin + '/?t=wrong')).status, 403);
  const forged = await fetch(io.url.origin + '/submit', { method: 'POST', body: '{"type":"evil"}' });
  assert.equal(forged.status, 403);
  await fetch(io.url.origin + '/cancel', { method: 'POST' }); // forged cancel, also 403
  await sleep(CANCEL_GRACE_MS + 100);
  assert.equal(io.child.exitCode, null, 'server must still be running');
  assert.equal(io.stdout(), '');
  io.child.kill();
  await waitExit(io.child);
});

test('requests with a non-local Host header are rejected (DNS rebinding)', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  const status = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: io.url.port, path: `/?t=${io.url.searchParams.get('t')}`,
      headers: { Host: 'evil.example.com' },
    }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
  io.child.kill();
  await waitExit(io.child);
});

test('beacon /cancel is dropped if the page reloads within the grace period', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  await fetch(apiUrl(io, '/cancel'), { method: 'POST' }); // pagehide beacon (reload)
  await fetch(pageUrl(io));                               // the reloaded page arrives
  await sleep(CANCEL_GRACE_MS + 100);
  assert.equal(io.child.exitCode, null, 'reload must not cancel the flow');
  assert.equal(io.stdout(), '');
  io.child.kill();
  await waitExit(io.child);
});

test('beacon /cancel with no reload emits {"type":"cancel"} after the grace period', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  await fetch(apiUrl(io, '/cancel'), { method: 'POST' });
  await waitExit(io.child);
  assert.deepEqual(JSON.parse(io.stdout()), { type: 'cancel' });
});

test('explicit Cancel (/cancel?now=1) cancels immediately', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD);
  const t0 = Date.now();
  await fetch(apiUrl(io, '/cancel?now=1'), { method: 'POST' });
  await waitExit(io.child);
  assert.ok(Date.now() - t0 < CANCEL_GRACE_MS, 'must not wait for the grace period');
  assert.deepEqual(JSON.parse(io.stdout()), { type: 'cancel' });
});

test('isRemoteSession: explicit override beats SSH markers, SSH markers imply remote', () => {
  assert.equal(isRemoteSession({ ITERATOR_REMOTE: '1' }), true);
  assert.equal(isRemoteSession({ ITERATOR_REMOTE: 'true' }), true);
  assert.equal(isRemoteSession({ ITERATOR_REMOTE: '0', SSH_TTY: '/dev/pts/0' }), false);
  assert.equal(isRemoteSession({ ITERATOR_REMOTE: 'false', SSH_CONNECTION: '1.2.3.4 5 6.7.8.9 22' }), false);
  assert.equal(isRemoteSession({ SSH_CONNECTION: '1.2.3.4 5 6.7.8.9 22' }), true);
  assert.equal(isRemoteSession({ SSH_TTY: '/dev/pts/0' }), true);
});

const reqStatus = (io, path, host) => new Promise((resolve, reject) => {
  const req = http.request({
    host: '127.0.0.1', port: io.url.port, path,
    headers: { Host: host },
  }, res => { res.resume(); resolve(res.statusCode); });
  req.on('error', reject);
  req.end();
});

test('ITERATOR_REMOTE=1 binds all interfaces, prints a loopback URL, still requires the token', async () => {
  const io = await startServer('iterator-plan', PLAN_PAYLOAD, { ITERATOR_REMOTE: '1' });
  // The printed URL must be clickable on the host: 127.0.0.1, never 0.0.0.0.
  assert.ok(io.url.href.startsWith('http://127.0.0.1:'));
  await sleep(100); // the hint line lands right after the resolving "listening on" line
  assert.match(io.stderr(), /remote session — bound to 0\.0\.0\.0/);
  // Host browser reaching a container by IP/hostname: allowed with the token.
  assert.equal(await reqStatus(io, `/?t=${io.url.searchParams.get('t')}`, '172.17.0.2:7777'), 200);
  // The token stays mandatory in exposed mode.
  assert.equal(await reqStatus(io, '/?t=wrong', '172.17.0.2:7777'), 403);
  io.child.kill();
  await waitExit(io.child);
});

test('SSH markers imply remote unless ITERATOR_REMOTE=0 forces local', async () => {
  const ssh = { SSH_CONNECTION: '1.2.3.4 5 6.7.8.9 22', ITERATOR_REMOTE: '' };
  const remote = await startServer('iterator-plan', PLAN_PAYLOAD, ssh);
  await sleep(100);
  assert.match(remote.stderr(), /remote session — bound to 0\.0\.0\.0/);
  remote.child.kill();
  await waitExit(remote.child);

  const local = await startServer('iterator-plan', PLAN_PAYLOAD, { ...ssh, ITERATOR_REMOTE: '0' });
  await sleep(100);
  assert.ok(!/remote session/.test(local.stderr()));
  assert.equal(await reqStatus(local, `/?t=${local.url.searchParams.get('t')}`, 'evil.example.com'), 403);
  local.child.kill();
  await waitExit(local.child);
});

test('ITERATOR_BIND_HOST overrides the bind address (ITERATOR_HOST is the deprecated alias)', async () => {
  for (const env of [{ ITERATOR_BIND_HOST: '0.0.0.0' }, { ITERATOR_HOST: '0.0.0.0' }]) {
    const io = await startServer('iterator-plan', PLAN_PAYLOAD, env);
    assert.equal(await reqStatus(io, `/?t=${io.url.searchParams.get('t')}`, '172.17.0.2:7777'), 200);
    assert.equal(await reqStatus(io, '/?t=wrong', '172.17.0.2:7777'), 403);
    io.child.kill();
    await waitExit(io.child);
  }
});

// Smoke-test the remaining step servers with their sample payloads.
const SMOKE = {
  'iterator': {
    step: 'hub', branch: 'test', plan: { title: 'Add JWT auth', status: 'approved' },
    progress: { done: 1, total: 2 },
    chunks: [
      { name: 'config-module', title: 'Config module', description: 'Config', status: 'done', size: 'small', linesEstimate: 30, testsStatus: 'green', dependsOn: [], hasDiff: false, hasCommits: true },
      { name: 'auth-middleware', title: 'Auth middleware', description: 'JWT middleware', status: 'pending', size: 'small', linesEstimate: 60, testsStatus: 'red', dependsOn: ['config-module'], hasDiff: true, hasCommits: false },
    ],
  },
  'iterator-chunk': {
    step: 'chunk', branch: 'test', plan: 'Add JWT auth',
    chunks: [
      { name: 'config-module', description: 'Config', files: ['src/config.ts'], dependsOn: [], linesEstimate: 30, size: 'small', status: 'pending', snippets: [] },
      { name: 'auth-middleware', description: 'JWT middleware', files: ['src/auth.ts'], dependsOn: ['config-module'], linesEstimate: 60, size: 'small', status: 'pending', snippets: [{ lang: 'ts', code: 'x' }] },
    ],
  },
  'iterator-review': {
    step: 'review', branch: 'test', commit: 'abc123 add auth', plan: 'Add JWT auth',
    progress: { done: 1, total: 3 }, hasChunksFile: true,
    chunks: [{ name: 'auth-middleware', description: 'JWT middleware', dependsOn: ['config-module'],
      stats: { added: 42, removed: 8, files: 1, complexity: 'yellow' },
      files: [{ path: 'src/auth.ts', hunks: [{ header: '@@ -41,5 +41,12 @@', oldStart: 41, newStart: 41,
        lines: [{ type: 'context', content: 'function login(user) {' }, { type: 'addition', content: '  const jwt = sign(payload, SECRET);' }] }] }] }],
    uncategorized: [],
  },
  'iterator-test': {
    step: 'test', branch: 'test', chunk: { name: 'auth-middleware', description: 'JWT middleware' },
    runner: 'vitest',
    cases: [{ title: 'passes a valid token', kind: 'happy', rationale: 'core' }],
  },
};

for (const [skill, payload] of Object.entries(SMOKE)) {
  test(`${skill} server round-trips its sample payload`, async () => {
    const io = await startServer(skill, payload);
    const body = await (await fetch(pageUrl(io))).text();
    assert.ok(body.includes('const D = '));
    await fetch(apiUrl(io, '/submit'), { method: 'POST', body: '{"type":"ok"}' });
    assert.equal(await waitExit(io.child), 0);
    assert.equal(io.stdout().trim(), '{"type":"ok"}');
  });
}
