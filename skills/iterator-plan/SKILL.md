---
name: iterator-plan
description: Create or revise the plan for a piece of work and store it in an OKF memory/ bundle. Opens an interactive plan-review UI in the browser; on acceptance it writes memory/plan.md and auto-continues into /iterator-chunk to break the plan into chunks. Use when the user types /iterator-plan, wants to plan work, or starts a new piece of work with iterator.
---

# iterator-plan

The first step of the iterator flow: **plan → chunk → implement → review**.
Turns a goal into a structured plan stored as one OKF concept document
(`memory/plan.md`, `type: Plan`; schema in `memory/format.md`). Accepting the
plan immediately continues into `/iterator-chunk` in the same session.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-plan`, wants to plan a piece of work, or is
starting new work with iterator. If the user's message contains a plan-review
result payload from a previous session (`plan-approved` / `plan-feedback` /
`cancel` / `timeout`), process it per step 4 first.

## Asking the user

Every question in this skill goes to the **browser question view first** so a
user watching the dashboard never misses a prompt stuck in the terminal: pipe
`{ "step": "question", "title": "<header>", "question": "...", "options":
[{"label": "...", "description": "..."}], "allowFreeText": true }` into
`node <skill-dir>/../iterator/server.mjs` (pi mode: `iterator_ui` step
`question` with those fields in `extra`) and read the one-line
`{ "type": "answer", "choice", "text" }` result. While it is open, print one
terminal line: "Question waiting in the browser dashboard." Fall back to
terminal `AskUserQuestion` only when the server/dashboard is unavailable —
the option sets below apply to whichever surface asks.

## Steps

### 1. Check existing state

```sh
node <skill-dir>/../iterator/gather.mjs --step plan
```

It reports whether a plan `exists` (with its sections pre-parsed for
revising), whether `legacy` `PLAN.md`/`CHUNKS.md` files exist, whether the
knowledge side is set up (`knowledgeInitialized`), and the project's design
params path (`designFile`) — do **not** read bundle files or run git
yourself.

**If the invocation already carries the goal** (e.g. `/iterator-plan — <goal>`
from the dashboard's goal box, or the user's message states what to build),
ask nothing: skip straight to step 2's silent checks with that goal. A
carried goal always means "create a new plan", even when one `exists`.

**If `exists` and no goal was carried**, use one `AskUserQuestion` round
(header `Plan`): "Use the existing plan" (skip to step 3 with the gathered
sections pre-filled) vs. "Create a new plan" — remind the user they can pick
**Other and type the new goal directly** to skip the follow-up question.

**If `knowledgeInitialized` is false**, recommend running `/okf-init` first
so chunks and implementers get relevant memories (soft gate — offer it, and
continue into planning afterward with the same goal; if the user declines,
proceed and note the writer will record a warning).

**If `legacy` files exist but no bundle**, offer a one-time migration with
`AskUserQuestion` (header `Migrate`): "Migrate into memory/ bundle" (parse
the old files into `plan.md` + one chunk file each) vs. "Start fresh". Never
silently delete the legacy files.

### 2. Ask for the goal (only when still unknown)

Planning happens **before** code is written. If no goal was carried by the
invocation or typed into a previous question's Other field, use
`AskUserQuestion` for a single free-text question: *"What are you building
and why? (1–3 sentences)"* (header `Goal`). Then silently read
`ARCHITECTURE.md` if present; only raise a follow-up if the goal clearly
diverges from documented architecture or implies a new dependency worth
confirming. If the plan touches UI and
`designFile` is set, read it and let the plan reference the project's design
params; if it is null, note that `/iterator-design` should run before
implementation styles anything.

**Consult the recorded knowledge before drafting.** The gather payload's
`knowledge` field carries the bundle's `architecture`, `decisions`, and
`pitfalls` concepts (id, title, description, files, path). Read every entry;
for the architecture concepts the goal touches, read the full bodies at
their `path`. Then:

- The **Architecture section builds on the recorded architecture** — extend
  the real seams, referencing concept ids (`architecture/<slug>`) where the
  plan touches or extends them, instead of inventing a parallel structure.
- The plan must **never silently contradict a decision or ignore a
  pitfall**. Follow each relevant one; where the goal genuinely requires
  deviating, add an explicit Key Decisions bullet naming the concept id and
  the deviation, and tell the user (in chat and in the review round) that
  the deviation must be memorized after acceptance (`/okf-memorize`).

### 3. Draft the plan and open the review UI

Draft the three sections and the dependency list, then serve them — the
server gathers the base payload itself and merges your draft (`extra`) on
top. **Architecture and Key decisions are markdown bullet lists** — one
statement or decision per bullet, so the review reads at a glance; Goal
stays short prose. (The server ships with the `/iterator` hub skill; if that folder is
missing, tell the user to install the full iterator plugin and stop.)

`dependencies` lists **only new external packages, libraries, crates, or
services the plan requires** — `"<name> <version?> — <why>"`, e.g.
`"axum 0.7 — HTTP server"`. It is **never** a todo/task list (work items
belong in the sections and later in chunks). Use an empty list when the plan
needs nothing new.

```sh
node <skill-dir>/../iterator/server.mjs << 'PLAN_DATA'
{ "gather": true, "step": "plan",
  "extra": {
    "title": "<plan title>",
    "plan": { "goal": "...", "architecture": "- ...\n- ...", "keyDecisions": "- ...\n- ..." },
    "dependencies": ["<new-external-pkg-or-service> — <why>"] } }
PLAN_DATA
```

### 4. Process the server output (one JSON line)

- `{ "type": "plan-approved", "sections": {...}, "dependencies": [...] }` →
  write the bundle (step 5), then **auto-continue into `/iterator-chunk`** in
  this session using the approved plan.
- `{ "type": "plan-feedback", ... }` → revise using the edited
  sections/dependencies as the new base, apply each `comments[]` entry and
  the global `comment`, and re-run step 3.
- `cancel` / `timeout` → relay the result's `report` and stop. Write nothing.

### 5. Write the memory/ bundle

Pipe the approved content into the shared writer — it owns everything
mechanical (`format.md` copy, frontmatter, timestamps, `index.md`, `log.md`,
OKF conformance; a re-plan preserves the existing `# Chunks` section):

```sh
node <skill-dir>/../iterator/write.mjs << 'PLAN_WRITE'
{ "op": "plan", "title": "<plan title>", "description": "<one-line summary>",
  "sections": { "goal": "...", "architecture": "- ...\n- ...", "keyDecisions": "- ...\n- ..." },
  "dependencies": ["<new-external-pkg> — <why>"] }
PLAN_WRITE
```

On `{ "ok": false, "error": ..., "hint": ... }` fix the payload and re-pipe
(`--schema plan` prints the shape) — never write bundle files by hand. Relay
any `warnings` in the result to the user (todo-shaped dependencies,
uninitialized knowledge memory).

The writer also handles **branch-per-plan** (settings): approving on
main/master creates `iterator/<plan-slug>` — by default in a **separate git
worktree** (`result.worktree`; the current checkout stays put, the bundle is
copied over). Relay `result.note` verbatim when present: the user must know
where the work now lives. With `worktree_per_plan: off` the branch is checked
out in place (`result.branch`).

### 6. Continue

Continue straight into `/iterator-chunk` to break the plan into chunks. If
chunking is unavailable, tell the user: "Plan saved to `memory/plan.md`. Run
`/iterator-chunk` to break it into chunks."
