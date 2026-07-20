---
type: Feature
title: Use Agent wording in workflow views
description: Interactive plan, feature, review, memory, and question views consistently address the provider-neutral Agent.
status: done
size: small
depends_on: [review-exact-red-test-source, agent-neutral-shell-copy]
files: ["lib/views/plan.mjs", "lib/views/feature.mjs", "lib/views/review.mjs", "lib/views/memory-review.mjs", "lib/views/question.mjs", "lib/views/widgets.mjs", "test/agent-copy.test.mjs"]
memories: [patterns/agent-reviewed-memory-writes, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/review-navigation-and-work-context, decisions/streamline-backlog-planning-and-knowledge-actions]
timestamp: "2026-07-20T16:50:56.611Z"
tags: []
commits:
  - sha: 9544c699b49cb5926e8749b10607b05838e0adc0
    kind: implement
    date: 2026-07-20
done: 2026-07-20
---

# Implementation notes

Replace generic Claude wording in the remaining canonical root workflow views, including hints, placeholders, confirmations, feedback submission messages, and default action helper text. Do not alter explicit Claude Code integration documentation or model/provider identifiers. The red-test view is completed by the prerequisite feature, and shared shell copy by its other prerequisite, so this slice should leave no user-facing generic Claude labels in canonical interactive surfaces. Add a regression check covering the canonical views and continue to rely on `npm run sync` for shipped copies.

# Snippets

```js
post(buildFeedbackObj(), 'Review sent to Claude');
```

```js
return post({ type:'action', action: act, feature: feature || null, prompt: prompt || null }, msg || 'Sent to Claude');
```

# Depends on

* [Review exact red test source](/features/review-exact-red-test-source.md)
* [Use Agent wording in the dashboard shell](/features/agent-neutral-shell-copy.md)

# Blast radius

Copy is spread across all interactive approval and feedback surfaces; missing one occurrence would leave inconsistent actor naming.
