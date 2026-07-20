---
type: Plan
title: Persist budget prices across plans
description: Keep project-owned model prices after retirement and reuse them in future budget views.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-20
timestamp: 2026-07-20T17:48:20.851Z
---

# Goal

Make model prices saved in the Budget/Usage view durable project configuration: saved rates must survive plan retirement, prefill later plans and plan-less sessions, continue driving cost calculations, and remain replaceable or removable from the same editor.

# Architecture

- Move the canonical model-price catalog out of the active plan ledger and into persistent project settings under `memory/settings.md`, extending the validated settings/writer path rather than introducing a hidden database, consistent with `decisions/okf-markdown-bundle`.
- Keep `memory/usage.md` as the active plan’s raw token ledger and store a price snapshot with it for reproducible retired-plan cost reports; active usage calculations consume the current persistent catalog, while archived usage continues to use its historical snapshot.
- Extend the deterministic usage-price save path so one complete-table update validates rates once, persists the project catalog, updates the active usage snapshot when present, and supports clearing or replacing rates atomically.
- Update usage gathering so Budget is usable with no active plan or ledger, loads persisted prices for future sessions, and provides a compatibility fallback from an existing usage price table when the new catalog has not yet been established.
- Keep the Budget editor within `memory/design.md`: prefill persisted values, retain add/update/remove behavior and explicit save feedback, and clarify that rates are project-wide and reused across plans.
- Develop canonical behavior in root `lib/`, synchronize shipped skill copies with `npm run sync`, and cover settings validation, usage gathering/writing, retirement snapshots, extension refresh, and browser rendering in tests per `architecture/package-and-skill-layout` and `decisions/synced-droppable-skill-libs`.

# Dependencies

(none)

# Key decisions

- `memory/settings.md` is the source of truth for live project prices because it survives plan retirement; `memory/usage.md` keeps a snapshot so archived costs never change retroactively.
- Saving from Budget replaces the complete project price table, including allowing an empty table to clear saved rates; partial row fields remain valid but costs stay unavailable when a required token-category rate is missing.
- Iterator continues to use only user-entered project rates and never fetches or guesses provider pricing, preserving `decisions/memory-relevance-usage-and-dashboard-recovery`.
- Existing active-plan prices remain readable as a compatibility fallback until the persistent catalog is first saved; migration must not silently select conflicting historical archive prices.
- Price persistence is project-level configuration but remains edited in Budget rather than exposing raw serialized data in the general Settings form.
- Add no external dependencies and do not change raw token accounting or feature attribution.

# Features

* [Persist budget prices across plans](/features/persistent-budget-prices.md) - Budget saves a project-wide model price table that survives retirement, prefills later plans, and remains updateable or clearable.
