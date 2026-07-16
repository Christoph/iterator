---
type: Feature
title: Split server.mjs into focused modules
description: "Move env detection, run-id, port-takeover machinery, and the EADDRINUSE listen walk-up into lib/server/{env,run-id,takeover,listen}.mjs; server.mjs becomes a thin facade re-exporting today's API; session-server.mjs adopts the shared listenWithTakeover."
status: implemented
size: medium
depends_on: []
files: ["lib/server.mjs", "lib/server/env.mjs", "lib/server/run-id.mjs", "lib/server/takeover.mjs", "lib/server/listen.mjs", "lib/session-server.mjs", "scripts/sync.mjs", "test/server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, patterns/one-json-line-server-results, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/synced-droppable-skill-libs, setup/development-commands, setup/remote-browser-access]
timestamp: "2026-07-16T10:25:38.134Z"
tags: []
tests: ["test/server.test.mjs"]
tests_status: green
---

# Implementation notes

Verbatim moves only for takeover (F8-F11 comments included) and env. listenWithTakeover(server,{startPort,maxRetries,say}) extracts the duplicated walk-up in server.mjs:424-471 and session-server.mjs:441-471; non-EADDRINUSE errors propagate (one-shot finish(null,1), session reject). RUN_ID/newRunId get their own module so the live binding re-exports cleanly. server.test.mjs (33 tests) must pass unchanged. COPIES += the four lib/server/*.mjs files.

# Blast radius

Server internals; public exports and behavior unchanged; request handlers deliberately not unified.
