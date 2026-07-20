---
type: Feature
title: Backlog file mentions
description: "Add Planning-style @ file suggestions to backlog idea details so candidates can anchor repository context."
status: implemented
size: small
depends_on: []
files: ["lib/views/planning.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-20T14:55:30.100Z"
tags: []
commits:
  - sha: c4bac704a6cd574de68ff95a67f3cee2f894c947
    kind: implement
    date: 2026-07-20
---

# Implementation notes

Reuse the safe Planning @-suggestion behavior in the backlog details control. Keep stored candidate text plain and preserve inline-script escaping and mobile controls.

# Snippets

```js
wireAtMenu(goal, atMenu);
```

# Blast radius

Backlog candidate entry and client-script parse safety.
