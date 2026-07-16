---
type: Feature
title: Explain empty reviews instead of dead-ending
description: "When a non-done feature has no working-tree diff and no recorded commits, the hub and review flows say why (work likely committed outside the flow / wrong root) and what to do, instead of a bare 'working tree is clean'."
status: implemented
size: small
depends_on: []
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/app.mjs", "test/steps.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow]
timestamp: "2026-07-16T10:16:39.131Z"
tags: []
tests: ["test/steps.test.mjs"]
tests_status: green
---

# Implementation notes

Repro: implement a feature, commit its changes manually (no Feature: trailer), press Review -> no-changes dead end. gatherReview already returns hasChanges:false; extend the no-changes report (app.mjs zero-change guard + extension equivalent) to name the likely causes: commits made outside accept-commit (check git log for the feature files), or gather rooted in the wrong checkout (plan worktree vs main). Hub: feature cards already carry hasDiff/hasCommits — when status is pending/implemented and both are false while state.phase suggests work happened, badge the card ('no recorded changes') with a tooltip pointing at restart-feature or manual commit attribution.

# Blast radius

Review empty-state path and hub card badges; no writer changes.
