---
type: Feature
title: Bound planning archives
description: Give Idea Backlog and retired-plan lists clear spacing and bounded vertical scrolling.
status: implemented
size: small
depends_on: [clarify-dashboard-identity]
files: ["lib/views/planning.mjs", "lib/ui.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/synced-droppable-skill-libs]
timestamp: "2026-07-16T19:58:08.208Z"
tags: []
tests_status: green
---

# Implementation notes

Update the Planning view’s layout using the saved compact design parameters. Keep controls accessible on narrow screens and avoid client-template literal escaping errors.

# Snippets

```js
// Plan management — backlog, plan creation/revision/retirement, the dependency graph, feature cancellation — lives on the planning surface (./planning.mjs).
```

# Depends on

* [Clarify dashboard identity](/features/clarify-dashboard-identity.md)

# Blast radius

Planning dashboard layout and inline client-side interactions.
