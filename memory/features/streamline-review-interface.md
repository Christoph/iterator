---
type: Feature
title: Keep review controls fully readable
description: Show complete feature titles in review and remove the unused Feedback panel.
status: implemented
size: medium
depends_on: []
files: ["lib/views/review.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-17T16:29:00.013Z"
tags: []
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
