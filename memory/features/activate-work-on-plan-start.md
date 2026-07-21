---
type: Feature
title: Activate Work when planning starts
description: Starting a plan from Planning immediately opens the Work progress surface while preserving the later plan review and approval landings.
status: implemented
size: small
depends_on: []
files: ["extensions/iterator.js", "test/extension-work-activation.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/auto-plan-review-terminal-reset, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-21T14:02:20.366Z"
tags: []
commits:
  - sha: eadb89bf9ca7fc3e753bb78d11cc2f4fb114971b
    kind: implement
    date: 2026-07-21
---

# Implementation notes

Route the unsolicited `plan` dashboard action through an intentional `refreshHub(..., { activateWork: true })` before showing the Work-owned overlay and dispatching the planner command. Keep ordinary refreshes tab-stable, keep the plan review on Planning, and retain approved-plan Work activation. Add a focused extension routing regression; no styling changes are needed.

# Snippets

```js
const cmd = actionToCommand(result);
if (!cmd) return;
session.showWorking(`Dispatched ${cmd} — Agent is working…`);
dispatch(cmd);
```

```js
await refreshHub(cwd, { activateWork: true });
```

# Blast radius

Planning-to-Work navigation and visibility of the agent working overlay when plan creation starts.
