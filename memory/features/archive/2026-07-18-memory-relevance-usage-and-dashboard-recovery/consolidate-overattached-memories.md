---
type: Feature
title: Consolidate over-attached memories
description: Have knowledge consolidation identify stale, duplicate, and disproportionately attached concepts before proposing reviewed repairs.
status: done
size: medium
depends_on: [bound-feature-memories]
files: ["lib/gather.mjs", "skills/iterator-consolidate/SKILL.md", "test/gather.test.mjs"]
memories: [architecture/knowledge-lifecycle, architecture/workflow-state-ownership, patterns/agent-reviewed-memory-writes, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T07:04:00.197Z"
tags: []
commits:
  - sha: 4bbc80d4ce89652faf183a7db688994f8865f17b
    kind: implement
    date: 2026-07-18
done: 2026-07-18
reviewed: 2026-07-18
---

# Implementation notes

Extend the knowledge inventory with feature-reference/fan-out evidence needed for a consolidation review. Update the consolidation runbook to inspect that evidence as well as stale file anchors and inline paths, propose keep/update/delete or merge-oriented updates, and leave all mutations behind the existing review verdict gate. Do not make plans or feature files writable from consolidation.

# Snippets

```js
const staleCount = memories.filter((m) => m.stale).length;
const advice = staleCount > 0
  ? `${staleCount} stale concept(s) found — verify their anchors...`
  : 'No stale anchors detected — still open the review round...';
```

```md
- Propose `action: "update"` for memories that are stale or clearly outdated.
- Propose `action: "delete"` for memories that no longer apply.
- Include all other memories as `action: "keep"`.
```

# Depends on

* [Bound feature memory context](/features/bound-feature-memories.md)

# Blast radius

Knowledge gathers and the consolidate skill gain review-only attachment diagnostics; approval still flows through okf_write/apply-review.

# Review

## 2026-07-18
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: consolidation now receives uncapped per-feature attachment evidence, dangling references, and conservative shared-anchor candidates, while the runbook preserves reviewed writes and requires a residual scan.
