---
type: Feature
title: Hub dispatch skill
description: skills/iterator/SKILL.md reads the bundle, opens the dashboard, and routes the chosen action into the existing per-step flows, reopening the hub afterwards.
status: done
size: medium
lines_estimate: 120
depends_on: [hub-dashboard-ui, test-red-mode, implement-green-gate, review-committed-diffs]
files: ["skills/iterator/SKILL.md", ".claude-plugin/plugin.json"]
timestamp: 2026-07-05T14:55:00Z
done: 2026-07-05
tags: [skill, hub]
---

# Implementation notes

New `skills/iterator/SKILL.md` (auto-discovered like the others; verify
nothing in `.claude-plugin/plugin.json` needs touching):

- **Gather state:** resolve the bundle (git root + `ITERATOR_MEMORY_DIR`), read
  `plan.md` frontmatter and `features/index.md`, then each feature's frontmatter
  (status, size, `tests_status`, `depends_on`, `commits`). Compute per feature:
  `hasDiff` (any working-tree change matching the feature's `files` globs) and
  `hasCommits` (recorded `commits` or a `Feature: <slug>` trailer hit). No
  bundle at all → payload with `plan: null`.
- **Open the dashboard** (heredoc → `skills/iterator/server.mjs`, standard
  round trip).
- **Dispatch table** for `{ type: "action" }`:
  - `plan` → run the `/iterator-plan` flow (create or revise).
  - `feature` → run the `/iterator-feature` flow (re-feature).
  - `test` → run the `/iterator-test` flow for that feature (red mode if
    pending, green if done — the flow itself decides).
  - `implement` → run the `/iterator-implement` flow, pinned to that feature
    (its dependency check still applies and wins over the UI's enablement —
    the dashboard could be stale).
  - `review` → run the `/iterator-review` flow for that feature.
  Follow each flow's own SKILL.md; do not duplicate its steps here — reference
  them ("proceed as /iterator-test defines from step 3").
- **Loop:** when the dispatched flow finishes (success, feedback-resolved, or
  user-declined), re-gather state and re-open the dashboard. `cancel`/`timeout`
  from the hub itself ends the session with a short state summary.
- Frontmatter description: trigger on `/iterator`, "show the iterator
  dashboard", or the user wanting an overview of plan/feature state.
- Skill-side validation mirrors the UI rules (never implement a feature whose
  deps aren't done, even if asked via a stale dashboard).

# Depends on

* [Hub dashboard UI](/features/hub-dashboard-ui.md) — the server this skill drives.
* [Red mode for iterator-test](/features/test-red-mode.md) — Test on a pending feature must mean red mode.
* [Green gate for iterator-implement](/features/implement-green-gate.md) — Implement must honor tests-as-goal when dispatched.
* [Review committed features](/features/review-committed-diffs.md) — Review on a done feature must find its commits.

# Blast radius

The hub re-enters every other flow; a dispatch that half-duplicates a flow's
steps will drift from it. Keep this skill a thin router — state gathering,
one table, one loop.
