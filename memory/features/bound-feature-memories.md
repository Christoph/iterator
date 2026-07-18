---
type: Feature
title: Bound feature memory context
description: Give each implementation contract a deterministic, capped set of the most relevant knowledge concepts.
status: implemented
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/write.mjs", "test/gather.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T06:57:58.628Z"
tags: []
---

# Implementation notes

Rank the complete stored-plus-fresh candidate set once, preserve the documented area priority and deterministic tie-breaking, and cap the final IDs and inlined bodies together. Recompute the stored feature `memories` list with the same policy so the feature view and implementation contract cannot diverge. Cover explicit references, new anchored concepts, and an over-cap union.

# Snippets

```js
export function relevantMemories(concepts, fileGlobs) {
  return matchConcepts(concepts, fileGlobs).sort(byAreaPriority).slice(0, MAX_RELEVANT_MEMORIES);
}
```

```js
function unionMemories(feature, concepts) {
  const dynamic = relevantMemories(concepts, listy(feature.fm.files));
  // current implementation adds every stored ID before dynamic matches
}
```

# Blast radius

Feature-writing and implementation gathering both depend on the same relevance policy; tests must prove a contract cannot exceed the cap.
