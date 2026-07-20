---
type: Decision
title: Persist budget prices across plans
description: Project-owned Budget rates now persist across plans while active and archived cost reports remain reproducible.
status: accepted
date: 2026-07-20
tags: [usage, budget, settings, pricing]
files: ["lib/settings.mjs", "lib/gather.mjs", "lib/write.mjs", "lib/views/usage.mjs", "test/settings.test.mjs", "test/write.test.mjs"]
timestamp: 2026-07-20T18:10:37.683Z
---

## Outcome

Budget model rates are now durable project configuration in `memory/settings.md`. They prefill plan-less and later usage sessions, can be replaced or cleared only through Budget, and never rely on fetched or guessed provider prices.

Active `memory/usage.md` ledgers inherit and snapshot the live catalog for their calculations. Retired ledgers retain their snapshots, so later price updates cannot rewrite historical archive costs. Legacy active-ledger rates remain a fallback only until a project catalog is explicitly saved.

## Key trade-offs

The catalog is a hidden structured setting rather than a general Settings control: the validated Budget save path updates both project configuration and any active-ledger snapshot, registers settings in the bundle index, and prevents generic settings writes from bypassing that synchronization. Root library changes are synchronized into the droppable skill copies and covered by regression tests.

# Retired plan

Condensed from plan "Persist budget prices across plans" (1 features, archived under /features/archive/2026-07-20-persistent-budget-prices/).

Token usage: 2277953 in / 33313 out / 18532864 cache-read / 0 cache-write over 98 turns (per-step breakdown in the archived usage.md).
