/**
 * Single-instance port takeover (the F9 machinery — see server.mjs header).
 * Moved verbatim out of server.mjs; behavior unchanged:
 *   - registryPath(): the per-user file recording the listening UI server.
 *   - takeoverStale(): SIGTERM a lingering one-shot recorded there (never a
 *     session dashboard — that pid is the agent itself).
 *   - reclaimPort(): under force-port mode, evict whatever holds the one
 *     published port (identified iterator one-shots politely; foreign
 *     holders via lsof/fuser, SIGTERM→SIGKILL, never self/parent).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { STATUS_PATH } from './env.mjs';

/** Registry file recording the currently-listening UI server for this user. */
export function registryPath() {
  if (process.env.ITERATOR_REGISTRY) return process.env.ITERATOR_REGISTRY;
  let uid = 'u';
  try { uid = String(userInfo().uid); } catch {}
  return join(tmpdir(), `iterator-ui-${uid}.json`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
