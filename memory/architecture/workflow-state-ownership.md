---
type: Architecture
title: Centralized workflow state rules
description: lib/status.mjs owns feature transitions, dependency readiness, and derived plan stages; gather computes them and views render the supplied state.
tags:
  - workflow
  - state
  - views
files:
  - lib/status.mjs
  - lib/gather.mjs
  - lib/write.mjs
  - lib/views/hub.mjs
  - lib/views/planning.mjs
timestamp: 2026-07-16T11:35:44.449Z
---

# Structure

`lib/status.mjs` is the single source of truth for feature and plan lifecycle behavior. It defines valid feature statuses and transitions, dependency satisfaction, per-feature readiness, and the plan's derived stage.

`lib/write.mjs` uses these rules to validate mutations, while `lib/gather.mjs` calculates `ready`, `waitingOn`, and `stage` once for the payload. Browser views must render those supplied values rather than reconstructing lifecycle state from raw statuses. This keeps the Work and Planning surfaces consistent.

# Extension guidance

When adding a lifecycle state or changing dependency semantics, update `lib/status.mjs` and its tests first, then consume the derived fields in gathering and views. Do not add view-local state derivation.
