---
type: Feature
title: Scoped dashboard action protocol
description: Submit only the data each dashboard action needs and keep Knowledge navigation free of a redundant close control.
status: done
size: medium
depends_on: []
files: ["lib/session-server.mjs", "lib/ui.mjs", "lib/views/hub.mjs", "lib/views/knowledge.mjs", "lib/views/plan.mjs", "lib/views/feature.mjs", "lib/views/review.mjs", "lib/views/settings.mjs", "test/session-server.test.mjs", "test/ui.test.mjs", "test/knowledge-controls.test.mjs"]
timestamp: "2026-07-15T11:46:52.081Z"
tags: []
done: 2026-07-15
---

# Implementation notes

Define action-specific request schemas and client builders so review feedback, plan controls, and other element-driven operations do not serialize unrelated page state. Route actions through the session dispatcher with operation lifecycle updates, remove the Knowledge page Close action, retain Settings close as a navigation action, and cover submitted payload shape plus busy/error transitions.

# Depends on

* [Visible dashboard operation state](/features/dashboard-operation-state.md)

# Blast radius

All browser-to-agent/server actions and the dashboard’s idle and working-state behavior.
