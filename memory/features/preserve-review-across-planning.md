---
type: Feature
title: Preserve reviews across Planning navigation
description: Keep an active review open while users manage backlog items on the Planning tab and return to it.
status: implemented
size: medium
depends_on: []
files: ["lib/session-server.mjs", "extensions/iterator.js", "test/session-server.test.mjs", "test/nonblocking-working-overlay.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T16:19:19.010Z"
tags: []
---

# Implementation notes

Separate view/tab navigation from pending-round cancellation in the persistent session server. Ensure backlog writes and idle refreshes preserve the active review document and its run/result ownership; cover the Planning → Work return path and verify unrelated submissions remain guarded while the review is pending.

# Snippets

```js
const settle = (result) => { if (!pending) return false; /* resolve the active round once */ };\n\nshowStep({ step, render, signal }) {\n  settle({ type: 'cancel' }); // only a new round supersedes a pending one\n  activeTab = tabFor(step);\n}
```

# Blast radius

The session shell's one-pending-round lifecycle, tab switching, backlog CRUD, and every interactive workflow that uses the persistent dashboard.
