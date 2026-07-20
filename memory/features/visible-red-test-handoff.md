---
type: Feature
title: Visible red-test handoff
description: Show committed red tests as the implementation target in Work and carry their exact status and paths into the fresh implementer context.
status: pending
size: medium
depends_on: [active-plan-workspace]
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/pi-tools.mjs", "test/gather.test.mjs", "test/ui.test.mjs", "test/pi-tools.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-20T13:50:52.261Z"
tags: []
---

# Implementation notes

Extend the server-gathered hub feature shape with recorded test paths/count where appropriate, preserving `tests_status` as the source of truth. In Work, make red an explicit expected checkpoint: badge/text should say tests are committed and intentionally failing, and the primary action should read as driving those tests green rather than generic implementation. After test creation, refresh/activate the relevant Work context so the new state is visible. Enrich the concise ambient/implementation kickoff state with the active feature's red status and test paths without duplicating the full contract or prior conversation. Ensure no UI or helper treats red as a failed implementation or silently changes tests; implementation remains responsible for the normal green gate.

# Snippets

```js
return {
  name: c.slug,
  testsStatus: c.fm.tests_status || 'none',
  // add the recorded test paths needed by Work and the handoff summary
};
```

```js
test.textContent = c.status==='pending' ? 'Test (red)' : 'Test';
impl.textContent = 'Implement';
```

# Depends on

* [Active plan workspace](/features/active-plan-workspace.md)

# Blast radius

Feature cards, footer/ambient context size, gather payload compatibility, and the red/green contract used by manual and automatic implementation.
