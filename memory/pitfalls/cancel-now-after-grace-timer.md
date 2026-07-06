---
type: Pitfall
title: Immediate cancel can be masked by a pending grace timer
description: "The servers' /cancel handlers return early when a cancel grace timer exists, so a later ?now=1 cancel may not pre-empt it."
tags:
  - server
  - cancel
  - known-bug
files:
  - lib/server.mjs
  - lib/session-server.mjs
  - test/server.test.mjs
  - test/session-server.test.mjs
timestamp: 2026-07-06T19:11:28.965Z
---

# Pitfall

Both `lib/server.mjs` and `lib/session-server.mjs` start a grace timer for ordinary `/cancel` pagehide requests so reloads do not cancel the workflow. The handlers check `if (done || cancelTimer) return;` (session: `if (!pending || cancelTimer) return;`) before checking `?now=1`, which means an explicit immediate cancel sent while a grace timer is pending can be ignored until the timer fires.

# How to handle it

If you touch cancel handling, make `?now=1` clear/pre-empt any pending grace timer before returning. Add a regression test that first sends `/cancel`, then sends `/cancel?now=1`, and expects immediate `{"type":"cancel"}`.
