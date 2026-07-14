#!/usr/bin/env node
/**
 * iterator: shared local UI server.
 *
 * Every step's server.mjs reads a JSON payload from stdin, builds a full HTML
 * page (see ./ui.mjs), and calls serve() to open it in the browser and block
 * until the user submits. The browser POSTs a structured result to /submit,
 * which is printed verbatim to stdout; a closed tab POSTs /cancel and we emit
 * { "type": "cancel" }; after 2h with no answer we emit { "type": "timeout" }.
 *
 * Fixes baked in versus the old per-skill servers:
 *   F8 — page data is embedded with `<` escaped (see embed() in ui.mjs), so a
 *        diff line containing `</script>` can no longer terminate the script.
 *   F9 — a busy port no longer crashes. First, single-instance takeover: a
 *        lingering iterator UI from an earlier run (recorded in a per-user
 *        registry file, verified via its tokenless /__iterator/status
 *        endpoint) is SIGTERMed and replaced, so back-to-back runs always land
 *        on the same fixed port — the port a sandbox forwards (see
 *        pi-docker-sandbox-setup, which publishes exactly 7777). Locally, a
 *        *foreign* holder makes us walk up / fall back to an ephemeral port,
 *        always printing the real URL. Remotely (REMOTE, or
 *        ITERATOR_FORCE_PORT=1) walking up is useless — only the start port
 *        is published to the host — so reclaimPort() kills the foreign/stale
 *        holder (lsof/fuser, SIGTERM→SIGKILL, never a session dashboard,
 *        never self/parent) and retries the same port once before degrading
 *        to the walk-up.
 *   F10 — the 2h timeout prints { "type": "timeout" } to stdout instead of
 *        exiting silently, so the SKILL.md output contract is never violated.
 *   F11 — SIGTERM/SIGINT/SIGHUP print { "type": "cancel" } before exiting, so
 *        a superseded or interrupted server still satisfies the one-JSON-line
 *        output contract and never leaves the port occupied.
 *
 * Security / robustness:
 *   - Locally the server binds 127.0.0.1 and requires a localhost Host header
 *     (rejects DNS-rebinding requests). There is no per-run auth token — the
 *     dashboard is a local dev tool and the URL stays clean/bookmarkable,
 *     matching okf-memory's server.
 *   - Stale-tab guard: every page embeds a per-run id and echoes it on
 *     /submit and /cancel (?r=…). With a fixed shared port, a tab left over
 *     from an EARLIER round fires its pagehide /cancel beacon at the CURRENT
 *     server when closed — without the id check that silently cancelled the
 *     live round. Mismatched ids are ignored (absent ids are allowed so curl
 *     and scripts keep working).
 *   - A /cancel from the pagehide beacon is held for a short grace period and
 *     dropped if the page reloads (GET / arrives again), so an accidental F5
 *     no longer kills the whole flow. The explicit Cancel button sends
 *     /cancel?now=1 and still cancels immediately.
 *
 * Remote sessions (SSH, Docker/devcontainer sandbox — see isRemoteSession):
 * the browser lives on the host, so we bind 0.0.0.0 instead of loopback (a
 * forwarded port cannot reach a loopback bind), skip the browser opener, and
 * print a http://127.0.0.1:<port>/ URL for the host to open through its
 * forward. ITERATOR_REMOTE=1/0 overrides detection; ITERATOR_BIND_HOST
 * overrides the bind address.
 */
import http from 'node:http';
import { exec, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

/** Read all of stdin as a string, resolving with '' if nothing arrives. */
export function readStdin() {
  return new Promise(resolve => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => (raw += c));
    process.stdin.on('end', () => resolve(raw));
    // If stdin is a TTY with no piped data, don't hang forever.
    if (process.stdin.isTTY) resolve('');
  });
}

/** Parse a JSON payload from stdin (defaults to {}). */
export async function readPayload() {
  const raw = await readStdin();
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

export const TIMEOUT_MS = 7_200_000; // 2 hours
// How long a beacon /cancel is held before it counts, so a page reload
// (pagehide fires, then GET / arrives again) doesn't cancel the flow.
export const CANCEL_GRACE_MS = parseInt(process.env.ITERATOR_CANCEL_GRACE_MS || '2500', 10);

export const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

/**
 * Detect a remote session (SSH, Docker/devcontainer sandbox) where the browser
 * lives on the *host*: a loopback bind would be unreachable through a port
 * forward, and there is no local browser to open. Detection order: explicit
 * ITERATOR_REMOTE override ("1"/"true" forces remote, "0"/"false" forces
 * local), then SSH markers, then container markers. MicroVM sandboxes have no
 * container marker files — set ITERATOR_REMOTE=1 in the sandbox image there.
 */
export function isRemoteSession(env = process.env) {
  const override = String(env.ITERATOR_REMOTE ?? '').toLowerCase();
  if (override === '1' || override === 'true') return true;
  if (override === '0' || override === 'false') return false;
  if (env.SSH_TTY || env.SSH_CONNECTION) return true;
  return existsSync('/.dockerenv') || existsSync('/run/.containerenv');
}

// In a remote session bind all interfaces so a forwarded/published port can
// reach us; locally stay on loopback. ITERATOR_BIND_HOST overrides either way
// (ITERATOR_HOST is the deprecated alias). The localhost Host-header check is
// relaxed when exposed, because the host browser may reach us via a container
// IP or hostname; keep the host-side publish on loopback.
export const REMOTE = isRemoteSession();
export const BIND_HOST = process.env.ITERATOR_BIND_HOST || process.env.ITERATOR_HOST
  || (REMOTE ? '0.0.0.0' : '127.0.0.1');
export const EXPOSED = BIND_HOST !== '127.0.0.1';

// Single-instance takeover. There is one iterator UI per user — the browser
// control plane — and it must sit on a *stable* port (a sandbox forwards
// exactly that port to the host). Each server records { pid, port } in a
// per-user registry file; the next server verifies the recorded process is
// really a lingering iterator UI (tokenless read-only status endpoint, so a
// reused pid is never killed by mistake), SIGTERMs it, and takes the port.
export const STATUS_PATH = '/__iterator/status';

// Per-run id, embedded into the page (lib/ui.mjs) and echoed on /submit and
// /cancel so a stale tab from a previous round can't act on this run. Not an
// auth secret — purely round-matching. The session server (see
// lib/session-server.mjs) rotates it per round via newRunId(); the one-shot
// server keeps the initial value for its whole life.
export let RUN_ID = randomBytes(8).toString('hex');

/** Rotate the per-run id (session server: one id per UI round). */
export function newRunId() {
  RUN_ID = randomBytes(8).toString('hex');
  return RUN_ID;
}

/** Registry file recording the currently-listening UI server for this user. */
export function registryPath() {
  if (process.env.ITERATOR_REGISTRY) return process.env.ITERATOR_REGISTRY;
  let uid = 'u';
  try { uid = String(userInfo().uid); } catch {}
  return join(tmpdir(), `iterator-ui-${uid}.json`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Open the user's browser at url unless remote/suppressed. */
export function openBrowser(url) {
  if (REMOTE || process.env.ITERATOR_NO_OPEN) return;
  const opener = process.env.BROWSER
    || (process.platform === 'win32' ? 'start ""'
      : process.platform === 'darwin' ? 'open' : 'xdg-open');
  exec(`${opener} "${url}"`);
}

/** Shut down a lingering iterator UI recorded in the registry, if any. */
export async function takeoverStale(regPath) {
  let reg;
  try { reg = JSON.parse(readFileSync(regPath, 'utf8')); } catch { return; }
  if (!reg || !Number.isInteger(reg.pid) || !Number.isInteger(reg.port)
    || reg.pid === process.pid) return;
  let status = null;
  try {
    const res = await fetch(`http://127.0.0.1:${reg.port}${STATUS_PATH}`,
      { signal: AbortSignal.timeout(500) });
    if (res.ok) status = await res.json().catch(() => null);
  } catch {}
  if (status && status.app === 'iterator' && status.mode === 'session') {
    // A session dashboard (in-process in the pi extension) owns the port for
    // the whole session — never SIGTERM it (that pid is the agent itself).
    // The one-shot caller simply walks up to the next free port.
    process.stderr.write(
      `iterator: session dashboard owns port ${reg.port} — using another port\n`);
    return;
  }
  if (status && status.app === 'iterator' && status.pid === reg.pid) {
    process.stderr.write(
      `iterator: closing previous UI server (pid ${reg.pid}, port ${reg.port})\n`);
    try { process.kill(reg.pid, 'SIGTERM'); } catch {}
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try { process.kill(reg.pid, 0); } catch { break; } // throws once it's gone
      await sleep(50);
    }
    try { process.kill(reg.pid, 0); process.kill(reg.pid, 'SIGKILL'); } catch {}
  }
  try { unlinkSync(regPath); } catch {}
}

// Force-port mode: a sandbox publishes exactly the start port to the host
// (pi-docker-sandbox-setup publishes 7777:7777), so a walk-up bind on 7778 is
// unreachable from the host browser. Under REMOTE — or ITERATOR_FORCE_PORT=1
// for microVMs/tests — the servers reclaim the start port instead.
export const FORCE_PORT = REMOTE
  || ['1', 'true'].includes(String(process.env.ITERATOR_FORCE_PORT ?? '').toLowerCase());

/**
 * Reclaim `port` from whatever process holds it, so the server can bind the
 * one port the sandbox publishes. Policy:
 *   - a live iterator *session dashboard* is never killed (that pid is the
 *     agent process itself) → { killed:false, reason:'session' };
 *   - a lingering iterator one-shot identified via its status endpoint is
 *     SIGTERMed with the same grace loop as takeoverStale;
 *   - anything else (foreign or unidentifiable) is resolved via
 *     `lsof -ti tcp:<port> -sTCP:LISTEN` (fuser fallback) and
 *     SIGTERMed → SIGKILLed, skipping self/parent. Same-uid only: EPERM and
 *     missing tools degrade to { killed:false } and the caller walks up.
 */
export async function reclaimPort(port, say = m => process.stderr.write(m)) {
  let status = null;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${STATUS_PATH}`,
      { signal: AbortSignal.timeout(500) });
    if (res.ok) status = await res.json().catch(() => null);
  } catch {}
  if (status && status.app === 'iterator' && status.mode === 'session') {
    return { killed: false, reason: 'session' };
  }

  const waitDead = async pid => {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try { process.kill(pid, 0); } catch { return true; } // throws once gone
      await sleep(50);
    }
    return false;
  };
  const killPid = async pid => {
    try { process.kill(pid, 'SIGTERM'); } catch { return false; } // EPERM/gone
    if (!(await waitDead(pid))) {
      try { process.kill(pid, 'SIGKILL'); } catch {}
      await waitDead(pid);
    }
    try { process.kill(pid, 0); return false; } catch { return true; }
  };

  if (status && status.app === 'iterator' && Number.isInteger(status.pid)) {
    say(`iterator: port ${port} held by a previous iterator UI (pid ${status.pid}) — reclaiming\n`);
    return { killed: await killPid(status.pid) };
  }

  // Foreign or unidentifiable holder: resolve the listener pids via the OS.
  let out = '';
  try {
    out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (e.code === 'ENOENT') {
      try {
        out = execFileSync('fuser', [`${port}/tcp`],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch { return { killed: false }; }
    } else {
      out = String(e.stdout || ''); // lsof exits 1 when nothing matches
    }
  }
  const pids = [...new Set(out.split(/\s+/)
    .map(s => parseInt(s, 10))
    .filter(Number.isInteger))]
    .filter(pid => pid > 0 && pid !== process.pid && pid !== process.ppid);
  if (!pids.length) return { killed: false };

  let killed = false;
  for (const pid of pids) {
    say(`iterator: port ${port} held by pid ${pid} (foreign) — reclaiming ` +
      `(only ${port} is published in this sandbox)\n`);
    if (await killPid(pid)) killed = true;
  }
  return { killed };
}

/**
 * Serve a prebuilt HTML page and resolve the flow.
 *
 * @param {object} o
 * @param {string} o.step  short step name, used only in the stderr log line
 * @param {string} o.html  the full HTML document to serve at GET /
 * @param {(result: object) => Promise<object|void>} [o.onSubmit]  optional:
 *   runs after the browser answers and may return a transformed object to
 *   print instead (used to apply purely-mechanical results, e.g. memory
 *   review verdicts, in code before the agent ever sees them). A throwing
 *   onSubmit annotates the original result with { applied: { ok, error } }
 *   rather than losing it.
 * @param {{cancel?: string, timeout?: string}} [o.reports]  human-facing
 *   summaries attached to cancel/timeout results as `report` — the skill
 *   relays the string instead of carrying per-step cancel prose itself.
 */
export async function serve({ step = 'iterator', html, onSubmit, reports = {} }) {
  const startPort = parseInt(process.env.ITERATOR_PORT || '7777', 10);
  const MAX_PORT_RETRIES = 20;
  const regPath = registryPath();
  let done = false;
  let cancelTimer = null;

  const finish = (obj, exitCode = 0) => {
    if (done) return;
    done = true;
    if (obj) process.stdout.write(JSON.stringify(obj) + '\n');
    try {
      const cur = JSON.parse(readFileSync(regPath, 'utf8'));
      if (cur && cur.pid === process.pid) unlinkSync(regPath);
    } catch {}
    try { server.close(); } catch {}
    process.exit(exitCode);
  };

  // A superseded/interrupted server must free the port *and* still honor the
  // one-JSON-line contract, so signals resolve as a cancel.
  const cancelResult = () => ({
    type: 'cancel',
    ...(reports.cancel ? { report: reports.cancel } : {}),
  });

  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(sig, () => finish(cancelResult()));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === STATUS_PATH) {
      // Tokenless on purpose: the successor server uses this to verify the
      // port holder is a lingering iterator UI before signalling it. It is
      // read-only and reveals nothing sensitive.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ app: 'iterator', step, pid: process.pid }));
      return;
    }
    // No per-run token (dev tool; matches okf-memory) — but locally we still
    // reject non-localhost Host headers so DNS rebinding can't reach us.
    if (!EXPOSED && !LOCAL_HOST_RE.test(String(req.headers.host || ''))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/') {
      // A GET during the cancel grace period is the page reloading — keep going.
      if (cancelTimer) { clearTimeout(cancelTimer); cancelTimer = null; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (req.method === 'POST' && url.pathname === '/submit') {
      const r = url.searchParams.get('r');
      if (r && r !== RUN_ID) {
        process.stderr.write('iterator: ignored /submit from a previous run’s tab\n');
        res.writeHead(409); res.end();
        return;
      }
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', async () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(doneHtml());
        if (!done) {
          done = true;
          // Parse-validate before printing: the stdout line is a one-JSON-line
          // contract, and any local process can POST garbage here.
          let parsed;
          try {
            parsed = JSON.parse(body.trim() || '{}');
          } catch {
            parsed = { type: 'error', error: 'malformed /submit body (not JSON)' };
          }
          if (onSubmit && parsed.type !== 'error') {
            try {
              const transformed = await onSubmit(parsed);
              if (transformed) parsed = transformed;
            } catch (e) {
              parsed.applied = { ok: false, error: e.message };
            }
          }
          process.stdout.write(JSON.stringify(parsed) + '\n');
          try { server.close(); } catch {}
          // Give the socket a tick to flush before exiting.
          setTimeout(() => process.exit(0), 30).unref();
        }
      });
    } else if (req.method === 'POST' && url.pathname === '/cancel') {
      const r = url.searchParams.get('r');
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        res.writeHead(204); res.end();
        if (r && r !== RUN_ID) {
          process.stderr.write('iterator: ignored /cancel from a previous run’s tab\n');
          return;
        }
        if (done || cancelTimer) return;
        if (url.searchParams.get('now') === '1') { finish(cancelResult()); return; }
        cancelTimer = setTimeout(() => finish(cancelResult()), CANCEL_GRACE_MS);
      });
    } else {
      res.writeHead(404); res.end();
    }
  });

  const onListen = () => {
    const { port } = server.address();
    // Record ourselves so the next server can find and replace us even if we
    // are never answered (the port-leak fix: no more orphans holding 7777).
    try {
      writeFileSync(regPath, JSON.stringify(
        { pid: process.pid, port, step, started: new Date().toISOString() },
      ) + '\n', { mode: 0o600 });
    } catch {}
    // Always display 127.0.0.1, never the bind address — 0.0.0.0 is not a
    // clickable URL, and through a forward the host reaches us on its own
    // loopback anyway.
    const url = `http://127.0.0.1:${port}/`;
    openBrowser(url);
    process.stderr.write(`iterator: ${step} listening on ${url}\n`);
    if (REMOTE) {
      process.stderr.write(
        `iterator: remote session — bound to ${BIND_HOST}. Forward/publish port ${port} ` +
        `to the host loopback (e.g. sbx ports <sandbox> --publish ${port}:${port}, ` +
        `docker run -p 127.0.0.1:${port}:${port}, or ssh -L ${port}:localhost:${port}), ` +
        `then open the URL above in the host browser.\n`);
    }
    if (EXPOSED) {
      process.stderr.write(
        `iterator: WARNING — listening on ${BIND_HOST}: anyone who can reach this ` +
        `port can answer as the user. Keep the host-side publish on loopback ` +
        `(127.0.0.1:${port}, not 0.0.0.0:${port}).\n`);
    }
  };

  let reclaimTried = false;
  const tryListen = (port, attemptsLeft) => {
    const onError = err => {
      if (err.code === 'EADDRINUSE' && FORCE_PORT && port === startPort
        && !reclaimTried && !process.env.ITERATOR_NO_TAKEOVER) {
        // Only the start port is published to the host — reclaim it once
        // instead of drifting to an unreachable port.
        reclaimTried = true;
        reclaimPort(port).then(r => {
          if (r.killed) { tryListen(port, attemptsLeft); return; }
          if (r.reason === 'session') {
            process.stderr.write(
              `iterator: session dashboard owns port ${port} — open ` +
              `http://127.0.0.1:${port}/ on the host; this one-shot walks up\n`);
          } else {
            process.stderr.write(
              `iterator: could not reclaim port ${port} — walking up (the UI ` +
              `may be unreachable through the sandbox's port publish)\n`);
          }
          tryListen(port + 1, attemptsLeft - 1);
        });
      } else if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        tryListen(port + 1, attemptsLeft - 1);
      } else if (err.code === 'EADDRINUSE') {
        // All nearby ports busy — let the OS pick an ephemeral one.
        server.removeListener('error', onError);
        server.once('error', e => {
          process.stderr.write(`iterator: server error: ${e.message}\n`);
          finish(null, 1);
        });
        server.listen(0, BIND_HOST, onListen);
      } else {
        process.stderr.write(`iterator: server error: ${err.message}\n`);
        finish(null, 1);
      }
    };
    server.once('error', onError);
    server.listen(port, BIND_HOST, () => {
      server.removeListener('error', onError);
      onListen();
    });
  };

  // Replace a lingering iterator UI before binding, so consecutive runs stay
  // on the same fixed port (ITERATOR_NO_TAKEOVER=1 opts out, e.g. in tests).
  if (!process.env.ITERATOR_NO_TAKEOVER) await takeoverStale(regPath);

  tryListen(startPort, MAX_PORT_RETRIES);

  setTimeout(() => {
    process.stderr.write('iterator: timeout (2h), no response received\n');
    finish({
      type: 'timeout',
      ...(reports.timeout ? { report: reports.timeout } : {}),
    });
  }, TIMEOUT_MS).unref();
}

/** The little "you can close this tab" page shown after a submit. */
export function doneHtml(msg = 'Sent to Claude') {
  return `<!DOCTYPE html><html data-theme="dark"><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117;color:#7ee787;
font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;
height:100vh;flex-direction:column;gap:12px}p{color:#8b949e;font-size:14px}</style></head>
<body><h2>✓ ${msg}</h2><p>You can close this tab.</p></body></html>`;
}
