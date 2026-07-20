---
type: Feature
title: Backlog filtering and bulk selection
description: Filter backlog candidates by type and select or deselect the visible set for planning.
status: implemented
size: medium
depends_on: [backlog-save-during-work]
files: ["lib/views/planning.mjs", "lib/write.mjs", "test/ui.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-20T15:08:09.051Z"
tags: []
tests_status: green
commits:
  - sha: f169ba883dc43251afd128dc14a62c80928b1829
    kind: implement
    date: 2026-07-20
  - sha: 0e543d11713adc5da35ed32a95b095472a2048fe
    kind: implement
    date: 2026-07-20
reviewed: 2026-07-20
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

# Review

## 2026-07-20
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Bulk select is not durably serialized: each per-item post receives HTTP 200 before the async saveBacklog write finishes, so the loop launches concurrent read-modify-write operations against memory/backlog/index.md; updates can overwrite one another and each save also triggers a dashboard refresh. Send the visible IDs through one acknowledged deterministic bulk operation (or otherwise serialize server-side writes and refresh once), and add a regression test through the session/extension boundary proving a multi-item visible selection persists every item.
