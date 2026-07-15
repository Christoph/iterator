---
type: Plan
title: Unify Iterator dashboard and feature workflow
description: Streamline dashboard state and controls, introduce a UI-managed idea backlog, and migrate all lr/chunk terminology to iterator/features.
status: approved
branch: iterator/unify-iterator-dashboard-and-feature-workflow
worktree: /Users/chris/Projects/iterator-iterator-unify-iterator-dashboard-and-feature-workflow
created: 2026-07-15
timestamp: 2026-07-15T09:09:16.771Z
---

# Goal

Make Iterator’s dashboard reliably communicate state and progress, streamline its controls and action payloads, migrate the project from lr/chunk terminology to iterator/features, and add a durable UI-managed idea backlog that can seed future plans.

# Architecture

- Evolve the persistent dashboard shell and its Work/Knowledge views so header controls, tab badges, operation state, and post-action navigation are derived from one explicit session state.
- Add a deterministic backlog store and writer operations for UI-created feature candidates; keep it separate from active plan features, then expose selection-based plan creation through the dashboard.
- Refactor the browser/server action protocol so each operation submits only its relevant fields and the UI receives lifecycle updates while work is dispatched.
- Rename the plugin’s skills, commands, files, UI text, documentation, tests, and package metadata from `lr`/`chunks` to `iterator`/`features`, with a deliberate migration for existing persisted files.

# Dependencies

(none)

# Key decisions

- Use deterministic server-side writer operations for direct backlog saves; browser code never hand-writes OKF files, even when no agent turn is involved.
- Represent deferred ideas and bugs as a distinct indexed OKF backlog, not as active `memory/features` entries, so active-plan statuses and dependency graphs remain unambiguous.
- Make controls contextual: show Cancel only for cancellable work or the Settings page; Knowledge remains a persistent tab without a Close control.
- Drive Work and Knowledge badges from operation ownership and phase, so background activity remains visible after tab switches.
- Treat the terminology change as a project-wide breaking migration: rename physical paths and persisted `CHUNKS.md` references to `FEATURES.md`, update all public commands/docs, and provide an explicit migration path rather than retaining silent legacy aliases.
- Create the plan without initializing knowledge at the user’s request; the plan writer will record the missing-knowledge warning, and `/iterator-init` can be run before implementation.

# Features

* [Iterator terminology migration](/features/iterator-terminology-migration.md) - Rename the plugin’s lr/chunk surface to iterator/features and migrate persisted plan files without legacy ambiguity.
* [Scoped dashboard action protocol](/features/scoped-dashboard-actions.md) - Submit only the data each dashboard action needs and keep Knowledge navigation free of a redundant close control.
* [Feature idea backlog](/features/feature-idea-backlog.md) - Let users save ideas and bugs directly from Work, select them later, and create a plan from the selected candidates.
