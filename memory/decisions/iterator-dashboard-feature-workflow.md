---
type: Decision
title: Unify Iterator dashboard and feature workflow
description: Iterator’s dashboard uses explicit operation state and consistent iterator/features terminology so active work and navigation remain unambiguous.
status: accepted
date: 2026-07-15
tags:
  - dashboard
  - workflow
  - backlog
  - migration
  - ui
files:
  - package.json
  - README.md
  - CONTRIBUTING.md
  - skills/iterator-*
  - lib/session-server.mjs
  - lib/ui.mjs
  - lib/views/hub.mjs
  - lib/views/knowledge.mjs
  - lib/views/plan.mjs
  - lib/views/feature.mjs
  - lib/views/review.mjs
  - lib/views/settings.mjs
  - test/session-server.test.mjs
  - test/ui.test.mjs
  - test/knowledge-controls.test.mjs
  - lib/bundle.mjs
  - lib/gather.mjs
  - lib/write.mjs
  - extensions/iterator.js
  - test/bundle.test.mjs
  - test/gather.test.mjs
  - test/write.test.mjs
timestamp: 2026-07-16T11:27:44.913Z
---

## Context

Iterator’s dashboard and feature workflow had accumulated mixed `lr`/`chunk` terminology and broad action payloads. That made state ownership, navigation, and plan creation harder to reason about.

## Decision

Use a state-driven dashboard and scoped action protocol. Actions submit only the fields they own, while operation lifecycle state drives contextual controls and Work/Knowledge activity badges. Keep Knowledge as a persistent destination without a Close control; retain Settings close as navigation.

Standardize the plugin on `iterator` and `features` terminology across commands, documentation, paths, UI, and persisted records. Treat the rename as an explicit breaking migration for existing `CHUNKS.md`-based data rather than silently preserving legacy aliases.

## Consequences

The browser never hand-writes workflow records, and active plan graphs remain focused on implementation work. Existing persisted plans require the supported migration path.

# Retired plan

Condensed from plan "Unify Iterator dashboard and feature workflow" (3 features, archived under /features/archive/2026-07-15-iterator-dashboard-feature-workflow/).
