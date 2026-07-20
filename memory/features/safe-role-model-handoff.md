---
type: Feature
title: Safe role-model handoff
description: Keep the active managed model usable when a tester or implementer role override is unavailable, so red-test completion can hand off to implementation without an OpenAI credential error.
status: implemented
size: medium
depends_on: []
files: ["extensions/iterator.js", "test/extension-model-lifecycle.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-20T13:31:30.159Z"
tags: []
---

# Implementation notes

Reproduce the exact manual lifecycle through mocked Pi hooks: `/iterator-test` input, `before_agent_start`, failed or unavailable `pi.setModel`, `agent_end`, then `/iterator-implement`. In `extensions/iterator.js`, consume the pending role per turn and distinguish an attempted switch from a successful switch. Do not arm `preAutoModel` or invoke restoration unless `pi.setModel` returned success; keep thinking-level handling independent. Cover `active` settings as a strict no-`setModel` path, a failed explicit tester override followed by implementation, a successful override restoring once, and stale-role isolation. Preserve the same behavior for automatic/wave roles and do not alter environment variables or red-test artifacts.

# Snippets

```js
const applyRole = async (role, settings) => {
  const spec = roleModelSpec(settings, role);
  // Current bug seam: preAutoModel is armed before setModel reports success.
  const ok = await pi.setModel(model);
};
```

```js
pi.on("before_agent_start", async (_event, ctx) => {
  if (pendingRole && state?.mode !== "auto" && !featureWave) {
    await applyRole(pendingRole, settings);
    manualRoleActive = true;
  }
});

pi.on("agent_end", async (_event, ctx) => {
  if (manualRoleActive) await restoreModel();
});
```

# Blast radius

Manual Iterator role commands plus auto-mode and ready-wave model transitions; incorrect restoration can affect the provider credentials used by every subsequent agent turn.
