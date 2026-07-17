---
type: Plan
title: Apply role models on manual turns and reset stale auto state
description: Use configured role models for manual skill commands and prevent automatic runtime state from leaking into the next plan.
status: approved
branch: iterator/always-available-backlog
created: 2026-07-17
timestamp: "2026-07-17T17:50:46.427Z"
plan_reviewed: 2026-07-17
---

# Goal

Fix manual iterator skill turns so they temporarily use their configured planner, implementer, tester, reviewer, or plan-reviewer model and usage accurately reflects that model. Prevent stale automatic runtime state from dispatching implementation after a new plan and feature set are approved, while preserving deliberate auto-mode behavior.

# Architecture

- Extend `architecture/package-and-skill-layout` with a pure command-to-role parser in `lib/pi-tools.mjs`; leave usage attribution's public shape unchanged and cover exact plan-review precedence.
- Extend the Pi extension lifecycle: capture a role at input, apply it before a manual agent turn, and restore the user's original model at the end of that manual turn. Existing auto and feature-wave paths retain ownership of their role application.
- Centralize new-plan runtime reset in `lib/write.mjs`'s approved-plan path, then reset terminal auto runs in the extension; state transitions remain deterministic writer operations under `architecture/workflow-state-ownership`.
- Synchronize changed root shared libraries into the shipped hub copy and cover model routing, plan-state reset, and explicit auto-mode behavior with the existing node:test suites.

# Dependencies

(none)

# Key decisions

# Features

* [Reset runtime state for approved plans](/features/reset-plan-runtime-state.md) - Start each approved plan in a manual, idle runtime state so stale auto mode cannot dispatch work.
* [Apply configured models to manual turns](/features/apply-role-models-manual-turns.md) - Run manual iterator commands with their configured role model and restore the user's model afterward.

# Plan review

## 2026-07-17 _(agent review: openai-codex/gpt-5.6-sol)_

## Finding

- **Architecture — promised lifecycle coverage is incomplete.** The plan says the existing `node:test` suites will cover model routing and explicit auto-mode behavior, but `test/pi-tools.test.mjs` only exercises the pure `roleFromInput()` parser and `test/write.test.mjs` only exercises approved/draft plan resets. No test drives the `extensions/iterator.js` hooks to prove manual `before_agent_start` model application, `agent_end` restoration before `kickAuto()`, auto/feature-wave exclusion, or the terminal auto-run reset to `mode: manual`. The implementation delivers those paths, but this architectural verification commitment remains unfulfilled.

Goal coverage otherwise appears complete: approved plans deterministically reset stale state, drafts preserve it, completed auto runs return to manual mode, exact manual commands select the configured role (including `plan_reviewer` precedence), and the previous model is restored before automatic dispatch resumes. No unexplained scope drift, TODOs, pending features, or unaccepted features were found.
