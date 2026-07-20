---
type: Feature
title: Use Agent wording in the dashboard shell
description: Shared dashboard status, submission, cancellation, and working messages refer to the active coding Agent rather than Claude.
status: done
size: small
depends_on: []
files: ["extensions/iterator.js", "lib/server.mjs", "lib/ui.mjs", "lib/session-server.mjs", "test/server.test.mjs", "test/session-server.test.mjs", "test/extension-model-lifecycle.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, architecture/package-and-skill-layout, patterns/one-json-line-server-results, patterns/safe-browser-rendering, decisions/backlog-planning-and-feature-waves, decisions/focus-feature-execution-and-dashboard-ownership]
timestamp: "2026-07-20T16:17:55.849Z"
tags: []
commits:
  - sha: 3854fc7cc6ffd5de8f64868c3dc56c2747a1c78c
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Replace only generic human-facing actor labels in the shared server completion page, shell client alerts/buttons, persistent-session working status, and extension dispatch status. Preserve Claude Code product names, CLI commands, plugin manifests, provider/model IDs, and internal compatibility identifiers. Add focused assertions for default completion copy, shell text, pending-round status, and extension dispatch where existing harnesses cover them. Develop root libraries only; `npm run sync` owns shipped copies.

# Snippets

```js
export function doneHtml(msg = 'Sent to Claude') {
```

```js
session.showWorking(`Dispatched ${cmd} — Claude is working…`);
```

# Blast radius

Shared completion and working-state copy appears across every browser workflow and Pi dashboard dispatch.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: shared shell, completion, pending-round, and dispatch messages consistently use Agent, with synced copies and focused regression coverage.
