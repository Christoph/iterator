---
type: Feature
title: Focused memory review changes
description: Highlight changed sections in memory proposals so reviewers can see exactly what a create or update will alter.
status: implemented
size: medium
depends_on: []
files: ["lib/views/memory-review.mjs", "lib/ui.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, patterns/agent-reviewed-memory-writes, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/review-navigation-and-work-context]
timestamp: "2026-07-20T15:18:47.421Z"
tags: []
commits:
  - sha: dff652ec86deb8aaba625755a71e75ac4bb2f563
    kind: implement
    date: 2026-07-20
---

# Implementation notes

Compare proposed and existing concept bodies in the browser using safe escaped rendering. Make changed blocks visually distinct while retaining the existing review verdict and writer protocol.

# Snippets

```js
hydrateMemoryCards(payload, ctx.cwd);
```

# Blast radius

Knowledge review readability, embedded data safety, and mobile diff layout.
