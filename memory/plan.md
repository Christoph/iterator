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
