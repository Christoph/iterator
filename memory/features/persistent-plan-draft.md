---
type: Feature
title: Persistent Work plan draft
description: Provide a larger plan-goal input that preserves unsent text when users switch dashboard tabs.
status: pending
size: small
depends_on: []
files: ["lib/views/hub.mjs", "skills/iterator/lib/views/hub.mjs", "test/ui.test.mjs", "test/sync.test.mjs"]
memories: [patterns/safe-browser-rendering, decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs, setup/development-commands]
tests: ["test/ui.test.mjs"]
tests_status: green
timestamp: "2026-07-14T11:21:44.431Z"
tags: []
---

# Implementation notes

Persist only the unsent hero textarea value in browser storage, restore it when the Work iframe re-renders, and clear it after Plan or Initialize memory is chosen. Increase the input within saved design spacing and responsive rules; add view-level coverage and sync its packaged copy.

Implemented: the goal box saves to `localStorage` under `iterator:plan-goal-draft:<branch>` on input/blur, restores on view creation, and clears only once the plan/init action was actually accepted by the server (`__submitted` still true after post). Input grew to min-height 132px / max-width 640px inside the saved design parameters.

# Snippets

```js
const goal = document.createElement('textarea');
goal.className = 'goal';
goal.placeholder = 'What are you building and why?';
```

# Blast radius

New-plan entry on the Work dashboard.
