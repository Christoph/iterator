---
type: Decision
title: Settings modal preserves originating dashboard context
description: Open Settings as a shell-owned modal and dismiss it back to the same tab, pending round, and Work overlay.
status: accepted
date: 2026-07-20
tags: [dashboard, settings, navigation, pi, modal]
files: ["extensions/iterator.js", "lib/session-server.mjs", "lib/views/settings.mjs", "skills/iterator/lib/views/settings.mjs", "test/session-server.test.mjs", "test/ui.test.mjs"]
timestamp: "2026-07-20T14:35:25.921Z"
---

# Decision

Treat Settings as shell-owned modal state, rather than a dashboard tab or a Work iframe document. The gear and `/iterator-settings` open it above whichever tab is active without replacing stored tab HTML, cancelling a pending round, or clearing the Work ownership overlay.

Closing without changes and saving successfully dismiss the modal and reveal the exact originating tab and round. Modal settings results route through the existing deterministic settings writer, but do not settle a pending plan or review. A Settings close remains available while Work is blocked; changing values remains read-only until the agent completes.

# Rationale

Settings is global project configuration, not workflow navigation. Preserving the shell context removes the forced jump to Work and lets users inspect or close Settings safely from Planning, Knowledge, Usage, and interactive rounds.

# Consequences

The session server owns modal HTML, delivery, reconnect replay, Escape/close behavior, and focus restoration. The extension closes the modal after successful persistence and refreshes only the status strip, preserving the underlying view. Tests cover tab preservation, pending-round safety, blocked Work dismissal, responsive modal sizing, and reconnect replay.
