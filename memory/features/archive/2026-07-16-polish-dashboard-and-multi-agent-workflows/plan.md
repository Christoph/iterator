---
type: Plan
title: Polish dashboard and multi-agent workflows
description: Refine Iterator’s dashboard presentation and backlog ergonomics, restrict settings model choices to the active scope, and make the Claude Code skill workflow reliably plan, slice, implement, and commit work without replacing Pi’s dashboard-centered workflow.
status: approved
branch: iterator/polish-dashboard-and-multi-agent-workflows
worktree: /Volumes/Extern/Projects/iterator-iterator-polish-dashboard-and-multi-agent-workflows
created: 2026-07-16
timestamp: 2026-07-16T14:53:56.478Z
---

# Goal

Refine Iterator’s dashboard presentation and backlog ergonomics, restrict settings model choices to the active scope, and make the Claude Code skill workflow reliably plan, slice, implement, and commit work without replacing Pi’s dashboard-centered workflow.

# Architecture

- Extend the existing session dashboard and Planning views through their supplied gather payloads, preserving centralized lifecycle/state rendering in `architecture/workflow-state-ownership`.
- Update canonical root views and shared UI first, then synchronize copied skill libraries with `npm run sync`, per `decisions/synced-droppable-skill-libs`.
- Keep browser interactions on the established server/session protocol from `architecture/browser-server-contract`; settings remain an idle view whose close returns to Work (`decisions/settings-close-returns-to-work`).
- Treat Pi and Claude Code as distinct clients of the same plan/feature records: Pi remains dashboard-driven, while Claude Code skills explicitly consume deterministic gather/write outputs to advance one dependency-ready feature at a time.
- Apply `memory/design.md`’s compact dark control-plane parameters to header, tabs, and bounded scroll regions; retain responsive and keyboard/touch usability.

# Dependencies

(none)

# Key decisions

- Show the current working-directory folder name as the dashboard identity in the header, with `iterator./planning` presented as the contextual planning title rather than a generic product-only headline.
- Filter model selectors to models available in the current configured scope; do not expose globally known but unusable choices.
- Preserve Pi’s interactive review/accept flow and user-controlled commits; add a Claude Code-specific skill path that loads the plan and feature contract, works sequentially, and commits completed work so non-Pi use is practical.
- Bound Idea Backlog and retired-plan lists with vertical scrolling rather than letting archival content determine page height.
- Preserve explicit operation state and `iterator`/`features` terminology required by `decisions/iterator-dashboard-feature-workflow`.

# Features

* [Clarify dashboard identity](/features/clarify-dashboard-identity.md) - Show the current project folder and planning context prominently in the dashboard header.
* [Bound planning archives](/features/bound-planning-archives.md) - Give Idea Backlog and retired-plan lists clear spacing and bounded vertical scrolling.
* [Scope settings model options](/features/scope-settings-model-options.md) - Only offer models available to the current Pi session scope in settings selectors.
* [Support Claude Code feature flow](/features/support-claude-code-feature-flow.md) - Make Claude Code skills reliably drive the existing plan and feature workflow without changing Pi’s review-centered flow.
