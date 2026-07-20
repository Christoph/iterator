---
type: Decision
title: Work owns active plan context and lifecycle
description: Keep active-plan progress, execution, and lifecycle controls on Work while Planning is reserved for staged future work and archives.
status: accepted
date: 2026-07-20
tags: [workflow, review, dashboard, navigation]
files: ["lib/session-server.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/views/planning.mjs", "lib/views/graph.mjs", "lib/views/review.mjs", "test/session-server.test.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs", "extensions/iterator.js"]
timestamp: "2026-07-20T14:19:10.566Z"
---

## Decision

The persistent session shell, not its replaceable iframe views, owns unload cancellation. Switching between Planning and Work must preserve a pending review round and its single eventual result; an explicit cancel still pre-empts any pending reload-grace timer.

Work is the home for every active-plan concern: progress, dependency graph, feature cards, execution controls, revise/re-feature, whole-plan review, retirement, plan cancellation, and feature cancellation. Planning is the staging surface for future plans, backlog collection, and retired-plan browsing; when a plan is active it directs users to Work instead of duplicating lifecycle controls. Both surfaces render the same server-derived gather data and never reconstruct readiness or lifecycle state locally.

Approved plans and accepted feature sets intentionally activate Work. Ordinary refreshes preserve the user's selected tab, so dashboard navigation and pending rounds remain stable.

The review sidebar and detail headings wrap long feature names rather than clipping them. The obsolete lower-right Feedback panel and JSON-preview bookkeeping are removed; feature verdicts, notes, and line comments continue to drive the existing header submission flow.

## Constraints

Dashboard navigation must not weaken the single-model-flow guard or backlog-write allowance. Changes to root `lib/` are synchronized into shipped skill copies, and inline view scripts retain parse coverage.
