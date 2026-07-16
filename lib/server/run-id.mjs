/**
 * Per-run id, embedded into the page (lib/ui.mjs) and echoed on /submit and
 * /cancel so a stale tab from a previous round can't act on this run. Not an
 * auth secret — purely round-matching. The session server (see
 * lib/session-server.mjs) rotates it per round via newRunId(); the one-shot
 * server keeps the initial value for its whole life.
 *
 * Own module so the mutable binding stays live through every re-export —
 * mutation happens only here.
 */
import { randomBytes } from 'node:crypto';

export let RUN_ID = randomBytes(8).toString('hex');

/** Rotate the per-run id (session server: one id per UI round). */
export function newRunId() {
  RUN_ID = randomBytes(8).toString('hex');
  return RUN_ID;
}
