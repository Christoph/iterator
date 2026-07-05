---
type: Chunk
title: Hub dashboard UI
description: New skills/iterator/server.mjs renders the plan + chunk dashboard (cards, badges, dependency graph, action buttons) and emits one action payload.
status: done
size: medium
lines_estimate: 190
depends_on: [schema-tests-commits]
files: ["skills/iterator/server.mjs", "skills/iterator/lib/*", "scripts/sync.mjs", "test/server.test.mjs"]
timestamp: 2026-07-05T14:45:00Z
done: 2026-07-05
tags: [skill, ui, hub]
---

# Implementation notes

New `skills/iterator/server.mjs` on the shared shell (`readPayload()` +
`serve()` + `renderPage()` — same structure as the other five servers):

- **Payload in:** `{ step: "hub", branch, plan: { title, status } | null,
  progress: { done, total }, chunks: [{ name, title, description, status,
  size, testsStatus, dependsOn, hasDiff, hasCommits }] }`. The SKILL.md (next
  chunk) computes `hasDiff`/`hasCommits`; the server only renders.
- **Dashboard:** plan header with status + progress bar; chunk cards in
  dependency order showing status (✅/⬜), size color, 🔴/🟢 tests badge
  (hidden for `none`), and `depends_on` chips. Reuse the dependency-graph
  rendering approach from `skills/iterator-chunk/server.mjs` (read it first —
  lift, don't reinvent).
- **Action buttons per card:** **Test** (always), **Implement** (enabled only
  when `status: pending` and every dependency is done), **Review** (enabled
  when `hasDiff || hasCommits`). Disabled buttons carry a tooltip naming the
  blocker (e.g. "waiting on: config-module"). Plan-level buttons: **Revise
  plan**, **Re-chunk**.
- **Empty state:** `plan: null` renders "No plan yet" with a single **Create
  plan** button.
- **Payload out (one line, then exit — standard round trip):**
  `{ "type": "action", "action": "test|implement|review|plan|chunk", "chunk": "<slug>|null" }`,
  plus the standard `cancel`/`timeout`. Buttons use `addEventListener` +
  closures, never inline `on*` strings (existing rule).
- The hub is read-only — no editing in this UI; primary button is not needed
  (actions are the buttons), keep **Cancel** and theme toggle from the shell.
- Add `'iterator'` to `SERVER_SKILLS` in `scripts/sync.mjs` and run
  `npm run sync` (the drift test in `test/sync.test.mjs` is COPIES-driven and
  picks it up automatically).

# Snippets

```js
// action button → one-line result, same contract as every other server
btn.addEventListener('click', () =>
  post({ type: 'action', action: 'implement', chunk: c.name }));
```

# Depends on

* [Schema: tests + commits fields](/chunks/schema-tests-commits.md) — renders the `tests_status` badge and commit-derived Review enablement.

# Blast radius

New skill folder only — no existing server changes. If the estimate creeps past
~200 lines despite lifting the graph code, split card/graph rendering from the
action wiring before implementing.
