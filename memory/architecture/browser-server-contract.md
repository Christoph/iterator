---
type: Architecture
title: Browser server contract
description: Interactive workflows run a local server that receives a JSON payload on stdin and returns exactly one JSON result on stdout.
tags:
  - browser-ui
  - server
  - workflow
files:
  - lib/server.mjs
  - lib/ui.mjs
  - lib/session-server.mjs
  - skills/iterator/server.mjs
timestamp: 2026-07-06T19:11:28.962Z
---

# Contract

A skill invokes the shared one-shot server (`skills/iterator/server.mjs`) with a heredoc JSON payload whose `step` picks the view. The server renders a browser page, waits for the user's action, then prints exactly one JSON line to stdout (`action`, `plan-approved`, `review-feedback`, `review-approved`, `cancel`, or `timeout`). The agent must not mutate `memory/` while that server is open.

`lib/server.mjs` owns the common lifecycle: remote-session detection, port binding (fixed 7777), takeover of stale servers, signal-to-cancel handling, `/submit` (with an optional `onSubmit` transform that applies mechanical results before the agent sees them), `/cancel` with a reload grace window, and the two-hour timeout. `lib/ui.mjs` owns the shared page shell and client helpers; views live in `lib/views/*.mjs`.

In pi, `lib/session-server.mjs` replaces the per-question lifecycle: one persistent shell (Work | Knowledge tabs + iframe) for the whole session, views swapped over SSE, at most one pending round, unsolicited clicks dispatched as new turns. Keep stdout machine-readable: diagnostics belong on stderr.
