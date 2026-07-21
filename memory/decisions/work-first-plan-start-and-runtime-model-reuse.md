---
type: Decision
title: Start plans in Work and reuse runtime models
description: Plan start intentionally lands on Work, while role selection reuses Pi runtime model objects to preserve proxy routing and managed authentication.
status: accepted
date: 2026-07-21
tags: [dashboard, workflow, models, authentication, pi]
files: ["extensions/iterator.js", "lib/pi-tools.mjs", "test/extension-work-activation.test.mjs", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
timestamp: 2026-07-21T14:32:38.766Z
---

## Decision

Starting a plan from Planning is an intentional transition to Work before the planner overlay and dispatch begin. A Work refresh is advisory: if it fails, report the problem but dispatch the requested plan action exactly once.

When a configured role’s provider/id matches Pi’s active or restorable runtime model, reuse that exact object rather than looking up a replacement in the model registry. This preserves host-supplied proxy routing, headers, and managed authentication. Treat a resolved `setModel()` call as successful when it returns `undefined` (the current Pi contract); explicit `false` and thrown errors remain failures that do not arm restoration.

## Rationale

Work owns active plan execution and its agent overlay, so moving there at plan start makes the lifecycle visible without changing ordinary tab persistence. Model identity alone is insufficient when the host attaches request configuration to a runtime model object; reusing that object prevents a managed credential from being sent through an incompatible direct-provider route.

# Retired plan

Condensed from plan "Focus plan starts and preserve managed model authentication" (2 features, archived under /features/archive/2026-07-21-work-first-plan-start-and-runtime-model-reuse/).

Token usage: 1755878 in / 26559 out / 17757184 cache-read / 0 cache-write over 117 turns (per-step breakdown in the archived usage.md).
