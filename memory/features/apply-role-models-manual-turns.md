---
type: Feature
title: Apply configured models to manual turns
description: "Run manual iterator commands with their configured role model and restore the user's model afterward."
status: implemented
size: medium
depends_on: [reset-plan-runtime-state]
files: ["lib/pi-tools.mjs", "extensions/iterator.js", "test/pi-tools.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port, decisions/settings-close-returns-to-work, setup/install-and-command-surface]
timestamp: "2026-07-17T17:48:49.621Z"
tags: []
commits:
  - sha: 4b007e50016e5de9014a296b26749fe9dc063f48
    kind: implement
    date: 2026-07-17
  - sha: c7157f5b89a8b3464ecd4f849849bf7d794d8121
    kind: implement
    date: 2026-07-17
reviewed: 2026-07-17
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

# Review

## 2026-07-17
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — `extensions/iterator.js` returns from `before_agent_start` when `bundleExists(ctx.cwd)` is false before applying `pendingRole`, so manual `/iterator-plan` turns in a fresh or retired project never use `planner_model`. Apply the manual role (using gathered/default settings) before the bundle-only ambient-context early return, while preserving the auto/feature-wave guards and restoration order.
