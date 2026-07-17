---
type: Feature
title: Preserve reviews across Planning navigation
description: Keep an active review open while users manage backlog items on the Planning tab and return to it.
status: done
size: medium
depends_on: []
files: ["lib/session-server.mjs", "extensions/iterator.js", "test/session-server.test.mjs", "test/nonblocking-working-overlay.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T16:23:18.304Z"
tags: []
commits:
  - sha: 30c6a6b70a54d59a72a79ba2f864a9b993006262
    kind: implement
    date: 2026-07-17
  - sha: dd02899ab64b86edef1ab064bd6a3e156eb5a222
    kind: implement
    date: 2026-07-17
reviewed: 2026-07-17
done: 2026-07-17
---

# Implementation notes

Separate view/tab navigation from pending-round cancellation in the persistent session server. Ensure backlog writes and idle refreshes preserve the active review document and its run/result ownership; cover the Planning → Work return path and verify unrelated submissions remain guarded while the review is pending.

# Snippets

```js
const settle = (result) => { if (!pending) return false; /* resolve the active round once */ };\n\nshowStep({ step, render, signal }) {\n  settle({ type: 'cancel' }); // only a new round supersedes a pending one\n  activeTab = tabFor(step);\n}
```

# Blast radius

The session shell's one-pending-round lifecycle, tab switching, backlog CRUD, and every interactive workflow that uses the persistent dashboard.

# Review

## 2026-07-17
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: the persistent shell now deterministically owns unload cancellation, embedded view tab switches cannot abort the pending review, explicit cancel pre-empts grace timers, and the Review → Planning → Work regression plus full suite pass.
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — The fix is race-prone and the tests do not exercise the behavior. `setTab()` queues a `postMessage({iterator:'navigate'})` and immediately replaces `frame.src`; delivery of that queued message is not guaranteed before the outgoing iframe's `pagehide`, so `sendCancel()` can still beacon `/cancel` and abort the pending review. Make cancellation ownership deterministic (for example, suppress iframe pagehide beacons in the persistent session and let the parent shell beacon `/cancel` when the whole dashboard unloads), then add a behavioral regression that performs review → Planning → Work and proves the original review round remains pending and can still submit.
