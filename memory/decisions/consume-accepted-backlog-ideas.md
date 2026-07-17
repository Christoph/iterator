---
type: Decision
title: Consume selected backlog ideas on plan approval
description: Selected idea or bug candidates leave the backlog only after deterministic plan approval.
status: accepted
date: 2026-07-17
tags: [backlog, planning, workflow]
files: ["lib/write.mjs", "lib/views/planning.mjs", "test/write.test.mjs", "skills/iterator/lib/write.mjs", "skills/iterator/lib/views/planning.mjs"]
timestamp: 2026-07-17T13:54:35.778Z
---

## Decision

Treat backlog selection as planning intent, not a workflow mutation. The approved plan writer consumes every selected candidate after writing the plan and regenerates the backlog index in the same deterministic operation.

## Consequences

Draft plans and review outcomes that do not run the approved writer preserve all selected candidates. Approved writes report the consumed IDs and leave unselected ideas and bugs available in Planning. The Planning handoff explains this lifecycle boundary, and the writer test covers both draft retention and approved-plan removal.

# Retired plan

Condensed from plan "Remove accepted backlog ideas" (1 features, archived under /features/archive/2026-07-17-consume-accepted-backlog-ideas/).

Token usage: 237410 in / 8441 out / 2277888 cache-read / 0 cache-write over 49 turns (per-step breakdown in the archived usage.md).
