/**
 * iterator: helpers behind the pi extension's tools (extensions/iterator.js).
 *
 * Every decision the extension makes lives here as a pure/deterministic
 * function so it is testable without a pi runtime — the extension body is
 * glue only. The gather/write scripts are spawned as CLIs (not imported):
 * that keeps the pi path byte-identical to the bash path the skills use,
 * including their validation and exit-code behavior.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter } from '../skills/iterator/gather.mjs';

/** Merge the small agent-authored extra fields over a gathered payload. */
export function mergePayload(gathered, extra) {
  return { ...gathered, ...(extra && typeof extra === 'object' ? extra : {}) };
}

/**
 * Map a hub-view result to the command that runs the chosen flow, or null
 * for cancel/timeout/anything non-actionable.
 */
export function actionToCommand(result) {
  if (!result || result.type !== 'action') return null;
  const KNOWN = ['plan', 'chunk', 'test', 'implement', 'review'];
  if (!KNOWN.includes(result.action)) return null;
  const cmd = result.action === 'plan' ? '/skill:iterator-plan'
    : result.action === 'chunk' ? '/skill:iterator-chunk'
      : `/skill:iterator-${result.action}`;
  return result.chunk ? `${cmd} ${result.chunk}` : cmd;
}

/** Resolve the bundle dir for a working directory (mirrors loadBundle). */
export function memoryDir(startDir) {
  const memName = process.env.ITERATOR_MEMORY_DIR || 'memory';
  if (isAbsolute(memName)) return memName;
  return join(gitRoot(startDir), memName);
}

function gitRoot(startDir) {
  let dir = startDir || process.cwd();
  // Walk up to the git root without spawning git (cheap, hook-safe).
  while (!existsSync(join(dir, '.git'))) {
    const parent = join(dir, '..');
    if (parent === dir) return startDir || process.cwd();
    dir = parent;
  }
  return dir;
}

/** Does a bundle exist (plan or chunks) for this working directory? */
export function bundleExists(startDir) {
  const mem = memoryDir(startDir);
  return existsSync(join(mem, 'plan.md')) || existsSync(join(mem, 'chunks'));
}

/** Absolute path of a hub-skill script (gather|write|server). */
export function scriptPath(name) {
  return fileURLToPath(new URL(`../skills/iterator/${name}.mjs`, import.meta.url));
}

/**
 * Spawn a hub script the way the skills do.
 * @returns {Promise<{code, stdout, stderr}>} never rejects on non-zero exit.
 */
export function runScript(script, args = [], { cwd, stdin } = {}) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [script, ...args],
      { cwd, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }));
    if (stdin != null) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

/** Run a script that prints one JSON line; throws a readable error if not. */
export async function runJson(script, args, opts) {
  const { code, stdout, stderr } = await runScript(script, args, opts);
  let parsed = null;
  try { parsed = JSON.parse(stdout.trim().split('\n').pop() || ''); } catch {}
  if (parsed == null) {
    throw new Error((stderr || stdout || `exit ${code}`).trim());
  }
  if (code !== 0 || parsed.ok === false) {
    throw new Error(parsed.error || (stderr || `exit ${code}`).trim());
  }
  return parsed;
}

/** Chunk frontmatter entries for the guardrails ({slug, fm} per chunk). */
export function chunksDirEntries(startDir) {
  const dir = join(memoryDir(startDir), 'chunks');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    try {
      out.push({ slug: f.slice(0, -3), fm: frontmatter(readFileSync(join(dir, f), 'utf8')) });
    } catch {}
  }
  return out;
}
