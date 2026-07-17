---
type: Decision
title: Parallel feature waves and consolidated review
description: The dashboard supports fixed dependency-ready implementation waves and commit-backed multi-feature review without weakening explicit acceptance.
status: accepted
date: 2026-07-17
tags: [workflow, dashboard, review, automation]
files: ["lib/gather.mjs", "lib/views/planning.mjs", "lib/views/hub.mjs", "lib/views/review.mjs", "lib/session-server.mjs", "lib/ui.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "skills/iterator-implement/SKILL.md", "skills/iterator-review/SKILL.md", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs", "test/pi-tools.test.mjs"]
timestamp: 2026-07-17T14:57:44.258Z
---

## Decision

Keep durable backlog CRUD available while an agent is working, but continue blocking actions that would start a second model flow. A ready-feature wave snapshots the server-derived pending-and-ready set at click time, implements each member independently, and never adds later-unblocked features to that wave. Pause requeues the interrupted feature and waits for its aborted turn to finish before Continue can resume it.

Review remains an explicit acceptance gate. The dashboard can open a consolidated review for implemented features with recorded commits; each feature's diff is rebuilt independently and stays selectable and attributable for findings and acceptance.

## Consequences

Browser views render server-derived readiness and review scope rather than inferring workflow state. Automated implementation may prepare work and run checks, but does not mark features done. The shared-library changes are synchronized into the shipped skill copies, and the review UI remains responsive on narrow screens.

# Retired plan

Condensed from plan "Keep backlog planning available and support parallel feature waves" (3 features, archived under /features/archive/2026-07-17-parallel-feature-waves-and-consolidated-review/).

Token usage: 6985200 in / 44878 out / 29827584 cache-read / 0 cache-write over 215 turns (per-step breakdown in the archived usage.md).
