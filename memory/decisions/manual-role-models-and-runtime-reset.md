---
type: Decision
title: Apply role models to manual turns and reset stale runtime state
description: Manual Iterator role commands temporarily select configured models, while approved plans and terminal auto runs reset runtime state deterministically.
status: accepted
date: 2026-07-17
tags: [models, workflow, runtime-state, pi]
files: ["lib/write.mjs", "extensions/iterator.js", "lib/pi-tools.mjs", "test/write.test.mjs", "test/pi-tools.test.mjs", "test/extension-model-lifecycle.test.mjs"]
timestamp: "2026-07-20T13:33:09.768Z"
---

## Decision

Parse exact manual Iterator commands into planner, implementer, tester, reviewer, or plan-reviewer roles without changing usage attribution. Before a manual turn starts, apply that role's configured model and restore the user's prior model at turn end; automatic runs and fixed feature waves retain their existing role-model ownership.

Approved plan creation resets runtime state to manual and idle, clearing active feature, strikes, and escalation. A completed automatic run likewise returns to manual mode, while pause and escalation paths remain explicitly paused auto states.

## Consequences

A role switch only arms restoration after `pi.setModel` succeeds. Failed or unavailable configured models leave the current model and its credentials untouched; `active` never calls `pi.setModel`. Manual role ownership is FIFO across overlapping starts and ends, so each role input is consumed by one agent turn and only that successful turn can restore the prior model.

Extension lifecycle tests cover failed tester-to-implementer handoffs, one-time restoration after a successful override, and `active` no-switch behavior. Parser coverage verifies exact command handling and plan-review precedence; writer coverage verifies approved resets and draft preservation.
