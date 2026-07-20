---
type: Feature
title: Backlog filtering and bulk selection
description: Filter backlog candidates by type and select or deselect the visible set for planning.
status: implemented
size: medium
depends_on: [backlog-save-during-work]
files: ["lib/views/planning.mjs", "lib/write.mjs", "test/ui.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-20T15:03:34.975Z"
tags: []
tests_status: green
---

# Implementation notes

Render client-side type filters and visible-set select/deselect controls. Persist each selection through existing deterministic backlog writes; never consume candidates until plan approval.

# Snippets

```js
backlogAction({ action: 'select', id: item.id, selected: !item.selected }, button)
```

# Depends on

* [Reliable backlog saves](/features/backlog-save-during-work.md)

# Blast radius

Backlog selection semantics, plan candidate consumption, and responsive Planning controls.
