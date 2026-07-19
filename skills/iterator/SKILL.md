---
name: iterator
description: Open the iterator dashboard — a browser home screen showing the plan, every feature with status/size/test badges, and the dependency graph, with per-feature Test / Implement / Review buttons. Dispatches the chosen action into the matching iterator flow and reopens the dashboard afterwards. Use when the user types /iterator, wants an overview of plan/feature state, or wants to drive the flow from one place.
---

# iterator (hub)

The home screen of the flow: **plan → feature → (optional red tests) → implement
→ review**. One dashboard shows where everything stands; the user picks a
feature and an action instead of remembering which skill comes next. This skill
is a **thin router** — it opens the dashboard and dispatches into the existing
per-step flows. It never duplicates their steps.

This skill folder also owns the shared tooling every step skill calls:

- `server.mjs` — the one UI server for every step (browser control plane).
  Pipe a step payload in, read one JSON result line back. It also accepts the
  **one-command request form** `{"gather":true,"step":"<step>","feature":...,
  "extra":{...}}`: the server gathers the step payload itself and merges your
  small agent-authored `extra` on top, so most flows need no gather|server
  pipe. Single-instance on a fixed port (default `7777`, `$ITERATOR_PORT`).
- `gather.mjs` — deterministic state
  (`--step hub|planning|plan|feature|implement|memorize|range|knowledge|test|review|plan-review|retire|session|settings|usage|archive`).
- `write.mjs` — deterministic bundle writer. `--schema` lists ops,
  `--schema <op>` prints an op's payload shape; errors come back as
  `{ok:false, error, hint}` — fix the payload and re-pipe, never write bundle
  files by hand.

Every mechanical consequence of a user decision happens in code, never in the
model: step skills gather via script, add the semantic text, pipe to the
server, and record results via script — the model never hand-authors
frontmatter, indexes, or the log. The bundle also carries a **knowledge side**
next to plan/features (the five OKF areas + `last_memorized_commit`, managed by
the `/iterator-knowledge*` skills).

**pi mode:** see `<skill-dir>/PI.md`.

**Claude Code mode:** Do not open the Pi dashboard/server. Use the documented
`gather.mjs` and `write.mjs` commands directly; dispatch only the skill named
by the gathered action and return its outcome in chat.

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
repo. The hub is the **Work** surface (progress, escalation, per-feature
Test / Implement / Review). Plan management — the idea/bug backlog, plan
creation/revision/retirement, the dependency graph, feature cancellation —
lives on the **planning** surface, same command with `"step":"planning"`
(with no bundle it shows the Create-plan hero; both render from the same
gather payload).

### 2. Dispatch the action

The server prints one JSON line. An action result carries the owning skill:
`{ "type": "action", "action": "...", "feature": "<slug>|null",
"skill": "<skill-name>" }` — follow that skill's SKILL.md from its first
step; do not restate its logic here. (`skill: "iterator"` = the retire flow,
step 3.) **Re-validate before acting**: the dashboard can be stale — the
target flow re-checks its own preconditions (let it); if the action is
invalid by the time it arrives, report why and reopen the dashboard.

`cancel` / `timeout` results carry a human `report` string — relay it, print
a short state summary (done/total, next ready feature), and stop.

Navigation actions stay inside this skill instead of dispatching:

- `{ "action": "planning" }` → open the planning surface:
  `echo '{"gather":true,"step":"planning"}' | node <skill-dir>/server.mjs`
- `{ "action": "view-archive", "feature": "<archive-name>" }` → open the
  read-only retired-plan browser:
  `echo '{"gather":true,"step":"archive","feature":"<archive-name>"}' | node <skill-dir>/server.mjs`
  When its result is `{ "action": "hub" }`, reopen the dashboard (step 1).
- The **token usage** view works the same way when the user asks for it:
  `echo '{"gather":true,"step":"usage"}' | node <skill-dir>/server.mjs`
  (read-only; per-step × model token counts for the active plan).

### 3. Retire the plan (action `retire`, or the user asks)

A finished plan is knowledge, not a dead work item. When every feature is done,
condense it:

1. Run `node <skill-dir>/gather.mjs --step retire` — it returns the plan's
   sections plus condensed per-feature summaries (title, description, status,
   files, review notes), `filesUnion`, and the `memorize` retirement gate; that
   payload is your whole context — do not read the plan or feature files
   wholesale.
2. When `memorize.enabled` and `memorize.required` are both true, complete the
   existing `/iterator-memorize` skill before retirement, using
   `memorize.range` as its already-gathered range payload. This is a normal
   reviewed memory round: show draft cards, honor feedback/approval, and advance
   only to the reviewed `range.head`. Cancel/timeout stops retirement and leaves
   the plan intact. Afterwards gather `retire` again; continue only when
   `memorize.required` is false. Never bypass the gate or advance the pointer
   without review. When the setting is off, skip this step exactly as today.
3. Write the **semantic** condensation yourself from the gathered plan: what was
   built, why, and the key trade-offs — a durable `decisions/` concept, not a
   play-by-play. Pipe `{ "op": "retire-plan", "concept": { slug, title,
   description, body, tags, files } }` into `node <skill-dir>/write.mjs`.
   Everything mechanical (the decisions concept, archiving `plan.md` +
   `features/*.md`, root-index cleanup, log, validation) happens in the writer.
   `files` defaults to the union of the features' files. The op refuses when
   features are not all done (`force: true` overrides, e.g. abandoning a plan)
   or when the enabled memorize gate still has unreviewed commits.

The dashboard's Retire click (a two-step armed button) IS the confirmation —
proceed directly to the condensation and the retire-plan write; **never ask
again in the CLI** (no questions, no AskUserQuestion). Afterwards report the
concept id and archive path; the next `/iterator-plan` starts fresh.

### 4. Loop

When the dispatched flow finishes — success, feedback resolved, or declined —
reopen the dashboard (step 1). It is the resting point between actions.
