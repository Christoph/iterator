---
type: Plan
title: Remove accepted backlog ideas
description: Keep the backlog limited to ideas that have not entered accepted planning work.
status: approved
branch: iterator/remove-accepted-backlog-ideas
worktree: /Volumes/Extern/Projects/iterator-iterator-remove-accepted-backlog-ideas
created: 2026-07-17
timestamp: 2026-07-17T13:48:31.340Z
---

# Goal

When a saved backlog idea is incorporated into an accepted plan or its resulting accepted feature set, remove that idea from the backlog so the Planning view shows only unplanned work and does not retain stale candidates.

# Architecture

- Extend the existing deterministic bundle write and gather contracts to identify the backlog ideas selected for a plan and persist their removal atomically with accepted plan or feature mutations, preserving browser views as render-only consumers (architecture/workflow-state-ownership).
- Carry explicit backlog-idea identity through the plan and feature review/action payloads so only accepted, incorporated ideas are removed; unrelated and unselected candidates remain intact.
- Update Planning dashboard interactions and payload rendering to reflect the refreshed backlog after successful acceptance, following the scoped dashboard action protocol (decisions/iterator-dashboard-feature-workflow).
- Implement canonical behavior in `lib/` and synchronize shipped skill-library copies via `npm run sync` (architecture/package-and-skill-layout).

# Dependencies

(none)

# Key decisions

- Delete only ideas explicitly selected and incorporated by an accepted plan or accepted feature set; do not remove ideas on drafts, feedback, cancellation, timeout, or failed writes.
- Make backlog removal part of the same deterministic writer operation as the corresponding accepted state change, preventing stale items from surviving a successful acceptance or disappearing after a failed one.
- Retain the current backlog representation and dashboard workflow rather than introducing a second lifecycle state for consumed ideas.
- Keep client-side changes compatible with the template-literal escaping rule in pitfalls/client-js-template-literal-escaping and cover the served script path.

# Features

* [Consume accepted backlog ideas](/features/consume-accepted-backlog-ideas.md) - Remove selected backlog candidates atomically when their plan and resulting feature set are accepted.
