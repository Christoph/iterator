---
type: Plan
title: "Simplify iterator: clear states, lean agent context, Planning tab"
description: Consolidate state rules into one server-owned module, cut LLM token waste by loading files server-side, split server.mjs, add a Planning tab, and fix dependency-graph label truncation.
status: approved
branch: iterator/simplify-iterator-clear-states-lean-agent-context-planning-tab
worktree: /Volumes/Extern/Projects/iterator-iterator-simplify-iterator-clear-states-lean-agent-context-planning-tab
created: 2026-07-16
timestamp: 2026-07-16T09:38:26.703Z
---

# Goal

Make the codebase robust and maintainable: plans and features get clear states computed by deterministic server code and merely rendered by the UI; the AI agent receives only relevant context, sending file paths/ids instead of echoing full text; the dashboard splits into Planning (ideas/bugs backlog, plan and feature management) and Work (implement/test/review) tabs alongside Knowledge and Usage; the dependency graph shows full node labels.

# Architecture

- New lib/status.mjs holds the single feature-status transition table, dependency-readiness rule, and derived planStage; write.mjs guards and gather.mjs/hub.mjs duplicates all delegate to it, and hub payloads ship ready/waitingOn/stage so views only render (architecture/deterministic-writer).
- gather.mjs hydrates memory-card existingBody from disk by concept id, gains a narrow retire step, and caps the review diff at a file boundary like plan-review; app.mjs/extensions spawn the writer on plan approval via a shared runWriter so sections never round-trip through the model twice (architecture/browser-server-contract).
- lib/server.mjs splits into lib/server/{env,run-id,takeover,listen}.mjs with server.mjs as a re-exporting facade; the duplicated EADDRINUSE walk-up in session-server.mjs moves into listenWithTakeover; takeover logic moves verbatim.
- New lib/views/planning.mjs renders the planning surface (hero, backlog, retired plans, dependency graph, plan-lifecycle buttons, read-only feature cards) from the same hub gather payload; hub.mjs slims to the Work surface; session shell gains the Planning tab (decisions/synced-droppable-skill-libs for sync updates).
- New lib/views/graph.mjs shares auto-width dependency-graph rendering between hub, feature, and planning views; labels are never clipped, wide graphs scroll horizontally per memory/design.md.

# Dependencies

(none)

# Key decisions

- Feature statuses stay draft|pending|implemented|done and plan status stays draft|approved; everything else (readiness, stage) is derived in gather, never stored, so there is one source of truth.
- The transition table tightens update-feature: draft cannot jump to done; accept-commit remains the only owner of done.
- The two request handlers (one-shot vs session) stay separate programs; only genuinely shared logic (env, run-id, takeover, listen walk-up) is extracted.
- write.mjs is not split into files; the status module removes the real duplication and a mechanical split adds churn without behavior wins.
- existingBody leaves the LLM card schema entirely; the server fills it from disk only when absent so explicitly passed bodies still win.
- Graph nodes are single-line auto-width (7.25px/char estimate + padding), preferring horizontal overflow to clipping or wrapping.

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
