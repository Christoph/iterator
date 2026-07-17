---
type: Decision
title: Apply role models to manual turns and reset stale runtime state
description: Manual Iterator role commands temporarily select configured models, while approved plans and terminal auto runs reset runtime state deterministically.
status: accepted
date: 2026-07-17
tags: [models, workflow, runtime-state, pi]
files: ["lib/write.mjs", "extensions/iterator.js", "lib/pi-tools.mjs", "test/write.test.mjs", "test/pi-tools.test.mjs"]
timestamp: 2026-07-17T17:51:38.757Z
---

## Decision

Parse exact manual Iterator commands into planner, implementer, tester, reviewer, or plan-reviewer roles without changing usage attribution. Before a manual turn starts, apply that role's configured model and restore the user's prior model at turn end; automatic runs and fixed feature waves retain their existing role-model ownership.

Approved plan creation resets runtime state to manual and idle, clearing active feature, strikes, and escalation. A completed automatic run likewise returns to manual mode, while pause and escalation paths remain explicitly paused auto states.

## Consequences

Usage rows now reflect the model that executed a manual role command, and stale auto bookkeeping cannot dispatch work into a newly approved plan. Parser coverage verifies exact command handling and plan-review precedence; writer coverage verifies approved resets and draft preservation. The whole-plan review noted that extension lifecycle paths still lack direct hook-level tests.

# Retired plan

Condensed from plan "Apply role models on manual turns and reset stale auto state" (2 features, archived under /features/archive/2026-07-17-manual-role-models-and-runtime-reset/).

Token usage: 2207627 in / 20868 out / 18306048 cache-read / 0 cache-write over 103 turns (per-step breakdown in the archived usage.md).
