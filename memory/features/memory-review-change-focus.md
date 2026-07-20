---
type: Feature
title: Focused memory review changes
description: Highlight changed sections in memory proposals so reviewers can see exactly what a create or update will alter.
status: done
size: medium
depends_on: []
files: ["lib/views/memory-review.mjs", "lib/ui.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, patterns/agent-reviewed-memory-writes, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/review-navigation-and-work-context]
timestamp: "2026-07-20T15:22:12.401Z"
tags: []
commits:
  - sha: dff652ec86deb8aaba625755a71e75ac4bb2f563
    kind: implement
    date: 2026-07-20
  - sha: 9213ff8661b525aa94d53cbaaf403c01e21f4c5f
    kind: implement
    date: 2026-07-20
reviewed: 2026-07-20
done: 2026-07-20
---

# Implementation notes

Compare proposed and existing concept bodies in the browser using safe escaped rendering. Make changed blocks visually distinct while retaining the existing review verdict and writer protocol.

# Snippets

```js
hydrateMemoryCards(payload, ctx.cwd);
```

# Blast radius

Knowledge review readability, embedded data safety, and mobile diff layout.

# Review

## 2026-07-20
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — The new href hardening double-escapes ampersands in valid links: inline() first runs escc(s), so the captured URL already contains &amp;, then attr(u) runs escc again and emits &amp;amp;, changing query-string URLs in the browser. Escape only quote characters at the attribute step (or restructure link parsing to escape exactly once), and add an executed regression proving an allowed URL with both '&' and quotes is safe without changing its query parameters.
