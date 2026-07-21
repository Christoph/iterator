---
type: Feature
title: Reject unusable role models at save time
description: Saving a role model that cannot work in the current session is refused with a named reason instead of failing later as a provider 401.
status: implemented
size: medium
depends_on: []
files: ["lib/pi-tools.mjs", "extensions/iterator.js", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/auto-plan-review-terminal-reset, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-21T20:14:13.764Z"
tags: []
commits:
  - sha: 55864983c4afdd284d23f08d4027ddc4f10f88c7
    kind: implement
    date: 2026-07-21
  - sha: fca031b80aa87378faa82debe943ea53a92cee45
    kind: implement
    date: 2026-07-21
---

# Implementation notes

Add a pure policy helper in lib/pi-tools.mjs beside resolveRoleModel that classifies a configured '<provider>/<id>' against the session registry list and the active runtime model: usable (matches active/restorable runtime object), listed-but-different-route (registry has it, but the provider differs from the active runtime provider), or unknown (not in the registry at all). Keep it structural — compare identity and the registry/runtime route metadata only. Never probe a provider and never special-case a credential sentinel. Wire it into saveSettings in extensions/iterator.js: classify every *_model value before the write op runs, and on a non-usable verdict notify with the offending key, the configured value, and the closest listed alternative, then abort without writing. Extend the existing source-assertion tests in test/extension-model-lifecycle.test.mjs and add unit coverage for the classifier in test/pi-tools.test.mjs.

# Snippets

```js
// lib/pi-tools.mjs — beside resolveRoleModel
export function classifyRoleModel(spec, activeModel, available) {
  const identity = parseModelSpec(spec);
  // -> { ok, reason, suggestion }
}
```

# Blast radius

Settings saves from the dashboard modal and the settings step; no runtime role-switch behavior changes.
