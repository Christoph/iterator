---
type: Feature
title: Keep the backlog available during active work
description: Planning continues to show and accept saved filesystem backlog candidates while a plan is active.
status: implemented
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/views/planning.mjs", "lib/session-server.mjs", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/workflow-state-ownership, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows, decisions/settings-close-returns-to-work]
timestamp: "2026-07-17T14:15:38.119Z"
tags: []
commits:
  - sha: f44d2f9e2da9ba16c40498873fadf4824c686891
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Expose the existing bundle backlog in the active-plan Planning payload and keep its mutation path limited to deterministic approved-plan consumption. Render the same compact candidate controls for active and idle plans, including the responsive interaction behavior already used by Planning.

# Snippets

```js
return { step: "hub", plan: { title, status }, stage, features, backlog: b.backlog };
```

# Blast radius

Planning payload and dashboard interactions; backlog candidates must still be consumed only by approved plan writes.
