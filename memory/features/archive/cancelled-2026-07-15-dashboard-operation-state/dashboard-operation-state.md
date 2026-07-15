---
type: Feature
title: Visible dashboard operation state
description: Make dashboard tabs and controls accurately show active work, initialization output, and cancellable operations.
status: pending
size: medium
depends_on: [iterator-terminology-migration]
files: ["extensions/iterator.js", "lib/session-server.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/views/knowledge.mjs", "lib/views/settings.mjs", "test/session-server.test.mjs", "test/ui.test.mjs"]
timestamp: "2026-07-15T09:15:49.033Z"
tags: []
---

# Implementation notes

Build a shared session state for active operation, owner tab, progress, and cancellation capability. Place theme beside Settings outside the iterator header; show Cancel only for Settings or an actually cancellable operation. Add Work and Knowledge tab indicators, including progress for active Work and a Knowledge badge when an initialization or knowledge action has produced information there. Ensure the Work hub is restored after knowledge initialization instead of staying blank, and show immediate in-UI busy feedback for every action.

# Depends on

* [Iterator terminology migration](/features/iterator-terminology-migration.md)

# Blast radius

The persistent browser session, tab navigation, action feedback, and every iterator workflow view.
