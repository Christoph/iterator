---
type: Decision
title: Polish dashboard and multi-agent workflows
description: Dashboard polish and workflow refinements that clarify project context, constrain settings to usable models, and support deterministic Claude Code feature execution.
status: accepted
date: 2026-07-17
tags: [dashboard, workflow, claude-code, settings]
files: ["lib/ui.mjs", "lib/session-server.mjs", "lib/views/planning.mjs", "lib/views/hub.mjs", "lib/views/settings.mjs", "extensions/iterator.js", "lib/gather.mjs", "lib/write.mjs", "skills/iterator/SKILL.md", "skills/iterator-implement/SKILL.md", "CLAUDE.md"]
timestamp: 2026-07-17T08:52:58.641Z
---

## What changed

Iterator’s dashboard now presents the active project and planning context more clearly, while Planning keeps backlog and retired-plan content bounded rather than allowing archival lists to expand the page indefinitely. Settings model selectors are limited to models available in the current session scope.

The shared plan and feature records now support a practical Claude Code path: skills consume deterministic gather/write contracts, process one dependency-ready feature at a time, and can commit implementation work without altering Pi’s dashboard-based, user-controlled review and acceptance flow.

## Trade-offs

Pi and Claude Code remain distinct clients. Pi retains its interactive dashboard and explicit acceptance gate; Claude Code uses the same durable workflow state through scripted contracts rather than attempting to recreate the dashboard. Canonical library changes continue to be synchronized into shipped skill copies.

# Retired plan

Condensed from plan "Polish dashboard and multi-agent workflows" (4 features, archived under /features/archive/2026-07-16-polish-dashboard-and-multi-agent-workflows/).

Token usage: 817740 in / 28695 out / 8394752 cache-read / 0 cache-write over 158 turns (per-step breakdown in the archived usage.md).
