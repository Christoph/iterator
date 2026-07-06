#!/usr/bin/env node
/**
 * iterator: the one UI server for the whole flow — the browser control plane.
 *
 * Every step skill is logic-only; whenever a step needs the user (dashboard
 * action, plan review, chunk breakdown, test plan, diff review) it pipes a
 * JSON payload into THIS server (a sibling skill folder) and reads one JSON
 * line back. The view is chosen by payload.step:
 *
 *   hub    — dashboard home screen (default)
 *   plan   — plan review                      (/iterator-plan)
 *   chunk  — chunk breakdown w/ graph         (/iterator-chunk)
 *   test   — per-chunk test plan              (/iterator-test)
 *   review — chunk-grouped diff review        (/iterator-review, and
 *            /iterator-implement via mode:"commit")
 *
 * The server is single-instance on a fixed port (default 7777): a lingering
 * server from an earlier run is shut down and replaced (see lib/server.mjs),
 * so the dashboard URL never drifts — which is what lets a sandbox forward
 * exactly one port (pi-docker-sandbox-setup publishes 7777).
 *
 * Payload/output contracts per view are documented in lib/views/<step>.mjs.
 */
import { readPayload, serve } from './lib/server.mjs';
import { render as hub } from './lib/views/hub.mjs';
import { render as plan } from './lib/views/plan.mjs';
import { render as chunk } from './lib/views/chunk.mjs';
import { render as test } from './lib/views/test.mjs';
import { render as review } from './lib/views/review.mjs';

const VIEWS = { hub, plan, chunk, test, review };

const data = await readPayload();
// Older review payloads carry mode:"commit" instead of a step field.
const step = VIEWS[data.step] ? data.step : (data.mode === 'commit' ? 'review' : 'hub');
serve({ step, html: VIEWS[step](data) });
