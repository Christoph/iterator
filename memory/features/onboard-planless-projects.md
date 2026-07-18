---
type: Feature
title: Onboard plan-less projects
description: Ensure Planning always offers a working goal, plan, and memory-initialization path in a new project.
status: implemented
size: medium
depends_on: []
files: ["lib/views/planning.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "test/ui.test.mjs", "test/pi-tools.test.mjs"]
memories: [architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T07:35:30.550Z"
tags: []
commits:
  - sha: 6f5126e5bfd940fff2e2e2c5cb581f2367e93ad2
    kind: implement
    date: 2026-07-18
reviewed: 2026-07-18
---

# Implementation notes

Exercise startup and tab navigation without a plan or initialized knowledge side, then make the Planning hero and action routing resilient. Keep entered goals across initialization, send initialization through the existing skill command mapping, return to a usable Planning surface, and retain backlog behavior and the approval-only candidate-consumption decision.

# Snippets

```js
if (!D.plan) {
  // render goal textarea, Initialize memory when knowledge is missing,
  // and Create plan in the Planning hero
}
```

```js
return result.prompt
  ? `${cmd} — when initialization finishes, continue into /skill:iterator-plan — ${result.prompt}`
  : cmd;
```

# Blast radius

No-plan startup, Planning actions, and initialization-to-plan handoff must remain usable without weakening the backlog's deterministic approval boundary.

# Review

## 2026-07-18
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Plan-less uninitialized rendering still throws in lib/views/planning.mjs: `hero.insertBefore(note, goal)` uses `goal`, which is nested inside `goalWrap` and is not a direct child of `hero`. Insert before `goalWrap` (and add an executing DOM/client regression) so the Initialize memory and Create plan controls actually render.
