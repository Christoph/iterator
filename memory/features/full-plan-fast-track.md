---
type: Feature
title: Full-plan fast track
description: Turn a structured plan supplied in Planning into an approved feature-ready draft without redundant planning prompts.
status: implemented
size: medium
depends_on: []
files: ["lib/views/planning.mjs", "lib/views/plan.mjs", "extensions/iterator.js", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset]
timestamp: "2026-07-20T15:14:14.044Z"
tags: []
---

# Implementation notes

Detect a structured plan submission at the Planning entry point, preserve the browser plan-review and deterministic plan writer, then hand the approved result directly to the feature breakdown flow. Keep ordinary goal-only planning unchanged and do not bypass candidate consumption or approval.

# Snippets

```js
post({ type:'action', action:'plan', feature:null, prompt: goal.value.trim() || null }, 'Starting /iterator-plan')
```

# Blast radius

Planning entry behavior, plan approval continuation, and fresh-session dashboard context.
