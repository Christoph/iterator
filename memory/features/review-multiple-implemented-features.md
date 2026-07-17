---
type: Feature
title: Review all implemented features together
description: Open one selectable, commit-backed review for every implemented feature that has recorded commits.
status: pending
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/views/review.mjs", "extensions/iterator.js", "skills/iterator-review/SKILL.md", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-17T15:02:05.878Z"
tags: []
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
