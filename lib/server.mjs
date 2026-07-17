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
 * The machinery lives in focused modules — this file keeps the one-shot
 * request handler and re-exports everything, so importers never change:
 *   ./server/env.mjs      remote detection, bind host, force-port, timeouts
 *   ./server/run-id.mjs   the per-run stale-tab id
 *   ./server/takeover.mjs registry + single-instance takeover + port reclaim
 *   ./server/listen.mjs   the EADDRINUSE walk-up shared with session-server
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
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import {
  BIND_HOST, CANCEL_GRACE_MS, EXPOSED, LOCAL_HOST_RE, REMOTE, STATUS_PATH,
  TIMEOUT_MS, displayPort, displayUrl, openBrowser,
} from './server/env.mjs';
import { RUN_ID } from './server/run-id.mjs';
import { listenWithTakeover } from './server/listen.mjs';
import { registryPath, takeoverStale } from './server/takeover.mjs';

// The public surface is unchanged: everything the modules own is re-exported
// here (live bindings included), so session-server.mjs, app.mjs, tests, and
// the skill shims keep their single import point.
export {
  BIND_HOST, CANCEL_GRACE_MS, DISPLAY_HOST, EXPOSED, FORCE_PORT, LOCAL_HOST_RE,
  REMOTE, STATUS_PATH, TIMEOUT_MS, displayPort, displayUrl, isRemoteSession,
  openBrowser,
} from './server/env.mjs';
export { RUN_ID, newRunId } from './server/run-id.mjs';
export { listenWithTakeover } from './server/listen.mjs';
export { reclaimPort, registryPath, takeoverStale } from './server/takeover.mjs';

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
    // Always display localhost (ITERATOR_DISPLAY_HOST overrides), never the
    // bind address — 0.0.0.0 is not a clickable URL, and through a forward the
    // host reaches us on its own loopback anyway. ITERATOR_DISPLAY_PORT swaps
    // in the host-side port when the sandbox publish maps a different one.
    const url = displayUrl(port);
    openBrowser(url);
    process.stderr.write(`iterator: ${step} listening on ${url}\n`);
    if (REMOTE) {
      const hostPort = displayPort(port);
      process.stderr.write(
        `iterator: remote session — bound to ${BIND_HOST}. Forward/publish port ${port} ` +
        `to the host loopback (e.g. sbx ports <sandbox> --publish ${hostPort}:${port}, ` +
        `docker run -p 127.0.0.1:${hostPort}:${port}, or ssh -L ${hostPort}:localhost:${port}), ` +
        `then open the URL above in the host browser.\n`);
    }
    if (EXPOSED) {
      process.stderr.write(
        `iterator: WARNING — listening on ${BIND_HOST}: anyone who can reach this ` +
        `port can answer as the user. Keep the host-side publish on loopback ` +
        `(127.0.0.1:${displayPort(port)}, not 0.0.0.0:${displayPort(port)}).\n`);
    }
  };

  // Replace a lingering iterator UI before binding, so consecutive runs stay
  // on the same fixed port (ITERATOR_NO_TAKEOVER=1 opts out, e.g. in tests).
  if (!process.env.ITERATOR_NO_TAKEOVER) await takeoverStale(regPath);

  listenWithTakeover(server, {
    startPort,
    maxRetries: MAX_PORT_RETRIES,
    onReclaimFail: (r, port) => {
      if (r.reason === 'session') {
        process.stderr.write(
          `iterator: session dashboard owns port ${port} — open ` +
          `${displayUrl(port)} on the host; this one-shot walks up\n`);
      } else {
        process.stderr.write(
          `iterator: could not reclaim port ${port} — walking up (the UI ` +
          `may be unreachable through the sandbox's port publish)\n`);
      }
    },
  }).then(onListen).catch(err => {
    process.stderr.write(`iterator: server error: ${err.message}\n`);
    finish(null, 1);
  });

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
