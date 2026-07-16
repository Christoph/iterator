---
type: Plan
title: Repair dashboard actions and drafting
description: Restore reliable Knowledge actions, usable working state, and persistent Work plan drafting.
status: approved
branch: iterator/settings-return-to-work
created: 2026-07-14
timestamp: 2026-07-14T11:17:50.789Z
---

# Goal

Fix dashboard reliability issues: make memory modals close reliably, ensure every Knowledge-tab control works, keep Knowledge interactive while AI work runs, and provide a larger Work-tab plan input that retains its draft while users switch tabs.

# Architecture

- Audit every emitted Knowledge-view action in `lib/views/knowledge.mjs` against `lib/pi-tools.mjs` and the extension dispatcher; repair any broken route to its existing skill or deterministic handler while preserving the knowledge lifecycle (architecture/knowledge-lifecycle).
- Repair Knowledge modal event handling and its synced packaged copy so X, backdrop, and Escape dismiss the local modal without ending the browser-server round (architecture/browser-server-contract).
- Correct the persistent shell’s working overlay in `lib/session-server.mjs` so it says “AI is working”, blocks only the Work surface, and leaves Knowledge actions and concept browsing accessible; constrain and center its content at wide viewports.
- Extend the Work hub in `lib/views/hub.mjs` with client-side draft persistence across iframe/tab refreshes; preserve the existing one-action result protocol and use the established dashboard navigation model (decisions/settings-close-returns-to-work).
- Split the work into user-visible features, each with its own focused regression coverage; update canonical root views and run the required skill-library sync (decisions/synced-droppable-skill-libs).

# Dependencies

(none)

# Key decisions

- Keep modal dismissal entirely client-side; it must not emit a workflow cancel or interfere with pending server rounds.
- Reuse the existing knowledge skill commands and deterministic handlers rather than adding a second action protocol.
- Persist only the unsent plan-goal draft in browser storage, restoring it when the Work view is recreated and clearing it only after the user starts a plan.
- Treat the larger plan input and centered working state as focused usability improvements within the saved dark dashboard design parameters, not a visual redesign.

# Features

* [Nonblocking AI working state](/features/nonblocking-working-overlay.md) - Keep Knowledge usable and center the working indicator while AI work is in progress.
* [Persistent Work plan draft](/features/persistent-plan-draft.md) - Provide a larger plan-goal input that preserves unsent text when users switch dashboard tabs.
* [Record tests for feature contracts](/features/feature-test-recording.md) - Make the deterministic test writer record and commit tests for feature-based plans.
* [Reliable Knowledge controls](/features/knowledge-controls.md) - Make memory modals dismiss reliably and route every Knowledge-tab action to its working skill or handler.
* [Shared dependency graph with full labels](/features/graph-full-labels.md) - Extract the SVG dependency graph into lib/views/graph.mjs with auto-width nodes so labels are never truncated; hub and feature views consume it; wide graphs scroll horizontally per design.md.
* [Server hydrates existingBody from disk](/features/memory-card-hydration.md) - Add hydrateMemoryCards to gather.mjs so memory-review and review payloads get existingBody filled from disk by concept id; the LLM card schema drops the requirement; consolidate skill stops re-reading and echoing bodies.
* [Server applies plan on approve](/features/plan-apply-on-approve.md) - When a plan submission carries apply:true and the browser returns plan-approved, the server spawns the writer itself with the approved sections, so plan text no longer round-trips through the model twice.
* [Narrow gather step for plan retirement](/features/retire-gather-step.md) - Add gather --step retire returning plan sections plus per-feature summaries so the retire flow no longer instructs the agent to read the plan and every feature file wholesale.
* [Cap review diff at file boundary](/features/review-diff-cap.md) - gatherReview truncates the embedded working-tree diff at the last file boundary under 400KB, flags diffTruncated with omitted file names, and the review view shows a warning banner.
* [Split server.mjs into focused modules](/features/server-module-split.md) - Move env detection, run-id, port-takeover machinery, and the EADDRINUSE listen walk-up into lib/server/{env,run-id,takeover,listen}.mjs; server.mjs becomes a thin facade re-exporting today's API; session-server.mjs adopts the shared listenWithTakeover.
* [Single status module + server-computed derived state](/features/status-module.md) - Create lib/status.mjs holding the feature-status transition table, readiness rule, and derived planStage; replace the scattered guards in write.mjs and gather.mjs; hub payload ships ready/waitingOn/stage and hub.mjs drops its client-side depSatisfied duplicate.
* [Planning tab: backlog, plan and feature management](/features/planning-tab.md) - New planning view holding the no-plan hero, backlog (ideas/bugs), retired plans, dependency graph, stage-driven plan-lifecycle buttons, and read-only feature cards; hub slims to the Work surface; session shell gains the Planning tab.
* [Docs sweep: stale notes and tab description](/features/stale-docs-cleanup.md) - Remove the stale NUL-byte note from CLAUDE.md (the byte no longer exists in lib/gather.mjs) and align CLAUDE.md wording with the new tab structure.
* [Explain empty reviews instead of dead-ending](/features/review-state-hints.md) - When a non-done feature has no working-tree diff and no recorded commits, the hub and review flows say why (work likely committed outside the flow / wrong root) and what to do, instead of a bare 'working tree is clean'.
