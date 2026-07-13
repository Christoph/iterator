---
name: iterator
description: Open the iterator dashboard — a browser home screen showing the plan, every chunk with status/size/test badges, and the dependency graph, with per-chunk Test / Implement / Review buttons. Dispatches the chosen action into the matching iterator flow and reopens the dashboard afterwards. Use when the user types /iterator, wants an overview of plan/chunk state, or wants to drive the flow from one place.
---

# iterator (hub)

The home screen of the flow: **plan → chunk → (optional red tests) → implement
→ review**. One dashboard shows where everything stands; the user picks a
chunk and an action instead of remembering which skill comes next. This skill
is a **thin router** — it opens the dashboard and dispatches into the existing
per-step flows. It never duplicates their steps.

This skill folder also owns the shared tooling every step skill calls:

- `server.mjs` — the one UI server for every step (browser control plane).
  Pipe a step payload in, read one JSON result line back. It also accepts the
  **one-command request form** `{"gather":true,"step":"<step>","chunk":...,
  "extra":{...}}`: the server gathers the step payload itself and merges your
  small agent-authored `extra` on top, so most flows need no gather|server
  pipe. Single-instance on a fixed port (default `7777`, `$ITERATOR_PORT`).
- `gather.mjs` — deterministic state
  (`--step hub|plan|chunk|implement|memorize|range|knowledge|test|review|session|settings|usage|archive`).
- `write.mjs` — deterministic bundle writer. `--schema` lists ops,
  `--schema <op>` prints an op's payload shape; errors come back as
  `{ok:false, error, hint}` — fix the payload and re-pipe, never write bundle
  files by hand.

Every mechanical consequence of a user decision happens in code, never in the
model: step skills gather via script, add the semantic text, pipe to the
server, and record results via script — the model never hand-authors
frontmatter, indexes, or the log. The bundle also carries a **knowledge side**
next to plan/chunks (the five okf areas + `last_memorized_commit`, managed by
the `/okf*` skills).

**pi mode:** see `<skill-dir>/PI.md`.

## When to use this skill

When the user types `/iterator`, asks for an iterator overview / dashboard, or
wants to drive the flow from one place. If the user's message contains a hub
result payload (`action`, `cancel`, `timeout`), process it per step 2.

## Steps

### 1. Open the dashboard

One command — do **not** read bundle files or run git yourself:

```sh
echo '{"gather":true,"step":"hub"}' | node <skill-dir>/server.mjs
```

Add `"project":"<path>"` only when the shell's cwd is not inside the target
repo. With no bundle the dashboard shows a Create-plan hero.

### 2. Dispatch the action

The server prints one JSON line. An action result carries the owning skill:
`{ "type": "action", "action": "...", "chunk": "<slug>|null",
"skill": "<skill-name>" }` — follow that skill's SKILL.md from its first
step; do not restate its logic here. (`skill: "iterator"` = the retire flow,
step 3.) **Re-validate before acting**: the dashboard can be stale — the
target flow re-checks its own preconditions (let it); if the action is
invalid by the time it arrives, report why and reopen the dashboard.

`cancel` / `timeout` results carry a human `report` string — relay it, print
a short state summary (done/total, next ready chunk), and stop.

Two navigation actions stay inside this skill instead of dispatching:

- `{ "action": "view-archive", "chunk": "<archive-name>" }` → open the
  read-only retired-plan browser:
  `echo '{"gather":true,"step":"archive","chunk":"<archive-name>"}' | node <skill-dir>/server.mjs`
  When its result is `{ "action": "hub" }`, reopen the dashboard (step 1).
- The **token usage** view works the same way when the user asks for it:
  `echo '{"gather":true,"step":"usage"}' | node <skill-dir>/server.mjs`
  (read-only; per-step × model token counts for the active plan).

### 3. Retire the plan (action `retire`, or the user asks)

A finished plan is knowledge, not a dead work item. When every chunk is done,
condense it:

1. Read the plan and its chunks (they are about to be archived) and write the
   **semantic** condensation yourself: what was built, why, and the key
   trade-offs — a durable `decisions/` concept, not a play-by-play.
2. Pipe `{ "op": "retire-plan", "concept": { slug, title, description, body,
   tags, files } }` into `node <skill-dir>/write.mjs`. Everything mechanical
   (the decisions concept, archiving `plan.md` + `chunks/*.md`, root-index
   cleanup, log, validation) happens in the writer. `files` defaults to the
   union of the chunks' files. The op refuses when chunks are not all done
   (`force: true` overrides, e.g. abandoning a plan).

Confirm with the user before retiring — it clears the Work side. Afterwards
report the concept id and archive path; the next `/iterator-plan` starts
fresh.

### 4. Loop

When the dispatched flow finishes — success, feedback resolved, or declined —
reopen the dashboard (step 1). It is the resting point between actions.
