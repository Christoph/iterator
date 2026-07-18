---
type: Feature
title: Keep Work blocked while agents run
description: Make the Work overlay accurately follow an active agent through dispatch, navigation, reconnects, and cleanup.
status: implemented
size: medium
depends_on: []
files: ["lib/session-server.mjs", "extensions/iterator.js", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T07:54:05.149Z"
tags: []
commits:
  - sha: e5fc53effde7812b416f07f26a33204f4b2aea75
    kind: implement
    date: 2026-07-18
---

# Implementation notes

Trace all session show/clear/refresh paths and establish one authoritative lifecycle for working state. Prevent an idle view refresh, stale agent end, or shell reconnection from clearing an active overlay; replay the structured state to new clients and clear it only after the owned work completes or aborts. Continue allowing Planning, Knowledge, and Usage navigation as specified by the session contract.

# Snippets

```js
const stateEvent = () =>
  working != null ? ["working", working] : ["view", { v: seq, tab: activeTab }];
```

```js
session?.showWorking({ text, step, feature, progress });
// agent_end currently refreshes the hub after each turn
```

# Blast radius

The persistent browser shell and extension dispatch lifecycle must agree; regressions can make a running agent look idle or leave a wedged overlay.
