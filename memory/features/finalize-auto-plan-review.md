---
type: Feature
title: Finalize auto mode after plan review
description: Agent plan-review completion resets durable auto state and refreshes Work so the final Auto step cannot remain stuck.
status: implemented
size: medium
depends_on: []
files: ["lib/write.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "test/write.test.mjs", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
memories: [architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset]
timestamp: "2026-07-20T18:15:09.323Z"
tags: []
tests_status: green
commits:
  - sha: a0f4243efa31abc254a6dc4cff1ae11876f7ba7b
    kind: implement
    date: 2026-07-20
---

# Implementation notes

At the auto-only plan-review persistence boundary, atomically move runtime state to manual/done and clear active_feature, paused, strikes, and escalation after recording plan_reviewed; retain manual plan-review behavior unchanged and make repeat writes safe. Make the extension’s existing nextAutoAction done branch converge and refresh without reasserting stale ownership, including model restoration and overlay clearing. Test both a normal terminal review and a refresh/agent-end race so the dashboard reaches the retirable state. Do not add view-local state derivation. Run npm run sync after root library changes.

# Snippets

```js
if (action.done) {
  await writeState({
    mode: "manual", paused: false, phase: "done", active_feature: null,
  });
  await restoreModel();
  await refreshHub(cwd);
}
```

```js
function recordPlanReview(payload, root) {
  // records plan_reviewed but currently leaves state.md unchanged
}
```

# Blast radius

The final auto transition owns runtime mode, role-model restoration, session overlay release, and the retirable dashboard state; it must not alter manual review behavior or auto-retire a plan.
