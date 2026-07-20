---
type: Feature
title: Backlog file mentions
description: "Add Planning-style @ file suggestions to backlog idea details so candidates can anchor repository context."
status: done
size: small
depends_on: []
files: ["lib/views/planning.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/workflow-state-ownership, decisions/backlog-planning-and-feature-waves, decisions/consume-accepted-backlog-ideas, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
timestamp: "2026-07-20T14:56:05.501Z"
tags: []
commits:
  - sha: c4bac704a6cd574de68ff95a67f3cee2f894c947
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Reuse the safe Planning @-suggestion behavior in the backlog details control. Keep stored candidate text plain and preserve inline-script escaping and mobile controls.

# Snippets

```js
wireAtMenu(goal, atMenu);
```

# Blast radius

Backlog candidate entry and client-script parse safety.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Backlog details now reuse the existing escaped, keyboard-accessible @ file menu, retain plain-text persistence, and keep responsive and inline-script parse coverage green.
