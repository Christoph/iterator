---
type: Plan
title: Keep active review stable and clarify Planning versus Work
description: Preserve active reviews across Planning navigation, move active work context to Work, and polish review controls.
status: approved
branch: iterator/always-available-backlog
created: 2026-07-17
timestamp: 2026-07-17T16:15:52.935Z
---

# Goal

Prevent an in-progress review from being aborted when users visit Planning to manage backlog ideas, while making Work the clear home for the active plan, its features, and their dependency graph. Fix long feature-review titles so they remain fully readable, and remove the unused lower-right Feedback control.

# Architecture

- Extend `architecture/browser-server-contract` and the persistent session shell so navigation and filesystem-only backlog work do not destroy an existing pending review round; its eventual result remains the sole stdout outcome.
- Extend `architecture/workflow-state-ownership`: gather supplies active-plan, feature, and dependency-graph data to Work, while Planning remains focused on backlog and plan-management surfaces rather than reconstructing workflow state locally.
- Update the dashboard views and extension through their established contracts; preserve the compact responsive rules in `memory/design.md`, including wrapping or horizontal overflow instead of clipping titles.
- Update canonical `lib/` sources and run `npm run sync` so shipped skill copies remain aligned, with session/UI/client-script regression coverage.

# Dependencies

(none)

# Key decisions

- Follow `decisions/backlog-planning-and-feature-waves`: backlog CRUD may remain available during an active model round, but it must preserve the active review's pending state and must not unblock unrelated model-flow actions.
- Follow `architecture/browser-server-contract`: a review round continues to own its one machine-readable result even when the user navigates to Planning and returns; navigation is not a cancellation signal.
- Keep all active-plan lifecycle data and graph state server-derived per `architecture/workflow-state-ownership`; views only relocate and render the supplied data.
- Follow `decisions/consume-accepted-backlog-ideas`: consume these four selected backlog candidates only when this plan is approved.
- Long review feature titles must remain fully accessible at every breakpoint; prioritize wrapping or overflow over ellipsis/clipping, consistent with `memory/design.md`.
- Remove the unused Feedback control and its obsolete client wiring without adding a replacement feedback path in this scope.
- Follow `pitfalls/client-js-template-literal-escaping` for any changed inline view scripts, and cover their parseability in client-script tests.

# Features

* [Preserve reviews across Planning navigation](/features/preserve-review-across-planning.md) - Keep an active review open while users manage backlog items on the Planning tab and return to it.
* [Show active plan context on Work](/features/show-active-work-in-work.md) - Make Work the home for the active plan, its feature set, and the dependency graph.
* [Keep review controls fully readable](/features/streamline-review-interface.md) - Show complete feature titles in review and remove the unused Feedback panel.
