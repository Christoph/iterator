---
type: Decision
title: Unify Iterator dashboard and feature workflow
description: Iterator’s dashboard now uses explicit operation state, a separate durable backlog, and consistent iterator/features terminology so active work, navigation, and future planning remain unambiguous.
status: accepted
date: 2026-07-15
tags: [dashboard, workflow, backlog, migration, ui]
files: ["package.json", "README.md", "ARCHITECTURE.md", "CONTRIBUTING.md", "PLAN.md", "CHUNKS.md", "FEATURES.md", "skills/lr-*", "skills/iterator-*", "test.md", "lib/session-server.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/views/knowledge.mjs", "lib/views/plan.mjs", "lib/views/feature.mjs", "lib/views/review.mjs", "lib/views/settings.mjs", "test/session-server.test.mjs", "test/ui.test.mjs", "test/knowledge-controls.test.mjs", "lib/bundle.mjs", "lib/gather.mjs", "lib/write.mjs", "extensions/iterator.js", "memory/backlog/index.md", "test/bundle.test.mjs", "test/gather.test.mjs", "test/write.test.mjs"]
timestamp: 2026-07-15T12:49:20.327Z
---

## Context

Iterator’s dashboard and feature workflow had accumulated mixed `lr`/`chunk` terminology, broad action payloads, and no durable place to capture ideas outside the active plan. That made state ownership, navigation, and plan creation harder to reason about.

## Decision

Use a state-driven dashboard and scoped action protocol. Actions submit only the fields they own, while operation lifecycle state drives contextual controls and Work/Knowledge activity badges. Keep Knowledge as a persistent destination without a Close control; retain Settings close as navigation.

Store deferred ideas and bugs in a dedicated indexed OKF backlog rather than active plan features. Backlog writes are validated deterministic server-side writer operations, and selected candidates seed later plan creation without obscuring active feature status or dependencies.

Standardize the plugin on `iterator` and `features` terminology across commands, documentation, paths, UI, and persisted records. Treat the rename as an explicit breaking migration for existing `CHUNKS.md`-based data rather than silently preserving legacy aliases.

## Consequences

The browser never hand-writes workflow records, active plan graphs remain focused on implementation work, and future plans can be formed from durable backlog candidates. Existing persisted plans require the supported migration path.

# Retired plan

Condensed from plan "Unify Iterator dashboard and feature workflow" (3 features, archived under /features/archive/2026-07-15-iterator-dashboard-feature-workflow/).

Token usage: 4302064 in / 62638 out / 29949440 cache-read / 0 cache-write over 222 turns (per-step breakdown in the archived usage.md).
