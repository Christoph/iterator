---
type: Plan
title: Hub UI, red/green testing, and commit tracking
description: Add a /iterator dashboard hub, make per-feature red/green testing first-class, record commits per feature, and support Docker-sandbox hosting.
status: approved
branch: main
created: 2026-07-05
timestamp: 2026-07-05T15:05:00Z
---

# Goal

Make the iterator flow driveable from one place and close the test-loop gaps:

1. A new `/iterator` **hub skill** opens a dashboard showing the plan, all
   features with status/size/test badges, and the dependency graph; the user
   picks a feature and presses **Test** / **Implement** / **Review** instead of
   remembering which skill to run next.
2. **Red/green testing** becomes first-class: `/iterator-test` on a pending
   feature writes intentionally-failing (red) tests from the feature's contract and
   commits them; `/iterator-implement` uses those tests as its goal and only
   offers Accept-and-commit when they are green.
3. Features record their **commits** (test + implement shas, plus the existing
   `Feature: <slug>` trailer) so `/iterator-review` can review already-committed
   features instead of falling back to an empty `git diff HEAD`.
4. A dev bind option (`ITERATOR_HOST`) lets the UI servers listen on `0.0.0.0`
   so the flow works inside a Docker sandbox with the browser on the host; the
   default port moves from 8888 to **7777**.

# Architecture

- **Hub = router, not replacement.** `skills/iterator/` is a sixth skill on the
  shared shell (`lib/server.mjs` + `lib/ui.mjs`, bundled by `npm run sync`).
  Its server renders the dashboard and emits one action payload
  (`{ "type": "action", "action": "test|implement|review|plan|feature", "feature": "<slug>" }`);
  the SKILL.md dispatches into the existing per-step flows, then re-opens the
  dashboard when the action completes. The five existing skills stay directly
  invocable and standalone.
- **State stays in the OKF bundle.** New feature frontmatter fields `tests`,
  `tests_status` (`none|red|green`), and `commits` (sha + kind + date) carry
  the test/commit state. The dashboard, `features/index.md`, and the review UI
  all render from these fields; no new state store.
- **One-shot round trips are kept.** The dashboard closes when an action is
  chosen and reopens afterwards — no long-running server, no progress channel.
- **Recorded shas are an optimization; the `Feature: <slug>` commit trailer is
  the resilient source of truth** (shas go stale on rebase/amend; the trailer
  survives).
- **`ITERATOR_HOST` lives in the shared `lib/server.mjs`** so all six skills
  inherit it via sync. The per-run token stays mandatory in all modes; only the
  localhost Host-header check is relaxed when a non-default bind is requested.

# Dependencies

* None — the plugin remains dependency-free (Node built-ins only).

# Key decisions

- `status` stays binary (`pending|done`); `tests_status` carries the red/green
  nuance separately, so an implemented-but-red feature is representable without
  complicating the done-ownership rule.
- The implement sha cannot live inside the commit it points to (the feature file
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

# Features

* [Schema: tests + commits fields](/features/schema-tests-commits.md) - Add tests, tests_status, and commits frontmatter to the Feature schema and define the test badge in features/index.md.
* [Dev bind host for Docker](/features/expose-bind-host.md) - ITERATOR_HOST env var lets the shared server bind 0.0.0.0 for Docker sandboxes, and the default port moves from 8888 to 7777.
* [Red mode for iterator-test](/features/test-red-mode.md) - iterator-test writes intentionally-failing contract tests for pending features, commits them, and records tests/tests_status/commits in the feature file.
* [Green gate for iterator-implement](/features/implement-green-gate.md) - iterator-implement runs a feature's tests as its goal, only offers Accept-and-commit when green, shows a test badge in the commit-mode UI, and records the implement commit.
* [Review committed features](/features/review-committed-diffs.md) - iterator-review builds the diff from recorded commits (or the Feature trailer) when the working tree is clean and the feature is done.
* [Hub dashboard UI](/features/hub-dashboard-ui.md) - New skills/iterator/server.mjs renders the plan + feature dashboard (cards, badges, dependency graph, action buttons) and emits one action payload.
* [Hub dispatch skill](/features/hub-dispatch.md) - skills/iterator/SKILL.md reads the bundle, opens the dashboard, and routes the chosen action into the existing per-step flows, reopening the hub afterwards.
* [Docs refresh](/features/docs-refresh.md) - README and ARCHITECTURE describe the six-skill flow with the hub, red/green testing, commit tracking, and the Docker bind option.
* [OKF gather staleness and range accuracy](/features/okf-gather-staleness-range.md) - Make Knowledge staleness honor glob anchors and make /iterator-memorize ignore memory-only bookkeeping commits.
* [OKF writer invariants](/features/okf-writer-invariants.md) - Enforce apply-review pointer and knowledge-area invariants so memory approvals cannot skip future memorize coverage or create unsupported areas.
* [Commit review memory-card readability](/features/commit-memory-reviewability.md) - Make commit-mode memory proposals readable enough for human approval and refresh the README documentation for the safer OKF flow.
