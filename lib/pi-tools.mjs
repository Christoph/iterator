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
import { frontmatter } from './bundle.mjs';

/** Merge the small agent-authored extra fields over a gathered payload. */
export function mergePayload(gathered, extra) {
  return { ...gathered, ...(extra && typeof extra === 'object' ? extra : {}) };
}

/**
 * Map a hub- or knowledge-view result to the command that runs the chosen
 * flow, or null for cancel/timeout/close/anything non-actionable.
 */
export function actionToCommand(result) {
  if (!result || result.type !== 'action') return null;

  // Hub (Work tab): step flows, optionally scoped to a chunk.
  const STEPS = ['plan', 'chunk', 'test', 'implement', 'review', 'design'];
  if (STEPS.includes(result.action)) {
    const cmd = `/skill:iterator-${result.action}`;
    return result.chunk ? `${cmd} ${result.chunk}` : cmd;
  }
  // Hub: retire a finished plan (the /iterator skill owns the flow).
  if (result.action === 'retire') return '/skill:iterator retire-plan';

  // Knowledge tab: okf skills, and free-form memory actions routed to /okf.
  const OKF_SKILLS = ['okf-init', 'okf-consolidate', 'okf-memorize'];
  if (OKF_SKILLS.includes(result.action)) return `/skill:${result.action}`;
  const OKF_ACTIONS = ['draft-memory', 'draft-memory-prompt', 'update-memory', 'refresh-format'];
  if (OKF_ACTIONS.includes(result.action)) {
    const parts = [`/skill:okf ${result.action}`];
    if (result.target) parts.push(result.target);
    if (result.prompt) parts.push(`— ${result.prompt}`);
    return parts.join(' ');
  }
  return null;
}

/** Resolve the bundle dir for a working directory (mirrors loadBundle). */
export function memoryDir(startDir) {
  const memName = process.env.ITERATOR_MEMORY_DIR || 'memory';
  if (isAbsolute(memName)) return memName;
  return join(gitRoot(startDir), memName);
}

/** The git root for a working directory (walked, not spawned — hook-safe). */
export function projectRoot(startDir) {
  return gitRoot(startDir);
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

// ---------------------------------------------------------------------------
// Ambient context (before_agent_start injection)

/** Best-effort file-path tokens in a bash command (caller checks existence). */
export function extractPathsFromBash(command) {
  const out = [];
  for (const m of String(command || '').matchAll(/[\w./-]+\.\w{1,8}\b/g)) {
    const p = m[0].replace(/^\.\//, '');
    // Skip pure extensions/domains-looking tokens and obvious non-paths.
    if (!/[a-z]/i.test(p) || p.startsWith('-')) continue;
    out.push(p);
  }
  return [...new Set(out)];
}

/**
 * The one-paragraph turn context injected via before_agent_start: the flow
 * state (so the agent never re-derives it and routes mid-conversation work
 * into the chunk flow) plus the knowledge concepts anchored to recently
 * touched files. Returns null when there is nothing worth injecting.
 *
 * @param {object|null} hub        the `--step hub` payload
 * @param {object|null} implement  the `--step implement` payload
 * @param {Array<{id,title,description,ref}>} concepts  anchored concepts
 */
export function composeAmbientContext(hub, implement, concepts = []) {
  const lines = [];
  if (hub?.plan) {
    const p = hub.progress || {};
    const red = (hub.chunks || []).filter(c => c.testsStatus === 'red').map(c => c.name);
    const parts = [
      `Plan "${hub.plan.title}" — ${p.done ?? 0}/${p.total ?? 0} chunks done`,
      `next ready: ${implement?.next?.name || 'none'}`,
    ];
    if (red.length) parts.push(`tests red: ${red.join(', ')}`);
    lines.push(`iterator: ${parts.join(' · ')}. Route new implementation work through the chunk flow (/iterator-implement or the iterator tools), not ad-hoc edits.`);
  }
  if (concepts.length) {
    lines.push('Knowledge anchored to recently touched files (read the concept before editing further):');
    for (const c of concepts) {
      lines.push(`- [${c.id}] ${c.title} — ${c.description}${c.ref ? ` (${c.ref})` : ''}`);
    }
  }
  return lines.length ? lines.join('\n') : null;
}

// ---------------------------------------------------------------------------
// Footer status + memorize nudge

/**
 * The footer segment text (ctx.ui.setStatus renders it — pi's footer and
 * pi-powerline-footer both show extension statuses), e.g.
 * `⛭ 3/7 · next: auth-middleware · 🔴 1 red · 🧠 4 unmemorized`.
 * Returns null when there is nothing to show (clears the segment).
 */
export function footerText(hub, implement, pendingCount = 0) {
  const segs = [];
  if (hub?.plan) {
    const p = hub.progress || {};
    segs.push(`⛭ ${p.done ?? 0}/${p.total ?? 0}`);
    if (implement?.next?.name) segs.push(`next: ${implement.next.name}`);
    const red = (hub.chunks || []).filter(c => c.testsStatus === 'red').length;
    if (red) segs.push(`🔴 ${red} red`);
  }
  if (pendingCount > 0) segs.push(`🧠 ${pendingCount} unmemorized`);
  return segs.length ? segs.join(' · ') : null;
}

/**
 * Nudge toward /okf-memorize at most once per threshold-multiple: fire when
 * the unmemorized count reaches the threshold AND has grown a full threshold
 * past the last nudge (never per-commit nagging). threshold <= 0 disables.
 */
export function shouldNudge(pendingCount, lastNudgedAt, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  return pendingCount >= threshold && pendingCount >= lastNudgedAt + threshold;
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
