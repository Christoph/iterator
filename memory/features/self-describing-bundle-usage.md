---
type: Feature
title: Teach the bundle to explain its own use
description: Every bundle carries agent-facing usage rules, written at init and drift-checked during consolidate without the dashboard.
status: implemented
size: medium
depends_on: []
files: ["templates/format.md", "lib/write.mjs", "skills/iterator-init/SKILL.md", "skills/iterator-consolidate/SKILL.md", "test/write.test.mjs"]
memories: [architecture/knowledge-lifecycle, architecture/workflow-state-ownership, patterns/agent-reviewed-memory-writes, decisions/auto-plan-review-terminal-reset, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-21T20:04:49.830Z"
tags: []
commits:
  - sha: ddb22431072427c20ee522a5945c5b2849e6fc1c
    kind: implement
    date: 2026-07-21
---

# Implementation notes

templates/format.md documents the metadata schema but never says how to USE the bundle. Add an agent-facing section: the read order (plan.md and features/index.md first, then decisions before architecture/patterns/pitfalls/setup), that machine-owned files are writer-owned and must be piped through write.mjs rather than hand-edited, and how to discover ops via --schema. Second gap: lib/write.mjs:367 copies format.md only on the first PLAN write, so an init-only knowledge bundle has none — seed it on the init write path too, keeping the copy-once guard. Third gap: gather already computes formatStale (lib/gather.mjs:1231) and a refresh-format op already exists (lib/write.mjs:2277), but only lib/views/knowledge.mjs consumes it — make skills/iterator-consolidate/SKILL.md read formatStale from the knowledge gather and offer refresh-format, so a no-extension agent performs the same check. Cover the init-path copy in test/write.test.mjs.

# Snippets

```js
// lib/gather.mjs:1231 — already computed, dashboard-only today
const formatStale = !!template && existsSync(formatFile) &&
  readFileSync(template, "utf8") !== readFileSync(formatFile, "utf8");
```

# Blast radius

New bundles gain format.md at init; consolidate gains a drift check. Existing bundles are untouched until refreshed.
