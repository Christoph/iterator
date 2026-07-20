---
type: Feature
title: Active plan workspace
description: Make Work the complete home for an active plan and land there after plan or feature approval, while Planning stays focused on future work and archives.
status: done
size: medium
depends_on: [fresh-implementation-session]
files: ["lib/views/hub.mjs", "lib/views/planning.mjs", "extensions/iterator.js", "test/ui.test.mjs", "test/client-js-parse.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow]
conflicts: "[{\"decision\":\"decisions/review-navigation-and-work-context\",\"note\":\"The accepted plan intentionally moves plan lifecycle controls from Planning to Work, revising the recorded split where Planning owned those actions.\"}]"
timestamp: "2026-07-20T14:23:59.725Z"
tags: []
commits:
  - sha: c5f6915bf82dc6914b8a02a707422a0c67b1a26a
    kind: implement
    date: 2026-07-20
  - sha: 6bcce8b8e1097d9135c7644c2cb44edc719841f7
    kind: implement
    date: 2026-07-20
reviewed: 2026-07-20
done: 2026-07-20
---

# Implementation notes

Move active-plan lifecycle controls—revise, feature/re-feature, whole-plan review, retirement, plan cancellation—and their stage-driven affordances from `planning.mjs` into the Work plan bar beside progress and execution. Planning should continue to show plan creation when none exists, backlog CRUD/selection, and retired plans; with an active plan it should explain that management is on Work rather than duplicate state. Add intentional Work activation after approved plan creation and accepted feature breakdown without changing ordinary refreshes that preserve the user's current tab. Continue rendering server-derived `stage`, readiness, progress, and dirty state; do not rederive lifecycle rules in either view. Follow `memory/design.md`, keep mobile controls usable, and retain inline-client parse tests.

# Snippets

```js
// Current Planning surface owns active lifecycle buttons.
revise.addEventListener('click', () => action('plan', null));
refeature.addEventListener('click', () => action('feature', null));
```

```js
const landOnPlanning = preferPlanning && !hub.plan;
session.showView({ step:'planning', activate: landOnPlanning, ... });
session.showView({ step:'hub', render: () => VIEWS.hub(hub) });
```

# Depends on

* [Fresh implementation session](/features/fresh-implementation-session.md)

# Blast radius

Planning/Work navigation, all active plan lifecycle actions, and post-approval landing behavior.

# Decision conflicts

* [decisions/review-navigation-and-work-context](/decisions/review-navigation-and-work-context.md) — The accepted plan intentionally moves plan lifecycle controls from Planning to Work, revising the recorded split where Planning owned those actions.

# Review

## 2026-07-20
* **Needs changes** _(agent review: openai/gpt-5.2)_ — Update lib/views/hub.mjs’s module contract and plan-bar comments (and the synced skill copy) to reflect that Work now owns plan lifecycle actions; they currently still state that Planning owns those controls and omit plan/feature/review-plan/retire/cancel-plan from the output contract. Add extension-level coverage proving plan approval and accepted feature breakdown call refreshHub with activateWork:true, rather than only testing session.showView’s generic activate option.
