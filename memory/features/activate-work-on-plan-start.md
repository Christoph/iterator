---
type: Feature
title: Activate Work when planning starts
description: Starting a plan from Planning immediately opens the Work progress surface while preserving the later plan review and approval landings.
status: implemented
size: small
depends_on: []
files: ["extensions/iterator.js", "test/extension-work-activation.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/auto-plan-review-terminal-reset, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-21T14:05:11.641Z"
tags: []
commits:
  - sha: eadb89bf9ca7fc3e753bb78d11cc2f4fb114971b
    kind: implement
    date: 2026-07-21
  - sha: 37a06f5a6c19c7114ce0ae72a10f5c9b401040cf
    kind: implement
    date: 2026-07-21
reviewed: 2026-07-21
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

# Review

## 2026-07-21
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — The new plan path chains dispatch only inside `refreshHub(...).then(...)`. If dashboard gathering/rendering rejects, the promise is unhandled and the requested plan never starts, whereas the prior generic path always dispatched. Wrap the activation in an async helper or catch/finally so refresh failure is reported but `showWorking`/`dispatch(cmd)` still occur exactly once; add a behavioral regression for the rejection path rather than only source-pattern assertions.
