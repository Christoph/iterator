---
type: Decision
title: Return to Work when Settings closes
description: Idle Settings close events restore the refreshed Work hub without changing the settings persistence path.
status: accepted
date: 2026-07-14
tags: [dashboard, settings, navigation, pi]
files: ["extensions/iterator.js", "lib/views/settings.mjs", "skills/iterator/lib/views/settings.mjs", "test/session-server.test.mjs", "test/sync.test.mjs"]
timestamp: 2026-07-14T11:09:27.354Z
---

# Decision

Treat Settings as an idle dashboard page. Its Close action emits the existing `cancel` result, which the extension handles by refreshing the Work hub so the user returns to a usable dashboard instead of remaining on Settings.

# Rationale

Settings changes already use the deterministic writer path. Closing without changes is navigation, not a workflow cancellation, so it must restore the Work view without introducing a separate protocol.

# Consequences

Keep Settings save handling on the existing `settings` result path. Cover idle Settings-close dispatch at the session-server boundary, and route close results through the extension's dashboard refresh behavior.

# Retired plan

Condensed from plan "Restore Work tab after closing Settings" (1 chunks, archived under /chunks/archive/2026-07-14-settings-close-returns-to-work/).

Token usage: 206353 in / 7199 out / 1748992 cache-read / 0 cache-write over 53 turns (per-step breakdown in the archived usage.md).
