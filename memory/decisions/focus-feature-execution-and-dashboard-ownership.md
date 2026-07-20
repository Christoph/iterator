---
type: Decision
title: Focus feature execution and dashboard ownership
description: Implementation now starts in fresh feature sessions, Work owns active plans, Settings preserves context as a shell modal, and red tests are explicit handoffs.
status: accepted
date: 2026-07-20
tags: [workflow, dashboard, sessions, settings, testing]
files: ["extensions/iterator.js", "lib/pi-tools.mjs", "lib/session-server.mjs", "lib/gather.mjs", "lib/views/hub.mjs", "lib/views/planning.mjs", "lib/views/settings.mjs"]
timestamp: 2026-07-20T14:47:42.230Z
---

# Outcome

Iterator starts each manual, ready-wave, and automatic feature implementation in a fresh Pi session seeded only with the named deterministic feature command and bundle contract. Handoff state preserves fixed-wave and auto safety state without copying prior conversation context.

Work is the complete active-plan surface: it owns progress, dependency graph, feature execution, revision, review, retirement, cancellation, and escalation controls. Planning remains the staged future-work surface for plan creation, backlog, and retired-plan browsing. Intentional plan and feature approval transitions land on Work, while ordinary refreshes preserve the selected tab.

Settings is shell-owned modal state. It opens above any dashboard tab, preserves the underlying tab, pending round, and Work overlay, replays on reconnect, and dismisses back to that exact context after save or close. Red tests are a normal pre-implementation checkpoint: Work names their recorded paths, labels them as intentionally failing, and sends the fresh implementer their status and paths so the next action is explicitly to drive them green.

# Key decisions

- Lifecycle/readiness remain derived once by gather and `lib/status.mjs`; browser views render supplied state.
- Fresh-session routing does not alter review gates, feature-wave snapshots, or commit attribution.
- Settings writes retain the deterministic writer path; modal results never settle the underlying interactive round.
- Shared root libraries are synchronized into shipped skill copies, and client-script parsing remains covered.

# Trade-offs

The persistent shell adds modal delivery and reconnect state, but avoids destructive iframe navigation and keeps interactive review ownership intact. The concise ambient handoff includes only red-test paths needed for the immediate implementation target rather than duplicating the full feature contract.

# Retired plan

Condensed from plan "Focus feature execution and dashboard ownership" (4 features, archived under /features/archive/2026-07-20-focus-feature-execution-and-dashboard-ownership/).

Token usage: 5337452 in / 67475 out / 40762368 cache-read / 0 cache-write over 224 turns (per-step breakdown in the archived usage.md).
