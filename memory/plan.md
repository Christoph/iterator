---
type: Plan
title: Finish auto mode after plan review
description: Return the dashboard to completed manual state after the last automatic plan review records its report.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-20
timestamp: 2026-07-20T18:11:40.957Z
---

# Goal

Make the final automatic plan-review transition reliably finish the auto run: after the final feature and plan review complete, clear stale auto state, release the Work UI from “Auto: plan-review”, and refresh it to the completed/retirable plan state.

# Architecture

- Preserve `lib/status.mjs` as the source of derived plan lifecycle state; the fix only converges runtime state held in `memory/state.md` and the extension’s owned Work overlay.
- Extend the deterministic terminal path around `record-plan-review` / auto dispatch so an agent-authored final review records `plan_reviewed` and resets auto mode to manual, unpaused, terminal state with no active feature, strikes, or escalation. The transition must be idempotent for retries and must not reset a human-initiated plan review.
- Harden `extensions/iterator.js`’s auto completion driver to recognize the recorded terminal review even if the originating agent turn is ending or session refresh races it, restore any role model once, clear its owned overlay, and refresh the Work hub from gathered state.
- Cover the full transition in writer, auto-state-machine, extension lifecycle, and UI/session tests; develop in root `lib/` and extension code, then run `npm run sync` for shipped copies.
- Follow `architecture/workflow-state-ownership`, `decisions/manual-role-models-and-runtime-reset`, and `decisions/focus-feature-execution-and-dashboard-ownership`: state is server-derived and terminal auto runs reset deterministically without browser-local lifecycle inference.

# Dependencies

(none)

# Key decisions

- An agent’s successful `record-plan-review` is the durable terminal boundary for an auto run; it clears stale runtime ownership before the next driver tick, while manual reviews retain their existing state.
- The extension’s later `kickAuto` completion remains an idempotent convergence and UI-refresh path, not a second lifecycle authority.
- A completed plan remains retirable rather than being auto-retired; this change only removes the stale working state.
- No new dependencies or workflow statuses are introduced.

# Features

* [Finalize auto mode after plan review](/features/finalize-auto-plan-review.md) - Agent plan-review completion resets durable auto state and refreshes Work so the final Auto step cannot remain stuck.
