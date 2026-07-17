---
type: Decision
title: Unify Iterator dashboard and feature workflow
description: Dashboard workflows keep backlog candidates separate from active work until selected candidates are consumed by approved plan creation.
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
timestamp: "2026-07-17T13:53:47.909Z"
---

## Context

Iterator’s dashboard and feature workflow use scoped actions and deterministic writer operations to keep active work unambiguous.

## Decision

Keep saved backlog candidates separate from active plan features. A candidate selected for planning is consumed from the backlog only when the deterministic plan operation writes an approved plan; draft writes and non-approval review outcomes retain it. The writer reports the consumed candidate IDs and regenerates the backlog index in the same operation.

## Consequences

The Planning backlog shows only candidates that have not entered approved planning work. Browser selection remains intent only; it never directly mutates workflow records.

# Retired plan

Condensed from plan "Unify Iterator dashboard and feature workflow" (3 features, archived under /features/archive/2026-07-15-iterator-dashboard-feature-workflow/).
