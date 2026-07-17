---
type: Feature
title: Implement a dependency-ready feature wave
description: A Work action launches implementation for every feature ready at the start of the wave and reports each result.
status: implemented
size: large
depends_on: []
files: ["lib/gather.mjs", "lib/status.mjs", "lib/views/hub.mjs", "extensions/iterator.js", "skills/iterator-implement/SKILL.md", "test/gather.test.mjs", "test/status.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T14:22:32.907Z"
tags: []
commits:
  - sha: 01e5a15cedfc71138680d73ed63276ba010eaca8
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Use server-derived readiness rather than browser filtering. Add an extension/skill orchestration entry point that snapshots ready features, processes only that snapshot, records per-feature success or failure, refreshes the dashboard between results, and leaves every feature subject to the existing review/acceptance lifecycle.

# Snippets

```js
const ready = readiness(b.features, b.settings);\nconst features = b.features.map((c) => ({ name: c.slug, ...ready.get(c.slug) }));
```

# Blast radius

Work controls and feature lifecycle coordination; must not auto-accept or include features unblocked after the wave starts.
