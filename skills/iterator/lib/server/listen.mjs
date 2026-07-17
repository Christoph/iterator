/**
 * The one genuinely shared listen dance, extracted from server.mjs serve()
 * and session-server.mjs listen(): bind the start port; on EADDRINUSE under
 * force-port mode reclaim it once (only the start port is published to the
 * host), otherwise walk up; when every nearby port is busy fall back to an
 * OS-picked ephemeral port. Non-EADDRINUSE errors reject — the one-shot
 * finishes with exit 1, the session server propagates.
 */
import { BIND_HOST, FORCE_PORT } from './env.mjs';
import { reclaimPort } from './takeover.mjs';

// The dual-stack bind ('::', see env.mjs) is unavailable where the kernel or
// container has no IPv6 stack. Downgrading to the IPv4 wildcard beats failing
// to start — and keeps 127.0.0.1 answering, which reclaimPort's status probe
// depends on (a v6-only bind would make it fall through to lsof + SIGKILL).
const NO_IPV6 = new Set(['EAFNOSUPPORT', 'EPROTONOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL']);

/**
 * Bind `server` starting at `startPort`; resolves with the bound port.
 *
 * @param {import('node:http').Server} server
 * @param {object} o
 * @param {number} o.startPort
 * @param {number} [o.maxRetries]  walk-up attempts after the start port
 * @param {(m: string) => void} [o.say]  raw writer for reclaimPort progress
 * @param {(r: {killed: boolean, reason?: string}, port: number) => void}
 *   [o.onReclaimFail]  called when the one reclaim attempt did not free the
 *   port (r.reason === 'session' means a session dashboard owns it) — the
 *   caller prints its own wording, then the walk-up continues.
 */
export function listenWithTakeover(server, { startPort, maxRetries = 20, say, onReclaimFail } = {}) {
  return new Promise((resolve, reject) => {
    let reclaimTried = false;
    let host = BIND_HOST; // downgraded to '0.0.0.0' once if IPv6 is missing
    let downgraded = false;
    const tryListen = (p, attemptsLeft) => {
      const onError = err => {
        if (!downgraded && host === '::' && NO_IPV6.has(err.code)) {
          downgraded = true;
          host = '0.0.0.0';
          tryListen(p, attemptsLeft); // same port, other family
        } else if (err.code === 'EADDRINUSE' && FORCE_PORT && p === startPort
          && !reclaimTried && !process.env.ITERATOR_NO_TAKEOVER) {
          // Only the start port is published to the host — reclaim it once
          // instead of drifting to an unreachable port.
          reclaimTried = true;
          (say ? reclaimPort(p, say) : reclaimPort(p)).then(r => {
            if (r.killed) { tryListen(p, attemptsLeft); return; }
            if (onReclaimFail) onReclaimFail(r, p);
            tryListen(p + 1, attemptsLeft - 1);
          });
        } else if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryListen(p + 1, attemptsLeft - 1);
        } else if (err.code === 'EADDRINUSE') {
          // All nearby ports busy — let the OS pick an ephemeral one.
          server.once('error', reject);
          server.listen(0, host, () => resolve(server.address().port));
        } else {
          reject(err);
        }
      };
      server.once('error', onError);
      server.listen(p, host, () => {
        server.removeListener('error', onError);
        resolve(server.address().port);
      });
    };
    tryListen(startPort, maxRetries);
  });
}
