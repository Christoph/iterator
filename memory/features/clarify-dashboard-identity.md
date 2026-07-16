---
type: Feature
title: Clarify dashboard identity
description: Show the current project folder and planning context prominently in the dashboard header.
status: done
size: small
depends_on: []
files: ["lib/ui.mjs", "lib/session-server.mjs", "lib/views/planning.mjs", "lib/views/hub.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs]
timestamp: "2026-07-16T15:03:36.822Z"
tags: []
done: 2026-07-16
commits:
  - sha: a5d59c50453e568ec486a3c9c017c2506898700e
    kind: implement
    date: 2026-07-16
---

# Implementation notes

Derive the display identity from the active working directory in the shared shell payload; render the contextual iterator./planning heading without altering session protocol or lifecycle state.

# Snippets

```js
return renderPage({ step: "hub", subtitle: "/ work", branch: data.branch, title: data.plan && data.plan.title, data, ... });
```

# Blast radius

All session dashboard views share the page shell, so title changes must preserve plan and Work rendering.
