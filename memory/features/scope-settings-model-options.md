---
type: Feature
title: Scope settings model options
description: Only offer models available to the current Pi session scope in settings selectors.
status: implemented
size: small
depends_on: []
files: ["extensions/iterator.js", "lib/views/settings.mjs", "test/settings.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/package-and-skill-layout, decisions/iterator-dashboard-feature-workflow, decisions/settings-close-returns-to-work, setup/install-and-command-surface]
timestamp: "2026-07-17T08:04:58.218Z"
tags: []
commits:
  - sha: 1d8fb9d3337c008db42dbf7630bb31f65cd5c943
    kind: implement
    date: 2026-07-17
---

# Implementation notes

Replace the registry-wide options feed with the session-scoped model source, retain the active choice and handling for saved unlisted values, and cover unavailable-model behavior.

# Snippets

```js
const models = lastCtx?.modelRegistry?.getAll?.() || [];\nconst out = models.map((m) => ({ id: `${m.provider}/${m.id}`, label: `${m.provider}/${m.id}` }));
```

# Blast radius

Settings rendering and Pi extension model-registry integration.
