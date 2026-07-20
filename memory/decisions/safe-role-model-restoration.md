---
type: Decision
title: Safely restore configured Iterator role models
description: Only successfully switched role models are restored, so failed provider changes cannot corrupt the active session credentials.
status: accepted
date: 2026-07-20
tags: [models, credentials, workflow, regression]
files: ["extensions/iterator.js", "test/extension-model-lifecycle.test.mjs"]
timestamp: 2026-07-20T13:37:19.997Z
---

## Outcome

Iterator now treats manual role-model selection as a turn-scoped operation. A configured tester or implementer override that cannot be used leaves the active session model untouched, preventing a red-test-to-implementation handoff from falling onto an invalid provider credential path.

## Decision

Arm restoration only after `pi.setModel` succeeds. The `active` setting never invokes model switching, and each input role is consumed by exactly one agent turn. Track successful manual role changes in FIFO lifecycle order so an overlapping follow-up cannot restore another turn's model.

## Verification

The extension lifecycle suite covers failed override handoff, one-time restoration after a successful override, and active-model no-switch behavior. The full test suite remains green; the lifecycle cases skip only in environments without the optional `typebox` peer dependency.

# Retired plan

Condensed from plan "Fix post-test role model credential corruption" (1 features, archived under /features/archive/2026-07-20-safe-role-model-restoration/).

Token usage: 603657 in / 16114 out / 5499904 cache-read / 0 cache-write over 67 turns (per-step breakdown in the archived usage.md).
