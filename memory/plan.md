---
type: Plan
title: Hub UI, red/green testing, and commit tracking
description: Add a /iterator dashboard hub, make per-chunk red/green testing first-class, record commits per chunk, and support Docker-sandbox hosting.
status: approved
branch: main
created: 2026-07-05
timestamp: 2026-07-05T15:05:00Z
---

# Goal

Make the iterator flow driveable from one place and close the test-loop gaps:

1. A new `/iterator` **hub skill** opens a dashboard showing the plan, all
   chunks with status/size/test badges, and the dependency graph; the user
   picks a chunk and presses **Test** / **Implement** / **Review** instead of
   remembering which skill to run next.
2. **Red/green testing** becomes first-class: `/iterator-test` on a pending
   chunk writes intentionally-failing (red) tests from the chunk's contract and
   commits them; `/iterator-implement` uses those tests as its goal and only
   offers Accept-and-commit when they are green.
3. Chunks record their **commits** (test + implement shas, plus the existing
   `Chunk: <slug>` trailer) so `/iterator-review` can review already-committed
   chunks instead of falling back to an empty `git diff HEAD`.
4. A dev bind option (`ITERATOR_HOST`) lets the UI servers listen on `0.0.0.0`
   so the flow works inside a Docker sandbox with the browser on the host; the
   default port moves from 8888 to **7777**.

# Architecture

- **Hub = router, not replacement.** `skills/iterator/` is a sixth skill on the
  shared shell (`lib/server.mjs` + `lib/ui.mjs`, bundled by `npm run sync`).
  Its server renders the dashboard and emits one action payload
  (`{ "type": "action", "action": "test|implement|review|plan|chunk", "chunk": "<slug>" }`);
  the SKILL.md dispatches into the existing per-step flows, then re-opens the
  dashboard when the action completes. The five existing skills stay directly
  invocable and standalone.
- **State stays in the OKF bundle.** New chunk frontmatter fields `tests`,
  `tests_status` (`none|red|green`), and `commits` (sha + kind + date) carry
  the test/commit state. The dashboard, `chunks/index.md`, and the review UI
  all render from these fields; no new state store.
- **One-shot round trips are kept.** The dashboard closes when an action is
  chosen and reopens afterwards — no long-running server, no progress channel.
- **Recorded shas are an optimization; the `Chunk: <slug>` commit trailer is
  the resilient source of truth** (shas go stale on rebase/amend; the trailer
  survives).
- **`ITERATOR_HOST` lives in the shared `lib/server.mjs`** so all six skills
  inherit it via sync. The per-run token stays mandatory in all modes; only the
  localhost Host-header check is relaxed when a non-default bind is requested.

# Dependencies

* None — the plugin remains dependency-free (Node built-ins only).

# Key decisions

- `status` stays binary (`pending|done`); `tests_status` carries the red/green
  nuance separately, so an implemented-but-red chunk is representable without
  complicating the done-ownership rule.
- The implement sha cannot live inside the commit it points to (the chunk file
  is part of that commit); it is written in the next bundle update. Lookup
  never depends on it thanks to the trailer.
- Red-mode success = tests **fail on assertions/missing exports**, not on
  test-file syntax errors; green mode keeps today's behavior.
- Hub button enablement encodes the process rules: Implement only when all
  `depends_on` are done, Test always, Review only when a diff or recorded
  commits exist.
- `ITERATOR_HOST` is dev-only and loudly warned about on stderr; combined with
  `ITERATOR_NO_OPEN=1` it is the documented Docker recipe.

# Product fit

This is the direct continuation of the project's thesis: keep the unit of
change human-reviewable. The hub removes the "which skill do I run next"
friction, red/green makes the optional TDD branch visible exactly where the
decision is made, and commit tracking makes review possible after the fact —
all without abandoning the standalone-skill portability story.

# Chunks

* [Schema: tests + commits fields](/chunks/schema-tests-commits.md) - New chunk frontmatter fields and index badge format
* [Dev bind host for Docker](/chunks/expose-bind-host.md) - ITERATOR_HOST=0.0.0.0 support; default port becomes 7777
* [Red mode for iterator-test](/chunks/test-red-mode.md) - Contract-based failing tests for pending chunks, committed + recorded
* [Green gate for iterator-implement](/chunks/implement-green-gate.md) - Tests as the implementation goal; test badge in the commit-mode UI
* [Review committed chunks](/chunks/review-committed-diffs.md) - Diff from recorded commits / Chunk trailer when the tree is clean
* [Hub dashboard UI](/chunks/hub-dashboard-ui.md) - skills/iterator server: cards, badges, graph, empty state
* [Hub dispatch skill](/chunks/hub-dispatch.md) - SKILL.md routing actions into the existing flows
* [Docs refresh](/chunks/docs-refresh.md) - README + ARCHITECTURE for the six-skill flow
