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

## Steps

### 1. Check existing state

```sh
node <skill-dir>/../iterator/gather.mjs --step plan
```

It reports whether a plan `exists` (with its sections pre-parsed for
revising) and whether `legacy` `PLAN.md`/`CHUNKS.md` files exist — do **not**
read bundle files or run git yourself.

**If `exists`**, use `AskUserQuestion` (header `Plan`): "Use the existing
plan" (skip to step 3 with the gathered sections pre-filled) vs. "Create a
new plan" (continue, overwriting on approval).

**If `legacy` files exist but no bundle**, offer a one-time migration with
`AskUserQuestion` (header `Migrate`): "Migrate into memory/ bundle" (parse
the old files into `plan.md` + one chunk file each) vs. "Start fresh". Never
silently delete the legacy files.

### 2. Ask for the goal

Planning happens **before** code is written. Use `AskUserQuestion` for a
single free-text question: *"What are you building and why? (1–3 sentences)"*
(header `Goal`). Then silently read `ARCHITECTURE.md` if present; only raise
a follow-up if the goal clearly diverges from documented architecture or
implies a new dependency / product-fit question worth confirming.

### 3. Draft the plan and open the review UI

Draft the four sections and the dependency list, then serve them — the
server gathers the base payload itself and merges your draft (`extra`) on
top. (The server ships with the `/iterator` hub skill; if that folder is
missing, tell the user to install the full iterator plugin and stop.)

```sh
node <skill-dir>/../iterator/server.mjs << 'PLAN_DATA'
{ "gather": true, "step": "plan",
  "extra": {
    "title": "<plan title>",
    "plan": { "goal": "...", "architecture": "...", "keyDecisions": "...", "productFit": "..." },
    "dependencies": ["<pkg-or-service> — <why>"] } }
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
  "sections": { "goal": "...", "architecture": "...", "keyDecisions": "...", "productFit": "..." },
  "dependencies": ["<pkg> — <why>"] }
PLAN_WRITE
```

On `{ "ok": false, "error": ..., "hint": ... }` fix the payload and re-pipe
(`--schema plan` prints the shape) — never write bundle files by hand.

### 6. Continue

Continue straight into `/iterator-chunk` to break the plan into chunks. If
chunking is unavailable, tell the user: "Plan saved to `memory/plan.md`. Run
`/iterator-chunk` to break it into chunks."
