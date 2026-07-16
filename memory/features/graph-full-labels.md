---
type: Feature
title: Shared dependency graph with full labels
description: Extract the SVG dependency graph into lib/views/graph.mjs with auto-width nodes so labels are never truncated; hub and feature views consume it; wide graphs scroll horizontally per design.md.
status: implemented
size: small
depends_on: []
files: ["lib/views/graph.mjs", "lib/views/hub.mjs", "lib/views/feature.mjs", "scripts/sync.mjs", "test/ui.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/synced-droppable-skill-libs, setup/development-commands]
timestamp: "2026-07-16T09:58:02.381Z"
tags: []
tests: ["test/ui.test.mjs"]
tests_status: green
---

# Implementation notes

Truncation source: clip(c.name,20) + fixed NW=150 in hub.mjs:557,581-595 and feature.mjs:104,136,150. nodeW = max(90, ceil(label.length*7.25)+24); per-level column width = max node width in that level; edges anchor at each node's own right edge; label = (done?'✓ ':'')+name with clip() removed. Export GRAPH_CSS and GRAPH_JS strings; views concatenate. Add graph.mjs to the VIEWS list in scripts/sync.mjs.

# Blast radius

Graph rendering in hub and feature views only; payload shapes unchanged.
