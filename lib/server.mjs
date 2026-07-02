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
 */
import http from 'node:http';
import { exec } from 'node:child_process';

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

/**
 * Serve a prebuilt HTML page and resolve the flow.
 *
 * @param {object} o
 * @param {string} o.step  short step name, used only in the stderr log line
 * @param {string} o.html  the full HTML document to serve at GET /
 */
export function serve({ step = 'iterator', html }) {
  const startPort = parseInt(process.env.ITERATOR_PORT || '8888', 10);
  const MAX_PORT_RETRIES = 20;
  let done = false;

  const finish = (obj, exitCode = 0) => {
    if (done) return;
    done = true;
    if (obj) process.stdout.write(JSON.stringify(obj) + '\n');
    try { server.close(); } catch {}
    process.exit(exitCode);
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (req.method === 'POST' && req.url === '/submit') {
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
    } else if (req.method === 'POST' && req.url === '/cancel') {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => { res.writeHead(204); res.end(); finish({ type: 'cancel' }); });
    } else {
      res.writeHead(404); res.end();
    }
  });

  const onListen = () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}`;
    const opener = process.platform === 'win32' ? 'start ""'
      : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${opener} "${url}"`);
    process.stderr.write(`iterator: ${step} listening on ${url}\n`);
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
        server.listen(0, '127.0.0.1', onListen);
      } else {
        process.stderr.write(`iterator: server error: ${err.message}\n`);
        finish(null, 1);
      }
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
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
