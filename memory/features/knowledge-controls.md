---
type: Feature
title: Reliable Knowledge controls
description: Make memory modals dismiss reliably and route every Knowledge-tab action to its working skill or handler.
status: pending
size: medium
depends_on: [feature-test-recording]
files: ["lib/views/knowledge.mjs", "skills/iterator/lib/views/knowledge.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "test/ui.test.mjs", "test/pi-tools.test.mjs", "test/sync.test.mjs", "test/knowledge-controls.test.mjs"]
memories: [architecture/package-and-skill-layout, patterns/safe-browser-rendering, decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs, setup/development-commands, setup/install-and-command-surface]
tests: ["test/knowledge-controls.test.mjs"]
tests_status: green
timestamp: 2026-07-14T11:31:19.800Z
tags: []
---

# Implementation notes

Audit all data-action values emitted by the Knowledge view against actionToCommand and the extension’s idle dispatcher. Keep close local to the modal, add regression coverage for close controls and Consolidate/Memorize command routing, then sync packaged view copies.

Implemented: the modal close is an explicit `type="button"` with `aria-label="Close memory"`, wired purely client-side (X, backdrop, Escape) — it never posts to the server. Every emitted data-action routes: skills (iterator-init/consolidate/memorize), /iterator-knowledge actions (draft-memory, draft-memory-prompt, update-memory, refresh-format), design → /iterator-design; the page-level Close is handled deterministically by the extension (back to Work, mirroring decisions/settings-close-returns-to-work). A routing-audit regression parses the rendered view for data-action values and asserts each has a route.

# Snippets

```js
document.getElementById('m-close').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.modal) closeModal(); });
```

```js
const OKF_SKILLS = ['iterator-init', 'iterator-consolidate', 'iterator-memorize'];
```

# Depends on

* [Record tests for feature contracts](/features/feature-test-recording.md)

# Blast radius

Knowledge browsing, OKF skill dispatch, and the packaged iterator hub.
