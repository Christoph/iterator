---
type: Decision
title: Streamline backlog planning and knowledge actions
description: Backlog planning remains deterministic during active work, while supplied plans and knowledge-conflict updates stay behind existing approval gates.
status: accepted
date: 2026-07-20
tags: [backlog, planning, knowledge, workflow, dashboard]
files: ["lib/views/planning.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs", "lib/session-server.mjs", "extensions/iterator.js", "test/session-server.test.mjs", "lib/write.mjs", "test/write.test.mjs", "lib/views/plan.mjs", "lib/views/memory-review.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/gather.mjs", "test/gather.test.mjs"]
timestamp: 2026-07-20T16:04:13.795Z
---

## Outcome

Planning now supports repository-anchored backlog ideas, type filtering, and durable visible-set selection. Those filesystem-backed backlog actions remain available while Work has an owned active-flow overlay, without starting or unblocking another model turn.

A structured full plan is accepted as a prefilled, editable planning draft: it skips redundant discovery only, then still passes through browser approval, the deterministic plan writer, approval-bound candidate consumption, and normal feature slicing. Knowledge reviewers can focus on changed proposal sections, and Work conflicts can initiate a reviewed decision-update request followed by an anchored recheck.

## Decisions

- Keep backlog interaction, lifecycle readiness, and conflict state in their existing server-derived and deterministic writer paths; views render supplied state rather than inferring it.
- Preserve the explicit approval boundaries for plan creation, feature work, and knowledge updates. Backlog selection remains intent until plan approval; conflict resolution proposes a memory change instead of silently editing a decision.
- Reuse the persistent session shell so allowed backlog writes refresh Planning without clearing the Work overlay or weakening the single-model-flow guard.

## Trade-offs

The faster full-plan path deliberately retains an editable review and feature-breakdown handoff rather than treating a supplied plan as executable. Highlighting memory changes adds comparison logic, but keeps unsafe raw HTML and acceptance behavior out of the review surface. Shared canonical libraries and their droppable skill copies remain synchronized, with client-script parsing and responsive controls protected by tests.

# Retired plan

Condensed from plan "Streamline backlog planning and knowledge actions" (6 features, archived under /features/archive/2026-07-20-streamline-backlog-planning-and-knowledge-actions/).

Token usage: 3689661 in / 61838 out / 59459584 cache-read / 0 cache-write over 291 turns (per-step breakdown in the archived usage.md).
