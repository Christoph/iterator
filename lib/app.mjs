/**
 * iterator: the one UI server for the whole flow — the browser control plane.
 *
 * Every step skill is logic-only; whenever a step needs the user (dashboard
 * action, plan review, feature breakdown, test plan, diff review, memory
 * review) it pipes a JSON payload into the server shim (a sibling skill
 * folder) and reads one JSON line back. The view is chosen by payload.step:
 *
 *   hub           — dashboard home screen (default)
 *   plan          — plan review                      (/iterator-plan)
 *   feature         — feature breakdown w/ graph         (/iterator-feature)
 *   test          — per-feature test plan              (/iterator-test)
 *   review        — feature-grouped diff review        (/iterator-review, and
 *                   /iterator-implement via mode:"commit")
 *   knowledge     — OKF memory plane                 (/iterator-knowledge)
 *   memory-review — memory card review               (/iterator-init,
 *                   /iterator-consolidate, /iterator-memorize)
 *
 * The server is single-instance on a fixed port (default 7777): a lingering
 * server from an earlier run is shut down and replaced (see server.mjs), so
 * the dashboard URL never drifts — which is what lets a sandbox forward
 * exactly one port (pi-docker-sandbox-setup publishes 7777).
 *
 * Payload/output contracts per view are documented in views/<step>.mjs.
 *
 * memory-review with `apply: true`: a review-approved answer is applied by
 * the sibling deterministic writer (write.mjs op apply-review) before the
 * result reaches the agent — the printed line gains `applied` (the writer's
 * result, or { ok:false, error } on failure). Feedback/cancel/timeout pass
 * through untouched; so does everything when `apply` is absent.
 */
import { execFile } from 'node:child_process';
import { readPayload, serve } from './server.mjs';
import {
  gather, gatherArchive, gatherFeature, gatherKnowledge, gatherPlan,
  gatherReview, gatherSettings, gatherTest, gatherUsage,
} from './gather.mjs';
import { render as hub } from './views/hub.mjs';
import { render as plan } from './views/plan.mjs';
import { render as feature } from './views/feature.mjs';
import { render as test } from './views/test.mjs';
import { render as review } from './views/review.mjs';
import { render as knowledge } from './views/knowledge.mjs';
import { render as memoryReview } from './views/memory-review.mjs';
import { render as settings } from './views/settings.mjs';
import { render as question } from './views/question.mjs';
import { render as usage } from './views/usage.mjs';
import { render as archive } from './views/archive.mjs';

const VIEWS = { hub, plan, feature, test, review, knowledge, 'memory-review': memoryReview, settings, question, usage, archive };

// One-command request form: `{ "gather": true, step, feature?, project?, extra? }`
// makes the server gather the step payload itself (in-process — the cores
// live in this lib/) and merge the small agent-authored `extra` over it, so
// the bash path needs no gather|server pipe composition. Mirrors iterator_ui.
const GATHERS = {
  hub: (o) => gather(o.project),
  plan: (o) => gatherPlan(o.project),
  feature: (o) => gatherFeature(o.project),
  test: (o) => gatherTest(o.project, o.feature),
  review: (o) => gatherReview(o.project, { feature: o.feature }),
  knowledge: (o) => gatherKnowledge(o.project),
  settings: (o) => gatherSettings(o.project),
  usage: (o) => gatherUsage(o.project),
  archive: (o) => gatherArchive(o.project, o.feature),
  'memory-review': (o) => {
    const k = gatherKnowledge(o.project);
    return {
      step: 'memory-review',
      branch: k.branch,
      project: k.project,
      bundlePath: k.bundlePath,
      areas: k.areas,
    };
  },
};

// Human-facing cancel/timeout summaries per step — the server attaches them
// as `report`; the skill's only job is to relay the string and stop.
const CANCEL_REPORTS = {
  hub: 'User closed the dashboard without choosing an action. Stop.',
  plan: 'User cancelled the plan review. Write nothing and stop this flow.',
  feature: 'User cancelled the feature review. Draft features stay on disk as drafts (visible on the hub, not implementable). Write nothing else and stop.',
  test: 'User cancelled the test plan review. Write nothing and stop this flow.',
  review: 'User cancelled the review. Record nothing and stop this flow.',
  knowledge: 'User closed the Knowledge view without choosing an action. Stop.',
  settings: 'User closed the settings view without saving. Change nothing and stop.',
  question: 'User closed the question without answering. Ask in the terminal (AskUserQuestion) or stop.',
  usage: 'User closed the usage view. Stop.',
  archive: 'User closed the retired-plan view. Stop.',
  'memory-review': 'User cancelled the memory review. Nothing was written and last_memorized_commit did not advance. Stop this flow.',
};

/** Which skill a hub/knowledge action result dispatches into. */
function actionSkill(result) {
  if (!result || result.type !== 'action') return null;
  const STEPS = ['plan', 'feature', 'test', 'implement', 'review', 'design'];
  if (STEPS.includes(result.action)) return `iterator-${result.action}`;
  if (result.action === 'retire') return 'iterator';
  // Hub navigation targets owned by the /iterator hub skill.
  if (result.action === 'view-archive' || result.action === 'hub') return 'iterator';
  // Auto mode needs the pi driver; the bash path degrades to plain implement.
  if (result.action === 'auto-implement') return 'iterator-implement';
  if (['iterator-init', 'iterator-consolidate', 'iterator-memorize'].includes(result.action)) {
    return result.action;
  }
  const OKF_ACTIONS = ['draft-memory', 'draft-memory-prompt', 'update-memory', 'refresh-format'];
  if (OKF_ACTIONS.includes(result.action)) return 'iterator-knowledge';
  return null;
}

/** One human-readable line summarizing an apply-review writer outcome. */
function appliedSummary(applied) {
  if (!applied) return null;
  if (applied.ok === false) return `apply failed: ${applied.error}`;
  const parts = [
    applied.written?.length ? `${applied.written.length} written` : null,
    applied.deleted?.length ? `${applied.deleted.length} deleted` : null,
    applied.kept ? `${applied.kept} kept` : null,
    applied.rejected ? `${applied.rejected} rejected` : null,
    applied.advancedTo ? `pointer → ${String(applied.advancedTo).slice(0, 7)}` : null,
  ].filter(Boolean);
  const base = parts.length ? parts.join(', ') : 'no changes';
  return applied.validation && applied.validation.ok === false
    ? `${base}; VALIDATION FAILED: ${applied.validation.errors.join('; ')}`
    : base;
}

/**
 * Run the one-shot UI server for a stdin payload.
 * `writeScript` is the absolute path of the spawnable writer (the shim next
 * to the calling server.mjs), so a dropped skill folder applies reviews
 * through its own copy.
 */
export async function main({ writeScript }) {
  let data = await readPayload();
  if (data && data.gather === true && GATHERS[data.step]) {
    const gathered = GATHERS[data.step](data);
    data = {
      ...gathered,
      ...(data.extra && typeof data.extra === 'object' ? data.extra : {}),
      ...(data.project ? { project: data.project } : {}),
    };
  }
  // Older review payloads carry mode:"commit" instead of a step field.
  const step = VIEWS[data.step] ? data.step : (data.mode === 'commit' ? 'review' : 'hub');

  // Deterministic zero-change guard: a review with nothing to show never
  // opens the browser — print the structured refusal and exit (issue: a
  // review with zero changes must be impossible, in code, not prose).
  if (step === 'review' && data.hasChanges === false) {
    process.stdout.write(`${JSON.stringify({
      type: 'no-changes',
      report: 'Nothing to review — the chosen scope has no diff and no recorded commits. Relay the progress summary instead of opening a review.',
      progress: data.progress || null,
    })}\n`);
    return;
  }

  async function onSubmit(result) {
    // Server-side dispatch: an action result names the skill that owns the
    // chosen flow, so SKILL.mds don't carry the action→skill table.
    const skill = actionSkill(result);
    if (skill) return { ...result, skill };
    if (data.apply !== true || result?.type !== 'review-approved') return result;
    const payload = {
      op: 'apply-review',
      mode: data.mode,
      bundlePath: data.bundlePath || undefined,
      headCommit: data.headCommit || null,
      memories: Array.isArray(data.memories) ? data.memories : [],
      decisions: result.decisions,
    };
    const out = await new Promise((resolve) => {
      const child = execFile(
        process.execPath,
        [writeScript, ...(data.project ? [data.project] : [])],
        { encoding: 'utf8' },
        (err, stdout, stderr) => resolve({ err, stdout, stderr }),
      );
      child.stdin.end(JSON.stringify(payload));
    });
    let applied = null;
    try { applied = JSON.parse(out.stdout.trim().split('\n').pop()); } catch {}
    applied = applied || {
      ok: false,
      error: String(out.stderr || 'writer produced no result').trim(),
    };
    const summary = appliedSummary(applied);
    return {
      ...result,
      applied: summary ? { ...applied, summary } : applied,
    };
  }

  serve({
    step,
    html: VIEWS[step](data),
    onSubmit,
    reports: {
      cancel: CANCEL_REPORTS[step],
      timeout: `${CANCEL_REPORTS[step] || 'Stop this flow.'} (The review timed out after 2h idle.)`,
    },
  });
}
