/**
 * Server environment: remote-session detection, bind address, fixed-port
 * policy, timeouts, and the browser opener. Pure configuration — no sockets.
 * (Split out of server.mjs; behavior unchanged.)
 */
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';

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
//
// '::' — not '0.0.0.0' — because it is the *dual-stack* wildcard (node leaves
// ipv6Only false), so one socket answers both forwards a sandbox publishes
// (127.0.0.1:N->7777 and ::1:N->7777). Bound IPv4-only, the v6 forward has
// nothing behind it and RSTs; a reset (unlike a refusal) stops clients falling
// back, so `localhost` — which resolves to ::1 first — breaks on the host.
// listen.mjs downgrades to '0.0.0.0' where there is no IPv6 stack.
export const REMOTE = isRemoteSession();
export const BIND_HOST = process.env.ITERATOR_BIND_HOST || process.env.ITERATOR_HOST
  || (REMOTE ? '::' : '127.0.0.1');
// Any bind other than plain loopback is reachable off-box, so the Host check
// relaxes. '::' is all-interfaces, so this stays true — as it was for '0.0.0.0'.
export const EXPOSED = BIND_HOST !== '127.0.0.1';

// Single-instance takeover. There is one iterator UI per user — the browser
// control plane — and it must sit on a *stable* port (a sandbox forwards
// exactly that port to the host). Each server records { pid, port } in a
// per-user registry file; the next server verifies the recorded process is
// really a lingering iterator UI (tokenless read-only status endpoint, so a
// reused pid is never killed by mistake), SIGTERMs it, and takes the port.
export const STATUS_PATH = '/__iterator/status';

// Force-port mode: a sandbox publishes exactly the start port to the host
// (pi-docker-sandbox-setup publishes 7777:7777), so a walk-up bind on 7778 is
// unreachable from the host browser. Under REMOTE — or ITERATOR_FORCE_PORT=1
// for microVMs/tests — the servers reclaim the start port instead.
export const FORCE_PORT = REMOTE
  || ['1', 'true'].includes(String(process.env.ITERATOR_FORCE_PORT ?? '').toLowerCase());

// Host-facing display URL. Through a sandbox publish the host-side port may
// differ from the listen port (pisbx picks the next free host port per
// sandbox and writes ITERATOR_DISPLAY_PORT into it); ITERATOR_DISPLAY_HOST
// overrides the hostname. Display only — the bind address and listen port
// are unaffected.
export const DISPLAY_HOST = process.env.ITERATOR_DISPLAY_HOST || 'localhost';

/** Host-side port for printed URLs: ITERATOR_DISPLAY_PORT, else the listen port. */
export function displayPort(port) {
  const p = parseInt(process.env.ITERATOR_DISPLAY_PORT || '', 10);
  return Number.isInteger(p) && p > 0 ? p : port;
}

/** The URL the user should open on the host to reach a server on `port`. */
export function displayUrl(port) {
  return `http://${DISPLAY_HOST}:${displayPort(port)}/`;
}

/** Open the user's browser at url unless remote/suppressed. */
export function openBrowser(url) {
  if (REMOTE || process.env.ITERATOR_NO_OPEN) return;
  const opener = process.env.BROWSER
    || (process.platform === 'win32' ? 'start ""'
      : process.platform === 'darwin' ? 'open' : 'xdg-open');
  exec(`${opener} "${url}"`);
}
