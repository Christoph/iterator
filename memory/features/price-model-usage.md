---
type: Feature
title: Price model usage
description: Let projects optionally configure token prices per model and show calculated row and aggregate costs in Usage.
status: implemented
size: large
depends_on: []
files: ["lib/gather.mjs", "lib/write.mjs", "lib/views/usage.mjs", "extensions/iterator.js", "test/write.test.mjs", "test/settings.test.mjs"]
memories: [architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-18T07:47:26.342Z"
tags: []
tests_status: green
---

# Implementation notes

Persist user-supplied USD rates for input, output, cache read, and cache write with the usage ledger through a validated deterministic writer operation. Extend the usage gather payload and editable Usage surface to manage rates and calculate each per-step/model row plus totals; omit cost where a rate is unavailable and never fetch or guess provider prices. Preserve the current raw-token reporting and archived-ledger readability.

# Snippets

```js
const USAGE_FIELDS = ["input", "output", "cacheRead", "cacheWrite"];
function addUsage(bucket, row) {
  for (const f of USAGE_FIELDS) bucket[f] = (bucket[f] || 0) + (row[f] || 0);
}
```

```js
const model = `${r.provider || "unknown"}/${r.model || "unknown"}`;
totals.steps[step][model] = addUsage(totals.steps[step][model] || {}, norm);
```

# Blast radius

Usage persistence, payloads, dashboard submission handling, and archived ledgers must agree on rates and computed USD costs.
