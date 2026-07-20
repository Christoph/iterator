---
type: Feature
title: Work conflict memory resolution
description: Let a Work feature conflict initiate a reviewed decision-update request and anchored follow-up check.
status: done
size: medium
depends_on: [memory-review-change-focus]
files: ["lib/views/hub.mjs", "lib/views/memory-review.mjs", "extensions/iterator.js", "lib/gather.mjs", "test/ui.test.mjs", "test/gather.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/agent-reviewed-memory-writes, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow]
timestamp: "2026-07-20T15:32:13.604Z"
tags: []
commits:
  - sha: 0285ceb2302d7c7e66ffc76465fd6aac453126e8
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Add a conflict-card action that opens the existing knowledge review path with the conflicting decision and feature context. Require an explicit memory verdict before updating durable knowledge; refresh gather-derived conflict flags afterward without auto-resolving unrelated features.

# Snippets

```js
(c.conflicts?'<span class="chip cr" title="This feature contradicts a project decision">...':'')
```

# Depends on

* [Focused memory review changes](/features/memory-review-change-focus.md)

# Blast radius

Work conflict cards, reviewed knowledge writes, and feature conflict gathering.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: Work surfaces exact decision conflicts with anchored context, routes updates through the existing explicit memory-review verdict gate, and requests a targeted post-accept feature recheck that preserves unrelated features and conflict flags.
