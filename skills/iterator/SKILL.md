---
name: iterator
description: Open the iterator dashboard — a browser home screen showing the plan, every chunk with status/size/test badges, and the dependency graph, with per-chunk Test / Implement / Review buttons. Dispatches the chosen action into the matching iterator flow and reopens the dashboard afterwards. Use when the user types /iterator, wants an overview of plan/chunk state, or wants to drive the flow from one place.
---

# iterator (hub)

The home screen of the flow: **plan → chunk → (optional red tests) → implement
→ review**. One dashboard shows where everything stands; the user picks a
chunk and an action instead of remembering which skill comes next. This skill
is a **thin router** — it gathers state, opens the dashboard, and dispatches
into the existing per-step flows. It never duplicates their steps.

This skill folder also owns the shared tooling every step skill calls:
`server.mjs`, the **single UI server for every step** (the browser control
plane, incl. the Knowledge and memory-review views); `gather.mjs`, the
deterministic state gatherer
(`--step hub|plan|chunk|implement|memorize|range|knowledge|test|review`); and
`write.mjs`, the deterministic bundle writer (ops
`plan|chunks|design|update-chunk|adjustments|memorize|apply-review|refresh-format|retire-plan|accept-commit|record-review`
on stdin — UI results pipe in verbatim; every mechanical consequence of a
user decision happens in code, never in the model). The bundle carries a
**knowledge side** next to the plan/chunks (the five okf areas +
`last_memorized_commit`, managed by the `/okf*` skills): the writer preserves
each side's root-index content when regenerating the other's, and the
`memorize` step/op let `/iterator-implement` keep the knowledge areas current
as chunks land. The step skills are logic-only: they gather via script, add the
semantic text, pipe to the server, and record results via script — the model
never hand-authors frontmatter, indexes, or the log. The server runs
single-instance on a fixed port (default `7777`, `$ITERATOR_PORT`) — a
lingering server from an earlier run is shut down and replaced, so the
dashboard URL never changes (and a sandbox only ever needs to forward 7777).

## When to use this skill

When the user types `/iterator`, asks for an iterator overview / dashboard, or
wants to drive the flow from one place.

If the user's message contains a hub result payload (`action`, `cancel`,
`timeout`), process it per step 2.

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below:
`iterator_ui { step: "hub" }` gathers the payload itself, shows the view in
the session dashboard (one persistent browser tab — no per-round server), and
returns the user's answer. The steps, result payloads, and dispatch rules are
unchanged. The dashboard also stays clickable while you are idle — a user
click arrives as a new `/skill:iterator-*` turn, which you handle per the
target skill.

## Steps

### 1. Gather state and open the dashboard

Both are mechanical and fully scripted — do **not** read bundle files or run
git yourself to assemble the payload. From anywhere inside the project:

```sh
node <skill-dir>/gather.mjs | node <skill-dir>/server.mjs
```

`gather.mjs` resolves the bundle (`<git-root>/memory` or
`$ITERATOR_MEMORY_DIR`), reads the plan and chunk frontmatter, and computes
per chunk `hasDiff` (working-tree diff vs the chunk's `files` globs) and
`hasCommits` (recorded `commits` or the `Chunk: <slug>` trailer). It prints
the complete `step:"hub"` payload; with no bundle it prints `"plan": null`
(the UI shows a Create-plan hero). Pass an explicit project path as its first
argument only when the shell's cwd is not inside the target repo.

The UI renders the plan bar (status, progress, **Revise plan** / **Re-chunk**),
the dependency graph (with cycle warning), and one card per chunk with 🔴/🟢
test badges and three buttons — **Implement** (enabled only when pending and
all `depends_on` are done), **Test** (always; labeled "Test (red)" on pending
chunks), **Review** (enabled when `hasDiff || hasCommits`). There is no header
primary; the card buttons are the actions.

### 2. Dispatch the action

The server prints one JSON line. For
`{ "type": "action", "action": "...", "chunk": "<slug>|null" }`, dispatch:

| action | run |
|---|---|
| `plan` | the `/iterator-plan` flow (create or revise) |
| `chunk` | the `/iterator-chunk` flow (re-chunk; preserves done chunks) |
| `test` | the `/iterator-test` flow for that chunk — it picks red/green mode from the chunk's `status` itself |
| `implement` | the `/iterator-implement` flow pinned to that chunk |
| `review` | the `/iterator-review` flow for that chunk |
| `retire` | the plan-retirement flow (below) — shown only when every chunk is done |

Follow the target skill's own SKILL.md from its first step — do not restate
its logic here. **Re-validate before acting**: the dashboard can be stale, so
`implement` must still check the chunk's `depends_on` are all `done` (the
target flow does this; let it). If a dispatched action is invalid by the time
it arrives, report why and reopen the dashboard.

For `{ "type": "cancel" }` / `{ "type": "timeout" }`: stop and print a short
state summary (done/total, next ready chunk).

### 3. Retire the plan (action `retire`, or the user asks)

A finished plan is knowledge, not a dead work item. When every chunk is done
(the dashboard shows a **Retire plan** button; verify with `--step hub` that
`progress.done === progress.total`), condense it:

1. Read the plan and its chunks (they are about to be archived) and write the
   **semantic** condensation yourself: what was built, why, and the key
   trade-offs — a durable `decisions/` concept, not a play-by-play.
2. Pipe the op; everything mechanical (the decisions concept via the memorize
   machinery, archiving `plan.md` + `chunks/*.md` to
   `memory/chunks/archive/<created>-<slug>/`, root-index cleanup, log,
   validation) happens in the writer:

```sh
node <skill-dir>/write.mjs << 'RETIRE'
{ "op": "retire-plan",
  "concept": { "slug": "<kebab-slug>", "title": "...", "description": "one line",
               "body": "# What was built\n…\n\n# Why\n…\n\n# Key trade-offs\n…",
               "tags": [], "files": [] } }
RETIRE
```

`files` defaults to the union of the chunks' files (the anchors that let
future implement/review rounds surface this decision). The op refuses when
chunks are not all done (`force: true` overrides, e.g. abandoning a plan).
Confirm with the user before retiring — it clears the Work side. Afterwards
report the concept id and archive path; the next `/iterator-plan` starts
fresh.

### 4. Loop

When the dispatched flow finishes — success, feedback resolved, or the user
declined — re-run the gather-and-serve pipeline (step 1). The dashboard is
the resting point between actions; one-shot round trips, no long-running
server.

## Relationship to the other skills

- This skill routes; `/iterator-plan`, `/iterator-chunk`, `/iterator-test`,
  `/iterator-implement`, `/iterator-review` do the work and stay directly
  invocable without the hub.
- State lives in the `memory/` bundle; the dashboard renders only what the
  chunk files say (`memory/format.md` is the schema).
