---
type: Feature
title: Show unusable model choices in settings
description: The settings model fields visibly mark a value the current session cannot use, and say so when the registry is unavailable.
status: implemented
size: small
depends_on: [validate-role-model-on-save]
files: ["lib/views/settings.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, decisions/code-exact-red-test-review-and-agent-wording, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/review-navigation-and-work-context, decisions/settings-close-returns-to-work]
timestamp: "2026-07-21T20:17:54.385Z"
tags: []
---

# Implementation notes

lib/views/settings.mjs renders supplied state only — take the per-key verdict from the payload and never re-derive it in the client. Mark an unusable selection on the option and the row so it reads before saving, extending the existing '(unlisted)' affordance around line 159. When MODELS is null (Array.isArray guard at line 97) the field falls back to a free-text input at line 166; label that fallback so it cannot be mistaken for a validated dropdown. Cover the rendering in test/ui.test.mjs and keep the client script parseable per pitfalls/client-js-template-literal-escaping (test/client-js-parse.test.mjs).

# Snippets

```js
// lib/views/settings.mjs:97 — a Promise fails this guard and silently degrades
const MODELS = Array.isArray(D.models) ? D.models : null;
```

# Depends on

* [Reject unusable role models at save time](/features/validate-role-model-on-save.md)

# Blast radius

Settings view rendering only.
