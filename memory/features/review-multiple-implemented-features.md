---
type: Feature
title: Review implemented features together
description: A consolidated review lets users select an implemented feature and inspect only that feature’s diff and findings.
status: implemented
size: large
depends_on: []
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/views/review.mjs", "lib/session-server.mjs", "extensions/iterator.js", "test/gather.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-17T14:40:04.423Z"
tags: []
commits:
  - sha: e5853320eff434b2aaecca8069ceabceeecdffa3
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Extend review gathering with an explicit multi-feature scope that rebuilds each selected feature from its own commits, retains per-feature ownership and pitfall findings, and renders a responsive left selector with a selected-feature diff pane. Accept/review feedback must remain attributable to each feature and preserve the explicit acceptance gate.

# Snippets

```js
const selected = opts.feature ? b.features.filter((c) => c.slug === opts.feature) : b.features;\nconst features = [];\nfor (const c of selected) { /* build attributed diff */ }
```

# Blast radius

Review gather/render and commit acceptance interfaces; a multi-review must not blend unrelated diffs or silently mark any feature done.
