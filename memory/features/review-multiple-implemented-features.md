---
type: Feature
title: Review all implemented features together
description: Open one selectable, commit-backed review for every implemented feature that has recorded commits.
status: implemented
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/views/review.mjs", "extensions/iterator.js", "skills/iterator-review/SKILL.md", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-17T15:23:57.765Z"
tags: []
commits:
  - sha: e5853320eff434b2aaecca8069ceabceeecdffa3
    kind: implement
    date: 2026-07-17
  - sha: 3a7f49f30705940e761692e6649bf3c833cdfe7f
    kind: implement
    date: 2026-07-17
reviewed: 2026-07-17
---

# Implementation notes

Expose Review all only for a nontrivial server-derived review scope. Gather each implemented feature's recorded commits independently, combine the feature-grouped payload without losing attribution, and render a sidebar selector with each feature's own diff, findings, tests, and pitfalls. Keep acceptance explicit and per-feature even in the consolidated view.

# Snippets

```js
if (opts.feature === "all") {
  const selected = b.features.filter(c =>
    c.fm.status === "implemented" && resolveFeatureCommits(b.root, c).length > 0,
  );
  const rounds = selected.map(c => gatherReview(b.root, { feature: c.slug }));
  return { multiReview: true, reviewScope: selected.map(c => c.slug), features: rounds.flatMap(round => round.features) };
}
```

# Blast radius

Commit attribution, review findings, and explicit feature acceptance; unrelated working-tree changes must not pollute a feature's commit-backed diff.

# Review

## 2026-07-17
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Consolidated review loses cross-declared files from a feature's own commits. `gatherReview(..., { feature: slug })` still resolves ownership against every feature and then drops files when `owner.slug !== opts.feature`; therefore this feature's commit omits its `lib/pi-tools.mjs` review-all command mapping and `test/pi-tools.test.mjs` change because those paths are declared by `implement-ready-feature-wave`. Since `feature: all` composes focused rounds, those commit changes appear in no feature's diff. In commit-backed focused/consolidated review, attribute every changed file from the selected feature's commits to that selected feature (declared when it matches, otherwise incidental), and add a regression where one feature's commit changes a path declared only by another feature.
