---
type: Plan
title: Improve memory relevance, usage costs, and dashboard recovery
description: "Make Iterator's planning, knowledge, usage, retirement, and active-work surfaces more reliable and less noisy."
status: approved
branch: iterator/always-available-backlog
created: 2026-07-18
timestamp: 2026-07-18T06:52:21.216Z
---

# Goal

Deliver the supplied backlog improvements: keep feature implementation context limited to the most relevant memories; make consolidation detect stale and over-attached knowledge; optionally calculate model costs in Usage; optionally memorize plan commits during retirement; reliably show active work as blocked; and make a new project's Planning surface usable with a clear initialization path.

# Architecture

- Extend the existing gather-side knowledge selection seam (`architecture/knowledge-lifecycle`) so feature contracts receive one deterministically ranked, bounded memory set rather than an unbounded union of saved and newly matched concepts.
- Build consolidation signals from bundle metadata and feature memory references, then keep all concept mutations in the existing reviewed `apply-review` / `okf_write` path; do not let scanning silently edit knowledge.
- Keep usage aggregation in `memory/usage.md` and expose optional per-model pricing alongside the existing token buckets, so cost calculations remain reproducible without a provider dependency.
- Add retirement behavior through the settings, gather, and deterministic writer contracts; reuse the knowledge lifecycle rather than inventing a second memory-write path.
- Preserve `architecture/browser-server-contract` and `architecture/workflow-state-ownership`: the persistent session server owns working/overlay state, gathering supplies derived state, and Planning/Work render it without local lifecycle inference.
- Update the Planning, Usage, and session-shell UI within `memory/design.md`'s compact dark control-plane parameters, and sync canonical `lib/` changes into shipped skill copies.

# Dependencies

(none)

# Key decisions

- Treat eight as a maximum for the final implementation memory set, not merely the dynamic file-match subset; rank direct feature references and file-anchor matches deterministically by relevance and area priority before inlining bodies.
- Make consolidation review feature-memory fan-out and duplicate/obsolete concepts in addition to file-anchor staleness; it proposes keep/update/merge/delete cards for explicit user approval.
- Use optional, project-owned USD token rates per model and token category (input, output, cache read, cache write); missing rates yield no cost rather than guessed provider pricing.
- Add a default-off retirement setting. When enabled, retirement must use the existing reviewed knowledge/memorize semantics and only advance the memory pointer after the associated write succeeds.
- Make the active-work blocker reflect authoritative session/agent lifecycle events and replay correctly for reconnects, tab switches, and idle view refreshes; retain Planning, Knowledge, and Usage access while Work is blocked.
- A no-plan project must always show Planning's goal box, Create plan action, and prominent Initialize memory action; initialization preserves any entered goal and returns the user to planning.
- Preserve the accepted backlog lifecycle (`decisions/consume-accepted-backlog-ideas`): candidates are consumed only after deterministic plan approval, not while drafting.

# Features

* [Bound feature memory context](/features/bound-feature-memories.md) - Give each implementation contract a deterministic, capped set of the most relevant knowledge concepts.
* [Consolidate over-attached memories](/features/consolidate-overattached-memories.md) - Have knowledge consolidation identify stale, duplicate, and disproportionately attached concepts before proposing reviewed repairs.
* [Memorize retired plan commits](/features/memorize-on-retirement.md) - Optionally route a completed plan's commits through the existing knowledge lifecycle when it is retired.
* [Onboard plan-less projects](/features/onboard-planless-projects.md) - Ensure Planning always offers a working goal, plan, and memory-initialization path in a new project.
* [Price model usage](/features/price-model-usage.md) - Let projects optionally configure token prices per model and show calculated row and aggregate costs in Usage.
* [Keep Work blocked while agents run](/features/reliable-work-blocker.md) - Make the Work overlay accurately follow an active agent through dispatch, navigation, reconnects, and cleanup.
