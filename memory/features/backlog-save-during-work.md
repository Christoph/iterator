---
type: Feature
title: Reliable backlog saves
description: Keep deterministic backlog saves available during active work without clearing the owned Work overlay.
status: done
size: medium
depends_on: []
files: ["lib/session-server.mjs", "extensions/iterator.js", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-20T14:59:18.522Z"
tags: []
commits:
  - sha: e5f2027ab7e5d4c51af978ec1c7601633122ca4c
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Allow only the existing backlog write protocol while the agent is working, route it through the deterministic writer, and refresh stored dashboard data without ending or replacing the active work claim. Do not broaden the exception to model-starting actions.

# Snippets

```js
const backlogWrite = parsed.type === 'backlog';
```

# Blast radius

Single-model-flow guard, Work overlay ownership, and backlog persistence.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Backlog CRUD remains the sole filesystem-write exception during active work, refreshed Planning state is stored immediately, and the owned Work guard plus model-flow blocking remain intact.
