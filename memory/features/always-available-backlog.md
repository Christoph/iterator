---
type: Feature
title: Keep the backlog available during active work
description: Planning continues to show and accept saved filesystem backlog candidates while a plan is active.
status: done
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/views/planning.mjs", "lib/session-server.mjs", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/workflow-state-ownership, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows, decisions/settings-close-returns-to-work]
timestamp: "2026-07-17T14:16:43.824Z"
tags: []
commits:
  - sha: f44d2f9e2da9ba16c40498873fadf4824c686891
    kind: implement
    date: 2026-07-17
done: 2026-07-17
reviewed: 2026-07-17
---

# Implementation notes

Expose the existing bundle backlog in the active-plan Planning payload and keep its mutation path limited to deterministic approved-plan consumption. Render the same compact candidate controls for active and idle plans, including the responsive interaction behavior already used by Planning.

# Snippets

```js
return { step: "hub", plan: { title, status }, stage, features, backlog: b.backlog };
```

# Blast radius

Planning payload and dashboard interactions; backlog candidates must still be consumed only by approved plan writes.

# Review

## 2026-07-17
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Backlog CRUD and selection remain available during active agent work while all model-dispatching dashboard actions stay protected by the busy guard; focused tests cover both allowed and rejected submissions.
