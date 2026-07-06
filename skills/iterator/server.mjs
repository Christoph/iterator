#!/usr/bin/env node
/**
 * iterator: the one UI server for the whole flow — the browser control plane.
 *
 * Every step skill is logic-only; whenever a step needs the user (dashboard
 * action, plan review, chunk breakdown, test plan, diff review, memory
 * review) it pipes a JSON payload into THIS server (a sibling skill folder)
 * and reads one JSON line back. The view is chosen by payload.step:
 *
 *   hub           — dashboard home screen (default)
 *   plan          — plan review                      (/iterator-plan)
 *   chunk         — chunk breakdown w/ graph         (/iterator-chunk)
 *   test          — per-chunk test plan              (/iterator-test)
 *   review        — chunk-grouped diff review        (/iterator-review, and
 *                   /iterator-implement via mode:"commit")
 *   knowledge     — okf memory plane                 (/okf)
 *   memory-review — memory card review               (/okf-init,
 *                   /okf-consolidate, /okf-memorize)
 *
 * The server is single-instance on a fixed port (default 7777): a lingering
 * server from an earlier run is shut down and replaced (see lib/server.mjs),
 * so the dashboard URL never drifts — which is what lets a sandbox forward
 * exactly one port (pi-docker-sandbox-setup publishes 7777).
 *
 * Payload/output contracts per view are documented in lib/views/<step>.mjs.
 *
 * memory-review with `apply: true`: a review-approved answer is applied by
 * the sibling deterministic writer (write.mjs op apply-review) before the
 * result reaches the agent — the printed line gains `applied` (the writer's
 * result, or { ok:false, error } on failure). Feedback/cancel/timeout pass
 * through untouched; so does everything when `apply` is absent.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPayload, serve } from './lib/server.mjs';
import { render as hub } from './lib/views/hub.mjs';
import { render as plan } from './lib/views/plan.mjs';
import { render as chunk } from './lib/views/chunk.mjs';
import { render as test } from './lib/views/test.mjs';
import { render as review } from './lib/views/review.mjs';
import { render as knowledge } from './lib/views/knowledge.mjs';
import { render as memoryReview } from './lib/views/memory-review.mjs';

const VIEWS = { hub, plan, chunk, test, review, knowledge, 'memory-review': memoryReview };

const data = await readPayload();
// Older review payloads carry mode:"commit" instead of a step field.
const step = VIEWS[data.step] ? data.step : (data.mode === 'commit' ? 'review' : 'hub');

const WRITE = fileURLToPath(new URL('./write.mjs', import.meta.url));

async function onSubmit(result) {
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
      [WRITE, ...(data.project ? [data.project] : [])],
      { encoding: 'utf8' },
      (err, stdout, stderr) => resolve({ err, stdout, stderr }),
    );
    child.stdin.end(JSON.stringify(payload));
  });
  let applied = null;
  try { applied = JSON.parse(out.stdout.trim().split('\n').pop()); } catch {}
  return {
    ...result,
    applied: applied || {
      ok: false,
      error: String(out.stderr || 'writer produced no result').trim(),
    },
  };
}

serve({
  step,
  html: VIEWS[step](data),
  onSubmit: step === 'memory-review' ? onSubmit : undefined,
});
