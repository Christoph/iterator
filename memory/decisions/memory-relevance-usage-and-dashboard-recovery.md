---
type: Decision
title: Memory relevance, usage costs, and dashboard recovery
description: Iterator now bounds implementation context, keeps knowledge/retirement changes reviewed, prices usage only from project-owned rates, and maintains an authoritative active-work dashboard state.
status: accepted
date: 2026-07-19
tags: [knowledge, usage, retirement, dashboard, workflow]
files: ["lib/gather.mjs", "lib/write.mjs", "lib/settings.mjs", "lib/session-server.mjs", "lib/views/planning.mjs", "lib/views/usage.mjs", "extensions/iterator.js", "skills/iterator-consolidate/SKILL.md", "skills/iterator/SKILL.md"]
timestamp: 2026-07-19T07:33:00.058Z
---

## Outcome

Feature implementation contracts now select one deterministic, capped set of relevant memories. Consolidation exposes uncapped attachment pressure, dangling references, and shared-anchor signals for reviewed repair rather than silently mutating knowledge. Plan retirement can optionally require the existing reviewed memorization lifecycle before archival.

Usage retains its raw token ledger and can additionally apply explicit project-owned USD-per-million rates by provider/model and token category. Costs remain unavailable when any needed rate is absent; Iterator never fetches or guesses provider prices.

The persistent dashboard now starts plan-less projects in a usable Planning surface and keeps the Work overlay tied to an owned agent lifecycle through refreshes, reconnects, navigation, stale endings, and interactive submissions.

## Decisions and trade-offs

The final memory cap is eight across stored references and fresh anchor matches, ranked deterministically by area priority and relevance. Consolidation findings remain advisory and all knowledge mutations continue through reviewed writers. Retirement memorization is default-off to preserve the existing direct flow. Working-state authority lives in the session server, while the extension preserves ownership tokens so only the matching agent completion can release an active overlay.

# Retired plan

Condensed from plan "Improve memory relevance, usage costs, and dashboard recovery" (6 features, archived under /features/archive/2026-07-18-memory-relevance-usage-and-dashboard-recovery/).

Token usage: 7258862 in / 79920 out / 48783872 cache-read / 0 cache-write over 301 turns (per-step breakdown in the archived usage.md).
