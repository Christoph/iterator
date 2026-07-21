---
type: Feature
title: Preserve runtime role-model authentication
description: Configured Iterator roles retain Pi’s active runtime model routing and correctly recognize modern void-returning model switches.
status: implemented
size: medium
depends_on: []
files: ["lib/pi-tools.mjs", "extensions/iterator.js", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/auto-plan-review-terminal-reset, decisions/backlog-planning-and-feature-waves, decisions/code-exact-red-test-review-and-agent-wording, decisions/focus-feature-execution-and-dashboard-ownership, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery]
timestamp: "2026-07-21T14:10:29.023Z"
tags: []
commits:
  - sha: dc8a42c454df3c803ddae9b2959cab01abaa004d
    kind: implement
    date: 2026-07-21
---

# Implementation notes

Add pure provider/id identity and role-target resolution helpers in canonical `lib/pi-tools.mjs`. When the configured role model matches `ctx.model`, keep that exact runtime object (or skip a redundant switch) so host proxy/base-URL/auth metadata is not replaced by a registry object. For genuine switches, treat resolved `pi.setModel()` calls returning `undefined` as successful, explicit `false` as legacy failure, and exceptions as failure; arm one-time restoration only after a successful switch. Extend pure helper and extension lifecycle tests, then run `npm run sync` for shipped library copies.

# Snippets

```js
const m = lastCtx?.modelRegistry?.find?.(provider, id);
if (m) {
  const previousModel = preAutoModel || lastCtx?.model || null;
  const ok = await pi.setModel(m);
  if (ok) { /* arm restoration */ }
}
```

```js
export function roleModelSpec(settings, role) {
  // `active` means leave the current runtime model untouched.
}
```

# Blast radius

Manual role turns, automatic role handoffs, model restoration, and Settings-selected planner/tester/implementer/reviewer models.
