---
type: Feature
title: Reset runtime state for approved plans
description: Start each approved plan in a manual, idle runtime state so stale auto mode cannot dispatch work.
status: implemented
size: medium
depends_on: []
files: ["lib/write.mjs", "extensions/iterator.js", "test/write.test.mjs"]
memories: [architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T17:41:11.588Z"
tags: []
commits:
  - sha: f4ecbdccab0d0109a8019cca9328f69a7066617e
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Reset mode, pause, phase, active feature, strikes, and escalation through `writeState()` immediately after an approved plan is written; do not alter draft-plan state. Include `state.md` in the writer result. Reset a completed auto run to manual/done while keeping escalation and circuit-breaker branches paused auto. After verification, repair the live stale state with the minimal deterministic `{ op:'state', set:{ mode:'manual' } }` write; do not create commits.

# Snippets

```js
if ((payload.status || 'approved') === 'approved') {\n  writeState({ set: { mode: 'manual', paused: false, phase: 'idle',\n    active_feature: null, strikes: {}, escalation: null } }, root);\n}\n\nif (action.done) {\n  await writeState({ mode: 'manual', paused: false, phase: 'done', active_feature: null });\n}
```

# Blast radius

Approved plan creation, completed automatic runs, and the dashboard's subsequent auto-dispatch decision.
