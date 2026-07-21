---
type: Feature
title: Finalize auto mode after plan review
description: Agent plan-review completion resets durable auto state and refreshes Work so the final Auto step cannot remain stuck.
status: done
size: medium
depends_on: []
files: ["lib/write.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "test/write.test.mjs", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
memories: [architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset]
timestamp: "2026-07-20T18:19:36.588Z"
tags: []
tests_status: passing
commits:
  - sha: a0f4243efa31abc254a6dc4cff1ae11876f7ba7b
    kind: implement
    date: 2026-07-20
  - sha: 8796007822c9acb3e05e792e19791bdaa4ec30eb
    kind: implement
    date: 2026-07-20
reviewed: 2026-07-20
done: 2026-07-20
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

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: the terminal writer state and immediate extension convergence remove stale auto ownership, preserve manual reviews, and now honor auto_retire_prompt in both completion paths; all 392 tests pass.
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — The new immediate `autoCompleted` branch in `extensions/iterator.js` always notifies “Consider retiring the plan,” bypassing the existing `auto_retire_prompt` setting that the normal `kickAuto` done branch honors. Gather/read the effective setting for this terminal branch (or centralize the completion notifier) and preserve the no-retire-prompt message when it is off; add coverage for both setting values. The durable state reset, overlay clear, refresh, and manual-review preservation otherwise look correct.
