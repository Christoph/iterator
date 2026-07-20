---
type: Feature
title: Settings dashboard modal
description: Open project Settings as a modal above any dashboard tab and return to the exact originating context on save or close.
status: implemented
size: medium
depends_on: [active-plan-workspace]
files: ["lib/session-server.mjs", "lib/views/settings.mjs", "extensions/iterator.js", "test/session-server.test.mjs", "test/ui.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review]
conflicts: "[{\"decision\":\"decisions/settings-close-returns-to-work\",\"note\":\"The accepted plan replaces forced Work restoration with modal dismissal back to whichever tab and round opened Settings.\"}]"
timestamp: "2026-07-20T14:35:15.984Z"
tags: []
---

# Implementation notes

Promote Settings from a Work-tab iframe document to shell-owned modal state. The gear and `/iterator-settings` must display it immediately regardless of the active tab, without replacing stored tab HTML, cancelling a pending plan/review round, or clearing the Work ownership overlay. Serve/render the existing settings form inside a modal frame or dedicated modal endpoint under `session-server`; post saves through the existing deterministic settings callback. Close and successful save should dismiss the modal and reveal the same originating tab and round. Cover navigation from Planning, Work, Knowledge, and Usage, including while Work is blocked, responsive sizing, focus/close behavior, and reconnect replay. Keep settings persistence unchanged and sync root libraries.

# Snippets

```js
// Current behavior maps settings into Work and can leave other tabs unchanged.
if (["planning", "plan", "feature", "archive"].includes(step)) return "planning";
return "work";
```

```js
session.showView({
  step: 'settings',
  render: () => VIEWS.settings(payload),
});
```

# Depends on

* [Active plan workspace](/features/active-plan-workspace.md)

# Blast radius

Persistent dashboard shell navigation, pending interactive rounds, Work overlay ownership, and every Settings open/save/close path.

# Decision conflicts

* [decisions/settings-close-returns-to-work](/decisions/settings-close-returns-to-work.md) — The accepted plan replaces forced Work restoration with modal dismissal back to whichever tab and round opened Settings.
