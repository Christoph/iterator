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

  // Hub (Work tab): step flows, optionally scoped to a feature. A typed plan
  // goal from the hero rides along so /iterator-plan can skip its questions.
  const STEPS = ['plan', 'feature', 'test', 'implement', 'review', 'design'];
  if (STEPS.includes(result.action)) {
    const parts = [`/skill:iterator-${result.action}`];
    if (result.feature) parts.push(result.feature);
    if (result.prompt) parts.push(`— ${result.prompt}`);
    return parts.join(' ');
  }
  // Hub: retire a finished plan (the /iterator skill owns the flow).
  if (result.action === 'retire') return '/skill:iterator retire-plan';

  // Knowledge tab: knowledge skills, and free-form memory actions routed to /iterator-knowledge.
  // iterator-init from the hub hero may carry a stashed plan goal: initialize,
  // then continue straight into planning with it.
  const OKF_SKILLS = ['iterator-init', 'iterator-consolidate', 'iterator-memorize'];
  if (OKF_SKILLS.includes(result.action)) {
    const cmd = `/skill:${result.action}`;
    return result.prompt
      ? `${cmd} — when initialization finishes, continue into /skill:iterator-plan — ${result.prompt}`
      : cmd;
  }
  const OKF_ACTIONS = ['draft-memory', 'draft-memory-prompt', 'update-memory', 'refresh-format'];
  if (OKF_ACTIONS.includes(result.action)) {
    const parts = [`/skill:iterator-knowledge ${result.action}`];
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

/** Does a bundle exist (plan or features) for this working directory? */
export function bundleExists(startDir) {
  const mem = memoryDir(startDir);
  return existsSync(join(mem, 'plan.md')) || existsSync(join(mem, 'features'));
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
 * into the feature flow) plus the knowledge concepts anchored to recently
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
    const red = (hub.features || []).filter(c => c.testsStatus === 'red').map(c => c.name);
    const parts = [
      `Plan "${hub.plan.title}" — ${p.done ?? 0}/${p.total ?? 0} features done`,
      `next ready: ${implement?.next?.name || 'none'}`,
    ];
    if (red.length) parts.push(`tests red: ${red.join(', ')}`);
    lines.push(`iterator: ${parts.join(' · ')}. Route new implementation work through the feature flow (/iterator-implement or the iterator tools), not ad-hoc edits.`);
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
// Auto mode: the deterministic driver core. All decisions live here as a
// pure function over (session payload, settings, state) so the loop is
// exhaustively testable without a pi runtime; the extension body only
// dispatches what this returns.

export const AUTO_PHASE_FOR_STEP = {
  test: 'testing',
  implement: 'implementing',
  review: 'reviewing',
};

/**
 * The next auto-mode action, or a terminal outcome:
 *   { step, role, feature, cmd, strike? }  — dispatch cmd as a role turn;
 *                                          strike = feature whose needs-work
 *                                          counter must be incremented first
 *   { escalate: true, reason, feature? }   — stop, pause, hand to the human
 *   { done: true }                       — every feature landed
 *   null                                 — auto mode is not (or no longer) driving
 *
 * Verdict rule: a dispatched agent review either drove accept-commit (feature
 * status flips to done) or it didn't — the bundle state IS the verdict; no
 * text parsing.
 */
export function nextAutoAction(sessionPayload, settings, state) {
  const hub = sessionPayload?.hub;
  const imp = sessionPayload?.implement;
  if (!hub?.plan || state?.mode !== 'auto' || state?.paused) return null;
  const max = settings?.max_review_iterations ?? 3;
  const strikes = state.strikes || {};

  // A review round just came back: done = approved+committed; anything else
  // is a needs-work round → strike, then re-implement with the reviewer's
  // notes (they live in the feature's # Review section).
  if (state.phase === 'reviewing' && state.active_feature) {
    const ch = (hub.features || []).find(c => c.name === state.active_feature);
    if (ch && ch.status !== 'done') {
      const count = (strikes[state.active_feature] || 0) + 1;
      if (count >= max) {
        return {
          escalate: true,
          feature: state.active_feature,
          reason: `feature '${state.active_feature}' failed agent review ${count} time(s) — human intervention needed`,
        };
      }
      return {
        step: 'implement',
        role: 'implementer',
        feature: state.active_feature,
        strike: state.active_feature,
        cmd: `/skill:iterator-implement ${state.active_feature} --auto`,
      };
    }
  }

  const next = imp?.next || null;
  const p = hub.progress || {};
  if (!next) {
    if (p.total > 0 && p.done === p.total) return { done: true };
    if (imp?.drafts?.length) {
      return { escalate: true, reason: 'only draft features exist — accept the feature set first (/iterator-feature)' };
    }
    if (imp?.stuck) {
      return { escalate: true, reason: 'pending features remain but none is ready — dependency cycle or missing dependency' };
    }
    return { done: true };
  }
  if ((next.conflicts || []).length) {
    return {
      escalate: true,
      feature: next.name,
      reason: `feature '${next.name}' conflicts with recorded decisions (${next.conflicts.map(x => x.decision).join(', ')}) — resolve before implementing`,
    };
  }
  if ((strikes[next.name] || 0) >= max) {
    return {
      escalate: true,
      feature: next.name,
      reason: `feature '${next.name}' already failed review ${strikes[next.name]} time(s)`,
    };
  }

  if (settings?.testing_default === 'on' && (next.testsStatus || 'none') === 'none') {
    return { step: 'test', role: 'tester', feature: next.name, cmd: `/skill:iterator-test ${next.name} --auto` };
  }
  // An implementation diff exists → it is review time; otherwise implement.
  const hubFeature = (hub.features || []).find(c => c.name === next.name);
  if (hubFeature?.hasDiff) {
    return { step: 'review', role: 'reviewer', feature: next.name, cmd: `/skill:iterator-review ${next.name} --agent` };
  }
  return { step: 'implement', role: 'implementer', feature: next.name, cmd: `/skill:iterator-implement ${next.name} --auto` };
}

/**
 * The model/thinking overrides for a role turn: null fields mean "leave the
 * session as-is" ('active'). The extension resolves the model string against
 * ctx.modelRegistry and applies pi.setModel/pi.setThinkingLevel.
 */
export function roleModelSpec(settings, role) {
  const model = settings?.[`${role}_model`];
  const thinking = settings?.[`${role}_thinking`];
  return {
    model: model && model !== 'active' ? String(model) : null,
    thinking: thinking && thinking !== 'active' ? String(thinking) : null,
  };
}

// ---------------------------------------------------------------------------
// Token-usage attribution (pi turn_end capture → usage op rows)

const ATTRIBUTION_MAP = {
  'iterator-plan': 'plan',
  'iterator-feature': 'feature',
  'iterator-test': 'test',
  'iterator-implement': 'implement',
  'iterator-review': 'review',
  'iterator-design': 'design',
  'iterator-next': 'implement',
  iterator: 'hub',
  'iterator-knowledge': 'memory',
  'iterator-init': 'memory',
  'iterator-consolidate': 'memory',
  'iterator-memorize': 'memory',
};

/**
 * Which ledger step (and feature) a turn belongs to, parsed from the user
 * input that started it (`/iterator-implement auth`, `/skill:iterator-memorize`).
 * Returns null when the input is not an iterator/iterator-knowledge command — the previous
 * attribution keeps applying until the flow visibly changes.
 */
export function attributionFromInput(text) {
  const m = String(text || '').trim().match(/^\/(?:skill:)?([a-z-]+)(?:\s+([A-Za-z0-9._/-]+))?/);
  if (!m || !ATTRIBUTION_MAP[m[1]]) return null;
  const feature = m[2] && /^[a-z0-9][a-z0-9-]*$/.test(m[2]) ? m[2] : null;
  return { step: ATTRIBUTION_MAP[m[1]], feature };
}

/**
 * One usage-op row from a turn_end assistant message, attributed to the
 * current flow step; null for non-assistant turns or messages without usage.
 */
export function usageRowFromMessage(message, attribution) {
  if (!message || message.role !== 'assistant' || !message.usage) return null;
  const u = message.usage;
  return {
    step: attribution?.step || 'other',
    ...(attribution?.feature ? { feature: attribution.feature } : {}),
    provider: String(message.provider || 'unknown'),
    model: String(message.model || 'unknown'),
    input: u.input || 0,
    output: u.output || 0,
    cacheRead: u.cacheRead || 0,
    cacheWrite: u.cacheWrite || 0,
  };
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
    const red = (hub.features || []).filter(c => c.testsStatus === 'red').length;
    if (red) segs.push(`🔴 ${red} red`);
    if (hub.dirty?.count) segs.push(`⚠ ${hub.dirty.count} uncommitted`);
  }
  if (pendingCount > 0) segs.push(`🧠 ${pendingCount} unmemorized`);
  return segs.length ? segs.join(' · ') : null;
}

/**
 * Nudge toward /iterator-memorize at most once per threshold-multiple: fire when
 * the unmemorized count reaches the threshold AND has grown a full threshold
 * past the last nudge (never per-commit nagging). threshold <= 0 disables.
 */
export function shouldNudge(pendingCount, lastNudgedAt, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  return pendingCount >= threshold && pendingCount >= lastNudgedAt + threshold;
}

/** Feature frontmatter entries for the guardrails ({slug, fm} per feature). */
export function featuresDirEntries(startDir) {
  const dir = join(memoryDir(startDir), 'features');
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
