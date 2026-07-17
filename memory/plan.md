---
type: Plan
title: Keep backlog planning available and support parallel feature waves
description: Keep filesystem-backed backlog work available during active agent flows, and add dependency-ready implementation waves with consolidated review.
status: approved
branch: iterator/keep-backlog-planning-available-and-support-parallel-feature-waves
worktree: /Volumes/Extern/Projects/iterator-iterator-keep-backlog-planning-available-and-support-parallel-feature-waves
created: 2026-07-17
timestamp: "2026-07-17T15:28:32.570Z"
plan_reviewed: 2026-07-17
---

# Goal

Allow users to continue reading and editing the filesystem-backed idea backlog while an agent is working, without permitting a second model flow. Add a dependency-ready “Implement next wave” workflow and a consolidated “Review all” experience so users can inspect each implemented feature’s attributable diff before explicitly accepting it.

# Architecture

- Extend `architecture/workflow-state-ownership`: derive the fixed dependency-ready wave and review scope in `lib/status.mjs`/`lib/gather.mjs`; views consume supplied readiness and scope rather than recalculating them.
- Extend `architecture/browser-server-contract`: carry backlog CRUD, wave-control, and consolidated-review actions through the session server's single-pending-round protocol, retaining machine-readable results.
- Keep the Planning and Work dashboard views compact and responsive under `memory/design.md`, with controls stacking below 640px and selectable feature diffs remaining usable on narrow screens.
- Route Pi tools, the extension, and implement/review skills through the same deterministic gather/write contracts; canonical `lib/` changes are synchronized to shipped skill copies.

# Dependencies

(none)

# Key decisions

- Follow `decisions/parallel-feature-waves-and-consolidated-review`: backlog CRUD stays available during agent work, but any action that starts another model flow remains blocked.
- Snapshot the pending, dependency-ready features at wave start; implement only that fixed set and never add features that become ready later.
- Preserve the explicit review/acceptance gate: automated implementation may run checks and prepare review, but it must not self-accept features or mark them done.
- Build consolidated review diffs independently from each feature’s recorded commits, keeping feature selection and findings attributable.
- Follow `decisions/consume-accepted-backlog-ideas`: selected candidates remain in the backlog until deterministic plan approval consumes them.
- Follow `decisions/synced-droppable-skill-libs`: update root shared code, run `npm run sync`, and test the synchronized copies rather than hand-editing them.
- Avoid `pitfalls/client-js-template-literal-escaping` when adding view scripts: static JavaScript escapes in backtick templates use doubled backslashes and client-script parse tests cover the payload.

# Features

* [Keep the idea backlog editable during agent work](/features/always-available-backlog.md) - Let users create, edit, delete, and select backlog candidates while an implementation turn is running.
* [Implement a fixed dependency-ready feature wave](/features/implement-ready-feature-wave.md) - Start and advance a snapshot of every pending feature that is ready when the user clicks Implement next wave.
* [Review all implemented features together](/features/review-multiple-implemented-features.md) - Open one selectable, commit-backed review for every implemented feature that has recorded commits.

# Plan review

## 2026-07-17 _(agent review: openai-codex/gpt-5.6-sol)_

## Clean bill

- **Goal coverage:** Complete. Backlog CRUD remains available during active agent work while unrelated submissions stay blocked; `Implement next wave` uses a fixed server-derived ready snapshot and stops features at `implemented`; `Review all` presents independently rebuilt, selectable commit-backed feature diffs before explicit acceptance.
- **Architecture and decisions:** The implementation follows centralized gather/status readiness, the persistent session-server contract, explicit review gates, responsive dashboard design parameters, and synchronized root/skill library copies. No new dependency or decision contradiction was introduced.
- **Scope and loose ends:** All three features are accepted (`done`), both review findings were addressed by follow-up commits, the complete suite passes, and no unexplained functional scope drift or TODO was found.
