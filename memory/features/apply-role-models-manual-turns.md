---
type: Feature
title: Apply configured models to manual turns
description: "Run manual iterator commands with their configured role model and restore the user's model afterward."
status: pending
size: medium
depends_on: [reset-plan-runtime-state]
files: ["lib/pi-tools.mjs", "extensions/iterator.js", "test/pi-tools.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port, decisions/settings-close-returns-to-work, setup/install-and-command-surface]
timestamp: "2026-07-17T17:35:23.410Z"
tags: []
---

# Implementation notes

Add a pure exact command-to-role parser beside attribution utilities without changing `attributionFromInput()` results. Capture the parsed role for every input (clearing it for non-role inputs), apply it before manual agent starts when state is not auto, and restore the saved model at manual agent end before `kickAuto()`. Leave auto and feature-wave role ownership unchanged; plan-review must resolve to plan_reviewer, and the known thinking-level restoration limitation remains unchanged.

# Snippets

```js
export function attributionFromInput(text) {\n  const m = String(text || '').trim().match(/^\\/(?:skill:)?([a-z-]+)/);\n  // Preserve this return shape; roleFromInput is a separate parser.\n}\n\nexport function roleModelSpec(settings, role) {\n  return { model, thinking };\n}
```

# Depends on

* [Reset runtime state for approved plans](/features/reset-plan-runtime-state.md)

# Blast radius

Pi input, before-agent-start, and agent-end lifecycle hooks; configured-model usage rows and automatic/feature-wave model restoration.
