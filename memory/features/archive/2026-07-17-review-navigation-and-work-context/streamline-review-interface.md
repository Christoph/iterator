---
type: Feature
title: Keep review controls fully readable
description: Show complete feature titles in review and remove the unused Feedback panel.
status: done
size: medium
depends_on: []
files: ["lib/views/review.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-17T16:29:28.160Z"
tags: []
commits:
  - sha: e7d5824e2ac431640e6a1abc6169dfcc6121b43b
    kind: implement
    date: 2026-07-17
done: 2026-07-17
reviewed: 2026-07-17
---

# Implementation notes

Replace sidebar title truncation with responsive wrapping or overflow that preserves every title, including long feature names. Remove the fixed lower-right Feedback panel and its client-side bookkeeping while preserving feature status, notes, line comments, and header submission actions. Extend UI and inline-script parse coverage.

# Snippets

```css
.fn{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.fb{position:fixed;bottom:0;right:0;width:400px;...}
```

```html
<div class="fb col" id="fbpanel">\n  <div class="fbh" onclick="toggleFb()">…</div>\n</div>
```

# Blast radius

The review sidebar and narrow-screen review layout; reviewer feedback submission must continue to use the existing header controls and collected feature/line comments.

# Review

## 2026-07-17
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: review sidebar and detail labels now wrap without truncation, the obsolete fixed Feedback panel and preview bookkeeping are removed, header submission still derives from feature and line-comment state, and UI/client-script/full-suite tests pass.
