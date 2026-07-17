---
type: Feature
title: Show active plan context on Work
description: Make Work the home for the active plan, its feature set, and the dependency graph.
status: implemented
size: medium
depends_on: []
files: ["lib/views/hub.mjs", "lib/views/planning.mjs", "lib/views/graph.mjs", "test/ui.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-17T16:25:55.104Z"
tags: []
commits:
  - sha: e0b0453cbc024caa1cfdcbe079767214f4d8c6d8
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Relocate active-plan feature/graph presentation from Planning to Work without reimplementing lifecycle logic in either view. Continue rendering the shared gather snapshot and keep Planning focused on backlog and plan-management controls; retain responsive graph usability and update UI coverage.

# Snippets

```js
const CH = D.features || [];\n// Readiness and plan stage arrive precomputed in the gather payload.\n\nrenderGraphInto(g, cw, CH, 'fix depends-on in /iterator-feature before implementing.');
```

# Blast radius

The Planning and Work dashboard surfaces, including all feature-action controls and the graph's server-derived readiness display.
