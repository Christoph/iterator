---
type: Feature
title: Persist budget prices across plans
description: Budget saves a project-wide model price table that survives retirement, prefills later plans, and remains updateable or clearable.
status: done
size: medium
depends_on: []
files: ["lib/settings.mjs", "lib/gather.mjs", "lib/write.mjs", "lib/views/usage.mjs", "test/settings.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-20T18:05:55.175Z"
tags: []
tests_status: green
commits:
  - sha: ce7fee46095caa1153388ff3bed4a1c2bb42ee12
    kind: implement
    date: 2026-07-20
  - sha: 8c1ac8d5f8604372d7a3d12b9959c5b30f20782d
    kind: implement
    date: 2026-07-20
reviewed: 2026-07-20
done: 2026-07-20
---

# Implementation notes

Make project prices durable configuration in memory/settings.md while keeping them edited only through the Budget/Usage surface. Extend settings validation/serialization with a hidden structured price-catalog value that the general Settings form does not render. Centralize the existing provider/model and non-negative token-rate validation so the usage writer can atomically persist a complete catalog update and refresh the active usage.md snapshot. Active gather/cost calculations should prefer the explicit persistent catalog; when it has never been established, fall back to prices in the current usage.md for compatibility, while an explicitly saved empty catalog must remain distinguishable from absence. New usage ledgers inherit the saved project prices, and archived usage keeps its own snapshot so historical costs do not change. Update Budget copy to explain project-wide reuse and retain add/update/remove/save behavior. Do not fetch rates or scan retired archives for an implicit winner. Run npm run sync after canonical lib changes.

# Snippets

```js
export function gatherUsage(startDir) {
  const b = loadBundle(startDir);
  const data = usageDataAt(join(b.memDir, "usage.md"));
  const prices = data?.prices || {};
  // persistent project catalog should become the live source here
}
```

```js
const prices = hasPrices
  ? normalizeUsagePrices(payload.prices)
  : parseUsagePrices(existingFm);
// Saving a complete price table must also persist project configuration.
```

# Blast radius

Price-source precedence affects every live cost calculation and plan retirement snapshot; absence versus an intentionally cleared table must not be conflated.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved after rework: Budget is the sole price mutation path, first saves register settings in the bundle index, active snapshots stay synchronized, archived prices remain stable, and regression coverage passes.
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — `writeUsage` saves `usage_prices` through `persistSettings` but bypasses settings bookkeeping: when Budget first creates `memory/settings.md`, `memory/index.md` is not regenerated to link it. Also the generic `settings` writer/schema still accepts the hidden `usage_prices` key, allowing prices to change without refreshing the active usage snapshot and breaking archived-cost reproducibility. Make Budget price saves regenerate the settings index (with focused coverage), and keep the hidden catalog out of/rejected by the public settings op so Budget remains its only mutation path.
