---
type: Feature
title: Full-plan fast track
description: Turn a structured plan supplied in Planning into an approved feature-ready draft without redundant planning prompts.
status: done
size: medium
depends_on: []
files: ["lib/views/planning.mjs", "lib/views/plan.mjs", "extensions/iterator.js", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset]
timestamp: "2026-07-20T15:15:01.641Z"
tags: []
commits:
  - sha: 48f44eb603a2c55b1585f841344c552a531d58ef
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Detect a structured plan submission at the Planning entry point, preserve the browser plan-review and deterministic plan writer, then hand the approved result directly to the feature breakdown flow. Keep ordinary goal-only planning unchanged and do not bypass candidate consumption or approval.

# Snippets

```js
post({ type:'action', action:'plan', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-plan')
```

# Blast radius

Planning entry behavior, plan approval continuation, and fresh-session dashboard context.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: canonical structured plans bypass only redundant planner discovery, remain editable in browser review, pass through the deterministic plan writer and approval-bound backlog consumption, and dispatch feature breakdown only after a successful approved write.
