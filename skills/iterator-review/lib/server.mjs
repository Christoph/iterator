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
 *   F9 — a busy port no longer crashes: we retry the next port a few times,
 *        then fall back to an ephemeral port, and always print the real URL.
 *   F10 — the 2h timeout prints { "type": "timeout" } to stdout instead of
 *        exiting silently, so the SKILL.md output contract is never violated.
 *
 * Security / robustness:
 *   - Every request must carry a per-run random token (?t=…, baked into the
 *     opened URL) and a localhost Host header. Without it, any web page open in
 *     the same browser could POST a forged /submit — which Claude would read as
 *     the user's answer — or /cancel the flow (and DNS rebinding could reach
 *     the server despite the 127.0.0.1 bind).
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
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

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

const TIMEOUT_MS = 7_200_000; // 2 hours
// How long a beacon /cancel is held before it counts, so a page reload
// (pagehide fires, then GET / arrives again) doesn't cancel the flow.
const CANCEL_GRACE_MS = parseInt(process.env.ITERATOR_CANCEL_GRACE_MS || '2500', 10);

const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

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
// (ITERATOR_HOST is the deprecated alias). The per-run token stays mandatory
// in every mode — it is the real defense once the port is reachable from
// outside. Only the localhost Host-header check is relaxed when exposed,
// because the host browser may reach us via a container IP or hostname.
const REMOTE = isRemoteSession();
const BIND_HOST = process.env.ITERATOR_BIND_HOST || process.env.ITERATOR_HOST
  || (REMOTE ? '0.0.0.0' : '127.0.0.1');
const EXPOSED = BIND_HOST !== '127.0.0.1';

/**
 * Serve a prebuilt HTML page and resolve the flow.
 *
 * @param {object} o
 * @param {string} o.step  short step name, used only in the stderr log line
 * @param {string} o.html  the full HTML document to serve at GET /
 */
export function serve({ step = 'iterator', html }) {
  const startPort = parseInt(process.env.ITERATOR_PORT || '7777', 10);
  const MAX_PORT_RETRIES = 20;
  const token = randomBytes(16).toString('hex');
  let done = false;
  let cancelTimer = null;

  const finish = (obj, exitCode = 0) => {
    if (done) return;
    done = true;
    if (obj) process.stdout.write(JSON.stringify(obj) + '\n');
    try { server.close(); } catch {}
    process.exit(exitCode);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if ((!EXPOSED && !LOCAL_HOST_RE.test(String(req.headers.host || ''))) ||
        url.searchParams.get('t') !== token) {
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
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(doneHtml());
        if (!done) {
          done = true;
          process.stdout.write((body.trim() || '{}') + '\n');
          try { server.close(); } catch {}
          // Give the socket a tick to flush before exiting.
          setTimeout(() => process.exit(0), 30).unref();
        }
      });
    } else if (req.method === 'POST' && url.pathname === '/cancel') {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        res.writeHead(204); res.end();
        if (done || cancelTimer) return;
        if (url.searchParams.get('now') === '1') { finish({ type: 'cancel' }); return; }
        cancelTimer = setTimeout(() => finish({ type: 'cancel' }), CANCEL_GRACE_MS);
      });
    } else {
      res.writeHead(404); res.end();
    }
  });

  const onListen = () => {
    const { port } = server.address();
    // Always display 127.0.0.1, never the bind address — 0.0.0.0 is not a
    // clickable URL, and through a forward the host reaches us on its own
    // loopback anyway.
    const url = `http://127.0.0.1:${port}/?t=${token}`;
    if (!REMOTE && !process.env.ITERATOR_NO_OPEN) {
      const opener = process.env.BROWSER
        || (process.platform === 'win32' ? 'start ""'
          : process.platform === 'darwin' ? 'open' : 'xdg-open');
      exec(`${opener} "${url}"`);
    }
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
        `port and obtain the token can answer as the user. Keep the host-side ` +
        `publish on loopback (127.0.0.1:${port}, not 0.0.0.0:${port}).\n`);
    }
  };

  const tryListen = (port, attemptsLeft) => {
    const onError = err => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
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

  tryListen(startPort, MAX_PORT_RETRIES);

  setTimeout(() => {
    process.stderr.write('iterator: timeout (2h), no response received\n');
    finish({ type: 'timeout' });
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
