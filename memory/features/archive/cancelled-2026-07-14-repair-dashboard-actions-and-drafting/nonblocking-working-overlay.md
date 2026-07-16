---
type: Feature
title: Nonblocking AI working state
description: Keep Knowledge usable and center the working indicator while AI work is in progress.
status: pending
size: small
depends_on: []
files: ["lib/session-server.mjs", "test/nonblocking-working-overlay.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, decisions/settings-close-returns-to-work]
tests: ["test/nonblocking-working-overlay.test.mjs"]
tests_status: green
timestamp: "2026-07-14T11:21:44.431Z"
tags: []
---

# Implementation notes

Update the persistent session shell overlay. Verify Work remains blocked during active work while Knowledge remains clickable, the wording says AI is working, and wide layouts keep the indicator centered.

Implemented: the overlay moved inside a `<main id="stage">` wrapper (position:absolute over the view area only), so the tab bar is never covered — Knowledge/Usage stay one click away while a round runs. Wording is "AI is working…" across the shell and server defaults; overlay children are constrained to `min(640px,92%)` and flex-centered at wide viewports. Memory viewing stays live in read-only mode (`[data-open]`/`.mclose` exemptions in lib/ui.mjs); only controls that dispatch agent turns go inert.

# Snippets

```js
if (!(tab === 'work' && working)) { overlay.style.display = 'none'; return; }
```

# Blast radius

Persistent dashboard shell and all interactive workflow screens.
