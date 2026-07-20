---
type: Plan
title: Streamline backlog planning and knowledge actions
description: Make backlog-to-plan creation, knowledge review, and active-work conflict handling faster and more visible.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-20
timestamp: "2026-07-20T15:33:07.184Z"
plan_reviewed: 2026-07-20
---

# Goal

Turn the selected backlog ideas into a faster, safer planning and knowledge workflow: accept a supplied full plan as a feature-ready plan draft, make backlog capture and filtering reliable, surface focused memory changes, and provide a reviewed path from Work conflict warnings to decision updates.

# Architecture

- Extend the existing Planning/backlog views and server-derived gather payloads rather than creating parallel workflow state; keep candidate filtering, bulk selection, and `@` file suggestions in the client view while deterministic backlog writes remain in `lib/write.mjs`.
- Treat a structured user-supplied plan as a prefilled plan draft that still receives the existing browser approval, then continue directly to `/iterator-feature`; do not bypass the deterministic plan writer, feature slicing, dependency gates, or candidate-consumption rules.
- Reuse the persistent shell and session-server contract so filesystem-only backlog saves remain available during active work without clearing its Work overlay or starting a second model flow.
- Extend the reviewed memory UI and knowledge/write paths to expose changed sections in memory proposals and offer a Work conflict action that creates a reviewable decision-update request; never edit a decision directly from a feature card.
- Keep lifecycle/readiness and conflict status server-derived through `lib/status.mjs` and gather payloads. Preserve safe JSON embedding, client-script parse coverage, responsive controls, and root-to-skill synchronization for canonical `lib/` changes.

# Dependencies

(none)

# Key decisions

- A full plan input skips only redundant planning questions: browser review and deterministic plan approval remain mandatory before features are created.
- Backlog save, filter, and bulk-selection controls remain deterministic filesystem actions and may run while an agent works, but they must not unblock or start another model flow.
- Selected backlog candidates are consumed only after approved plan creation, per `decisions/iterator-dashboard-feature-workflow`; cancelled or feedback plan rounds retain them.
- Memory-conflict acceptance is a reviewed knowledge workflow: it proposes a decision update and an anchored recheck, rather than silently changing memory or marking conflicts resolved.
- Memory-review highlighting distinguishes changed sections from unchanged text without exposing unsafe raw HTML or changing the review acceptance gate.
- Follow `memory/design.md`: compact responsive controls, semantic status colors, and no view-local lifecycle inference.

# Features

* [Backlog file mentions](/features/backlog-file-mentions.md) - Add Planning-style @ file suggestions to backlog idea details so candidates can anchor repository context.
* [Reliable backlog saves](/features/backlog-save-during-work.md) - Keep deterministic backlog saves available during active work without clearing the owned Work overlay.
* [Backlog filtering and bulk selection](/features/backlog-filter-and-bulk-select.md) - Filter backlog candidates by type and select or deselect the visible set for planning.
* [Full-plan fast track](/features/full-plan-fast-track.md) - Turn a structured plan supplied in Planning into an approved feature-ready draft without redundant planning prompts.
* [Focused memory review changes](/features/memory-review-change-focus.md) - Highlight changed sections in memory proposals so reviewers can see exactly what a create or update will alter.
* [Work conflict memory resolution](/features/work-conflict-memory-resolution.md) - Let a Work feature conflict initiate a reviewed decision-update request and anchored follow-up check.

# Plan review

## 2026-07-20 _(agent review: openai-codex/gpt-5.6-sol)_

## Clean bill

- **Goal coverage:** All stated workflow goals are represented in the eight feature commits: structured plans enter direct editable approval before deterministic writing and feature slicing; backlog details support file mentions; backlog saves remain available under the owned Work guard; type filters and atomic visible-set selection are present; memory proposals focus added, modified, removed, and unchanged sections; and Work conflict cards route decision updates through reviewed knowledge handling with anchored follow-up guidance.
- **Key decisions:** Approval-bound backlog consumption remains in the plan writer; ordinary goals retain the planner path; bulk selection uses one validated filesystem write; memory changes still require explicit verdicts; conflict handling does not directly edit decisions or clear unrelated conflict flags; and safe embedding/markdown-link regressions cover the new browser rendering.
- **Architecture:** Changes extend the existing Planning, Work, gather, writer, persistent-session, and memory-review seams. Server-derived conflict metadata supplies the Work view, while canonical root libraries are synchronized to shipped skill copies.
- **Scope and loose ends:** No unexplained production behavior, new dependency, introduced TODO marker, or unaccepted feature remains in the committed plan scope. Rework commits address both recorded feature-review findings. Existing unrelated working-tree leftovers were excluded from feature commits and are not part of this plan review.
