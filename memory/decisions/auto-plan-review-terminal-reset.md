---
type: Decision
title: Auto plan review resets runtime state
description: The recorded terminal auto plan review is the durable boundary that returns auto mode and the Work surface to a completed manual state.
status: accepted
date: 2026-07-21
tags: [auto-mode, plan-review, runtime-state, dashboard]
files: ["lib/write.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "test/write.test.mjs", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
timestamp: 2026-07-21T09:00:21.635Z
---

## Decision

Treat a successful agent-authored `record-plan-review` as the durable terminal boundary for an automatic run. It clears auto runtime ownership before the next driver tick; manual plan reviews retain their existing state.

The extension then converges idempotently: it restores any role model once, clears only its own Work overlay, and refreshes from server-derived state. A completed plan remains available for explicit retirement rather than being retired automatically.

## Rationale

Persisting the terminal reset at the review-recording boundary prevents a finishing agent turn or refresh race from leaving the dashboard stuck on “Auto: plan-review”. Keeping the extension as a convergence layer preserves `lib/status.mjs` as the lifecycle authority and avoids browser-local state inference.

# Retired plan

Condensed from plan "Finish auto mode after plan review" (1 features, archived under /features/archive/2026-07-20-auto-plan-review-terminal-reset/).

Token usage: 2040732 in / 21484 out / 15654400 cache-read / 0 cache-write over 75 turns (per-step breakdown in the archived usage.md).
