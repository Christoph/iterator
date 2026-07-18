---
type: Feature
title: Memorize retired plan commits
description: "Optionally route a completed plan's commits through the existing knowledge lifecycle when it is retired."
status: done
size: large
depends_on: []
files: ["lib/settings.mjs", "lib/gather.mjs", "lib/write.mjs", "skills/iterator/SKILL.md", "test/settings.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T07:10:26.053Z"
tags: []
commits:
  - sha: 712ee00be407ee07e8667e356ee691cc7aa4b06b
    kind: implement
    date: 2026-07-18
done: 2026-07-18
reviewed: 2026-07-18
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

# Review

## 2026-07-18
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: the default-off setting exposes the existing reviewed range at retirement, the runbook requires that review before archiving, and the writer independently blocks stale or missing pointers and unmemorized commits.
