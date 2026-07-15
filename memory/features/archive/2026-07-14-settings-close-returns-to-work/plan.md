---
type: Plan
title: Restore Work tab after closing Settings
description: Fix the dashboard settings flow so closing Settings returns users to Work.
status: approved
branch: iterator/restore-work-tab-after-closing-settings
worktree: /Volumes/Extern/Projects/iterator-iterator-restore-work-tab-after-closing-settings
created: 2026-07-14
timestamp: 2026-07-14T10:56:23.084Z
---

# Goal

Fix the dashboard settings flow so users can close Settings after opening it and reliably return to the Work tab without restarting the session.

# Architecture

- Extend the persistent dashboard shell in `lib/session-server.mjs` (architecture/browser-server-contract) so a settings navigation round has an explicit completion path back to the active Work view.
- Preserve the extension-owned settings rendering and control dispatch in `extensions/iterator.js`; do not alter the one-result-per-round browser server contract.
- Add coverage at the session-server boundary for opening settings, closing it, and restoring the Work view; keep the existing root/skill synchronization model (decisions/synced-droppable-skill-libs).

# Dependencies

(none)

# Key decisions

- Treat closing Settings as local dashboard navigation, returning to Work rather than ending or cancelling the active workflow.
- Reuse the existing settings/control protocol instead of introducing a new client-server dependency.
- Add a regression test for the full open → close → Work return sequence.
- No new UI design parameters exist yet; run `/iterator-design` before any broader visual styling work.

# Chunks

* [Return to Work after closing Settings](/chunks/settings-return-to-work.md) - Make closing the dashboard Settings page restore the Work tab and cover the navigation sequence with a regression test.
