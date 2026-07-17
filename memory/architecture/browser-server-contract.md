---
type: Architecture
title: Browser server contract
description: "Interactive workflows use a one-result server contract; Pi's persistent shell owns cancellation across iframe navigation."
tags:
  - browser-ui
  - server
  - workflow
files:
  - lib/server.mjs
  - lib/ui.mjs
  - lib/session-server.mjs
  - skills/iterator/server.mjs
timestamp: 2026-07-17T17:31:50.189Z
---

# Contract

A skill invokes the shared one-shot server (`skills/iterator/server.mjs`) with a heredoc JSON payload whose `step` picks the view. The server renders a browser page, waits for the user's action, then prints exactly one JSON line to stdout (`action`, `plan-approved`, `review-feedback`, `review-approved`, `cancel`, or `timeout`). The agent must not mutate `memory/` while that server is open.

`lib/server.mjs` owns the common lifecycle: remote-session detection, port binding (fixed 7777), takeover of stale servers, signal-to-cancel handling, `/submit` (with an optional `onSubmit` transform that applies mechanical results before the agent sees them), `/cancel` with a reload grace window, and the two-hour timeout. `lib/ui.mjs` owns the shared page shell and client helpers; views live in `lib/views/*.mjs`.

In pi, `lib/session-server.mjs` replaces the per-question lifecycle: one persistent shell (Planning | Work | Knowledge | Usage tabs plus iframe) for the whole session, views swapped over SSE, and at most one pending round. The shell derives its centered project identity from the process working directory and pairs it with the active tab context; status events supply operational controls only. Keep stdout machine-readable: diagnostics belong on stderr.

Iframe views never own ordinary `pagehide` cancellation in the persistent session, because switching tabs replaces the iframe. The parent shell sends the unload beacon only when the whole dashboard closes, so Planning ↔ Work navigation preserves the pending review and its one eventual result. Explicit `?now=1` cancellation clears any pending reload-grace timer before settling the round.
