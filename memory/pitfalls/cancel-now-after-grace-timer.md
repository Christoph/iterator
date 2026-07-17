---
type: Pitfall
title: Explicit cancel must pre-empt pagehide grace
description: A pending pagehide grace timer must never delay an explicit cancellation request.
tags:
  - server
  - cancel
  - lifecycle
files:
  - lib/server.mjs
  - lib/session-server.mjs
  - test/server.test.mjs
  - test/session-server.test.mjs
timestamp: 2026-07-17T17:31:50.190Z
---

# Pitfall

Ordinary `pagehide` cancellation beacons use a short grace timer so a reload does not end an interactive workflow. If the handler returns merely because that timer already exists, a subsequent explicit `?now=1` cancel is delayed until the grace timer fires.

# How to handle it

For an explicit cancel, first clear any pending grace timer and then settle the active round immediately. Only ordinary beacon cancellation should retain the existing timer. Cover the sequence with a regression test that sends `/cancel`, then `/cancel?now=1`, and expects an immediate `{ "type": "cancel" }` result.
