---
type: Feature
title: Feature idea backlog
description: Let users save ideas and bugs directly from Work, select them later, and create a plan from the selected candidates.
status: done
size: large
depends_on: [scoped-dashboard-actions]
files: ["lib/bundle.mjs", "lib/gather.mjs", "lib/write.mjs", "lib/session-server.mjs", "lib/views/hub.mjs", "extensions/iterator.js", "memory/backlog/index.md", "test/bundle.test.mjs", "test/gather.test.mjs", "test/write.test.mjs", "test/session-server.test.mjs", "test/ui.test.mjs"]
timestamp: "2026-07-15T12:12:26.309Z"
tags: []
done: 2026-07-15
commits:
  - sha: 7195411615e3c8e5f9007559e5e980db1ed3a5c0
    kind: implement
    date: 2026-07-15
---

# Implementation notes

Introduce an indexed OKF backlog with a deterministic writer API for create, edit, delete, and selection state; validate all client input server-side. Add a Work view list/form for ideas and bugs with immediate save feedback, selection controls, and a plan handoff that turns selected candidates into the initial goal/context while keeping them distinct from active plan features. Define archival or linking behavior once candidates are used, and test direct saves, malformed submissions, selection persistence, and plan handoff.

# Depends on

* [Visible dashboard operation state](/features/dashboard-operation-state.md)
* [Scoped dashboard action protocol](/features/scoped-dashboard-actions.md)

# Blast radius

Work dashboard planning entry, persistent OKF data, and future plan/feature creation.
