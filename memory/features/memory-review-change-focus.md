---
type: Feature
title: Focused memory review changes
description: Highlight changed sections in memory proposals so reviewers can see exactly what a create or update will alter.
status: pending
size: medium
depends_on: []
files: ["lib/views/memory-review.mjs", "lib/ui.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, patterns/agent-reviewed-memory-writes, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/review-navigation-and-work-context]
timestamp: "2026-07-20T14:51:37.803Z"
tags: []
---

# Implementation notes

Compare proposed and existing concept bodies in the browser using safe escaped rendering. Make changed blocks visually distinct while retaining the existing review verdict and writer protocol.

# Snippets

```js
hydrateMemoryCards(payload, ctx.cwd);
```

# Blast radius

Knowledge review readability, embedded data safety, and mobile diff layout.
