---
type: Feature
title: Memorize retired plan commits
description: "Optionally route a completed plan's commits through the existing knowledge lifecycle when it is retired."
status: pending
size: large
depends_on: []
files: ["lib/settings.mjs", "lib/gather.mjs", "lib/write.mjs", "skills/iterator/SKILL.md", "test/settings.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T06:54:30.534Z"
tags: []
---

# Implementation notes

Add a default-off setting and surface it with existing settings validation/UI. When enabled, retirement must gather the plan's commit range and use the established reviewed memory semantics rather than silently advancing the pointer or bypassing the knowledge writer; retain the current decision condensation and archive behavior when disabled. Document the retirement handoff and test both settings.

# Snippets

```js
const usageLine = usageTotals
  ? `\n\nToken usage: ${usageTotals.input} in / ${usageTotals.output} out ...`
  : "";
writeMemorize({ memories: [{ action: "create", area: "decisions", ... }] }, root);
```

```md
A finished plan is knowledge, not a dead work item. When every feature is done, condense it through the deterministic `retire-plan` writer.
```

# Blast radius

Retirement, settings, memory pointers, and archive behavior need an explicit tested handoff so disabled projects retain today’s flow.
