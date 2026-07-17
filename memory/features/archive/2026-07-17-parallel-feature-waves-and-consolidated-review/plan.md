---
type: Plan
title: Keep backlog planning available and support parallel feature waves
description: Allow durable backlog planning during active work and add wave-level implementation and consolidated review controls.
status: approved
branch: iterator/consume-accepted-backlog-ideas
created: 2026-07-17
timestamp: "2026-07-17T14:42:24.417Z"
plan_reviewed: 2026-07-17
---

# Goal

Keep saved ideas available for planning while other agent work is in progress, and let users implement every dependency-ready feature as a wave with a consolidated, selectable review experience. This reduces workflow idle time without weakening deterministic state or the explicit acceptance gate.

# Architecture

- Extend the Planning payload and view so saved filesystem-backed backlog candidates remain readable and selectable independently of an active plan; preserve the approved-plan-only consumption boundary from `decisions/consume-accepted-backlog-ideas` and `decisions/iterator-dashboard-feature-workflow`.
- Add server-derived wave orchestration contracts around existing feature readiness: `lib/status.mjs` remains the authority for dependency satisfaction, while gather supplies the ready feature set and views only render it (`architecture/workflow-state-ownership`).
- Build wave implementation as a deterministic sequence/coordination flow that runs each initially dependency-ready feature independently, records per-feature results, and does not infer or mutate lifecycle state in the browser.
- Extend review payloads and the dashboard review UI to scope multiple implemented features and offer a left-hand feature selector whose selected diff is shown on the right; keep session-server output and interaction contracts machine-readable (`architecture/browser-server-contract`).
- Keep canonical changes in `lib/` and synchronize shipped skill copies after implementation, following the established package-and-skill layout.

# Dependencies

(none)

# Key decisions

- Backlog candidates remain active planning inputs throughout implementation and are removed only by successful deterministic plan approval (`decisions/consume-accepted-backlog-ideas`).
- “Implement next wave” targets only features that are dependency-ready at the wave's start; it must surface individual failures and never treat newly unblocked features as part of that same wave.
- Automated wave implementation may run its own checks/review preparation, but it must retain Pi's explicit user-controlled review and acceptance gate rather than silently marking features done (`decisions/polish-dashboard-and-multi-agent-workflows`).
- “Review all” aggregates only implemented wave/plan features into one review session, with per-feature diffs and findings kept attributable to the selected feature.
- The dashboard additions follow `memory/design.md`: compact dark controls, blue only for primary/progress actions, responsive stacking below 640px, and no workflow-state derivation in client code.

# Features

* [Keep the backlog available during active work](/features/always-available-backlog.md) - Planning continues to show and accept saved filesystem backlog candidates while a plan is active.
* [Implement a dependency-ready feature wave](/features/implement-ready-feature-wave.md) - A Work action launches implementation for every feature ready at the start of the wave and reports each result.
* [Review implemented features together](/features/review-multiple-implemented-features.md) - A consolidated review lets users select an implemented feature and inspect only that feature’s diff and findings.

# Plan review

## 2026-07-17 _(agent review: openai-codex/gpt-5.6-sol)_

## Verdict

The five feature commits deliver the approved goal and follow the recorded architecture and key decisions: backlog CRUD/selection remains available during agent work; the dependency-ready set is derived server-side and frozen per implementation wave; wave implementation stops at `implemented` for explicit review; and consolidated review rebuilds each implemented feature from its own commits with selectable, attributable diffs. The dashboard controls follow the saved compact/responsive design, shared `lib/` changes were synchronized into shipped skill copies, all three features are done with approved reviews, and the full test suite passed (346 tests).

## Loose end

- **Working tree outside the bundle is not clean.** Uncommitted changes remain in `lib/gather.mjs`, `lib/pi-tools.mjs`, `lib/session-server.mjs`, `test/gather.test.mjs`, `test/pi-tools.test.mjs`, and `test/session-server.test.mjs`. They are not part of the reviewed feature commits and should be inspected, discarded, or committed before retiring/merging the plan. `git diff --check` reports no whitespace errors.
