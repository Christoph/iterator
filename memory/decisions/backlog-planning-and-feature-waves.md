---
type: Decision
title: Backlog planning and parallel feature waves
description: Keep low-risk backlog editing available during active work while implementing a fixed ready-feature wave and reviewing its commit-backed results together.
status: accepted
date: 2026-07-17
tags: [workflow, backlog, parallelism, review]
files: ["lib/session-server.mjs", "lib/gather.mjs", "lib/pi-tools.mjs", "lib/views/planning.mjs", "lib/views/hub.mjs", "lib/views/review.mjs", "extensions/iterator.js", "skills/iterator-implement/SKILL.md", "skills/iterator-review/SKILL.md"]
timestamp: 2026-07-17T16:12:46.582Z
---

## Outcome

The dashboard now permits filesystem-backed idea backlog CRUD while an agent turn is active, but preserves the single-model-flow guard: backlog saves must not clear the existing working state or unblock unrelated submissions.

Implementation can snapshot every dependency-ready pending feature at wave start and advance only that immutable set. Features that become ready later wait for a later wave, and completed implementation remains at `implemented` until explicit user review and acceptance.

Consolidated review derives its scope from implemented features with recorded commits and rebuilds a selectable diff for each feature independently. Every file changed by a selected feature's commits stays attributable to that feature; paths not declared by it are shown as incidental rather than omitted.

## Constraints

Readiness and review scope remain server-derived through the gather/status contracts, session-server actions retain machine-readable results, and root shared-library changes are synchronized to shipped skill copies. Dashboard controls remain responsive on narrow screens.

# Retired plan

Condensed from plan "Keep backlog planning available and support parallel feature waves" (3 features, archived under /features/archive/2026-07-17-backlog-planning-and-feature-waves/).

Token usage: 2180728 in / 29632 out / 23753216 cache-read / 0 cache-write over 171 turns (per-step breakdown in the archived usage.md).
