---
type: Decision
title: Review navigation and Work context
description: Keep interactive reviews stable across dashboard navigation, make Work the active feature surface, and simplify review controls without weakening the review gate.
status: accepted
date: 2026-07-17
tags: [workflow, review, dashboard, navigation]
files: ["lib/session-server.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/views/planning.mjs", "lib/views/graph.mjs", "lib/views/review.mjs", "test/session-server.test.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
timestamp: 2026-07-17T16:38:22.809Z
---

## Decision

The persistent session shell, not its replaceable iframe views, owns unload cancellation. Switching between Planning and Work must preserve a pending review round and its single eventual result; an explicit cancel still pre-empts any pending reload-grace timer.

Work is the home for an active plan's progress, dependency graph, feature cards, execution controls, and feature cancellation. Planning remains focused on backlog collection and plan lifecycle actions. Both surfaces render the same server-derived gather data and never reconstruct readiness or lifecycle state locally.

The review sidebar and detail headings wrap long feature names rather than clipping them. The obsolete lower-right Feedback panel and JSON-preview bookkeeping are removed; feature verdicts, notes, and line comments continue to drive the existing header submission flow.

## Constraints

Dashboard navigation must not weaken the single-model-flow guard or backlog-write allowance. Changes to root `lib/` are synchronized into shipped skill copies, and inline view scripts retain parse coverage.

# Retired plan

Condensed from plan "Keep active review stable and clarify Planning versus Work" (3 features, archived under /features/archive/2026-07-17-review-navigation-and-work-context/).

Token usage: 817664 in / 25689 out / 13951488 cache-read / 0 cache-write over 113 turns (per-step breakdown in the archived usage.md).
