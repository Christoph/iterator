---
type: Pattern
title: Agent-reviewed memory writes
description: Memory files are written only after browser approval; feedback loops revise drafts without touching disk.
tags:
  - memory
  - review
  - workflow
files:
  - skills/okf-init/SKILL.md
  - skills/okf-consolidate/SKILL.md
  - skills/okf-memorize/SKILL.md
  - lib/views/memory-review.mjs
  - skills/iterator/write.mjs
timestamp: 2026-07-06T19:11:28.964Z
---

# Pattern

The agent drafts memory cards, sends them to the memory-review UI, and writes files only after `review-approved`. If the server returns `review-feedback`, revise the commented cards and general note, increment the round, and invoke the server again. Write nothing mid-loop.

`review-approved` decisions control what reaches disk via the `apply-review` op: accepted create/update cards are written, rejected cards are discarded, keep cards stay untouched, and delete verdicts remove existing concept files. The writer then regenerates indexes, appends `memory/log.md`, and validates the bundle. The bash path applies server-side (`apply: true` + onSubmit); the pi path applies via `okf_write` after the round — both funnel into the same op.

This pattern applies to init, consolidate, memorize, and Knowledge-view-triggered memory drafting.
