---
name: iterator-plan
description: Create or revise the plan for a piece of work and store it in an OKF memory/ bundle. Opens an interactive plan-review UI in the browser; on acceptance it writes memory/plan.md and auto-continues into /iterator-chunk to break the plan into chunks. Use when the user types /iterator-plan, wants to plan work, or starts a new piece of work with iterator.
---

# iterator-plan

The first step of the iterator flow: **plan → chunk → implement → review**.
Turns a goal into a structured plan and stores it in a `memory/` **OKF v0.1
bundle** in the project root. Accepting the plan immediately continues into
`/iterator-chunk` (chunk breakdown) in the same session.

The plan is one OKF concept document (`memory/plan.md`, `type: Plan`). See
`<skill-dir>/templates/format.md` (shipped with this skill, copied into every
bundle) for the full schema.

## When to use this skill

When the user types `/iterator-plan`, wants to plan a piece of work, or is
starting new work with iterator.

If the user's message contains a plan-review result payload from a previous
session (`plan-approved` / `plan-feedback` / `cancel` / `timeout`), process it
per step 4 before doing anything else.

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below.
`iterator_ui { step: "plan", extra: { title, plan: {...}, dependencies } }`
gathers the existing plan itself and merges only your drafted sections on top
(the `extra` is the one place your semantic draft travels); `iterator_write`
replaces the write.mjs heredoc. Steps, payloads, and rules are unchanged.

## Steps

### 1. Resolve the bundle location and check existing state

State gathering is scripted — do **not** read bundle files or run git yourself:

```sh
node <skill-dir>/../iterator/gather.mjs --step plan
```

It prints `{ step, branch, title, exists, status, legacy, plan: { goal,
architecture, keyDecisions, productFit }, dependencies }` — the branch, whether
a plan exists (with its current sections pre-parsed for revising), and whether
legacy `PLAN.md`/`CHUNKS.md` files exist.

**If `exists` is true**, use `AskUserQuestion` (header `Plan`): "Use the
existing plan" (skip to step 3 with the gathered sections pre-filled) vs.
"Create a new plan" (continue to step 2, overwriting on approval).

**If `legacy` reports `PLAN.md`/`CHUNKS.md` but no `memory/` bundle**, offer a
one-time migration with `AskUserQuestion` (header `Migrate`): "Migrate into
memory/ bundle" (parse the old files into `plan.md` + one chunk file each; then
this skill has produced the plan and you can proceed to chunking) vs. "Start
fresh". Never silently delete the legacy files — leave them for the user.

### 2. Ask for the goal

Planning happens **before** code is written. Use `AskUserQuestion` for a single
free-text question: *"What are you building and why? (1–3 sentences)"* (header
`Goal`).

After the answer, silently read `ARCHITECTURE.md` if present for context. Only
raise a follow-up if the goal clearly diverges from documented architecture, or
if it implies a new dependency / product-fit question worth confirming.

### 3. Generate the plan and open the plan-review UI

Draft the plan sections, then open the plan-review UI by piping the payload
into the **shared UI server** via a heredoc (no temp file). The server ships
with the `/iterator` hub skill — a sibling of this skill's folder; if it is
missing, tell the user to install the full iterator plugin and stop:

```sh
node <skill-dir>/../iterator/server.mjs << 'PLAN_DATA'
{
  "step": "plan",
  "branch": "<branch>",
  "title": "<plan title>",
  "plan": { "goal": "...", "architecture": "...", "keyDecisions": "...", "productFit": "..." },
  "dependencies": ["<pkg-or-service> — <why>"]
}
PLAN_DATA
```

The UI renders each section as markdown (click to edit, ⌘/Ctrl+Enter to save), a
💬 per-section comment thread, an editable dependencies chips panel, and a global
comment box. Header controls follow the shared pattern: **Accept** / **Cancel**
/ **Send review** (see "Shared UI behavior").

### 4. Process the server output

The server prints exactly one JSON line:

- `{ "type": "plan-approved", "sections": {...}, "dependencies": [...] }` →
  **write the bundle** (step 5), then **auto-continue into chunking**: invoke
  the `/iterator-chunk` flow immediately in this session using the approved plan.
  (Until iterator-chunk exists, instead tell the user the plan is saved and to
  run `/iterator-chunk`.)
- `{ "type": "plan-feedback", "sections": {...}, "dependencies": [...], "comments": [...], "comment": "..." }` →
  revise the plan using the edited sections/deps as the new base, apply each
  `comments[]` entry and the global `comment`, and re-run step 3.
- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop; tell the user the
  plan flow was cancelled/timed out. Do not write anything.

### 5. Write the memory/ bundle

The write is scripted — pipe the approved sections into the shared bundle
writer (also in the hub skill folder) via a heredoc. It owns everything
mechanical: `format.md` copy, frontmatter, timestamps, `index.md`, the
`log.md` entry, and OKF conformance. A re-plan preserves the existing
`# Chunks` section.

```sh
node <skill-dir>/../iterator/write.mjs << 'PLAN_WRITE'
{
  "op": "plan",
  "title": "<plan title>",
  "description": "<one-line summary>",
  "sections": { "goal": "...", "architecture": "...", "keyDecisions": "...", "productFit": "..." },
  "dependencies": ["<pkg> — <why>"]
}
PLAN_WRITE
```

It prints `{ "ok": true, ... }` on success, or `{ "ok": false, "error": ... }`
(exit 1) — surface the error and fix the payload rather than writing files by
hand.

### 6. Continue

After writing the bundle, continue straight into `/iterator-chunk` to break the
plan into chunks (no re-invocation needed). If chunking is not available yet,
tell the user: "Plan saved to `memory/plan.md`. Run `/iterator-chunk` to break
it into chunks."

## Shared UI behavior (all iterator UIs)

- Every step renders through the **one UI server** in the `/iterator` hub
  skill folder (`<skill-dir>/../iterator/server.mjs`) — the browser control
  plane. The step skills only assemble payloads and process the answer.
- All interaction happens in the browser and is sent back automatically via the
  local server — no manual copy/paste of JSON.
- Header controls: **Toggle theme**, **Cancel** (always), and a primary button
  that reads **Accept** with no changes and flips to **Send review** once you
  edit a section, change dependencies, or add a comment.
- Closing the browser tab sends `{ "type": "cancel" }`, so a closed tab never
  leaves the flow hanging. After 2h with no answer the server emits
  `{ "type": "timeout" }`.
- Port is `7777` by default (or `$ITERATOR_PORT`) and stays **fixed**: a
  lingering iterator server from an earlier run is shut down and replaced, so
  the URL is stable across runs (a sandbox forwards exactly this port). Only
  when a different program holds the port does the server walk up and print
  the real URL to stderr.

## Lifecycle

- **Created by:** `/iterator-plan` — the `memory/` bundle (`index.md`,
  `format.md`, `log.md`, `plan.md`).
- **Extended by:** `/iterator-chunk` (chunk files + plan `# Chunks` section),
  `/iterator-implement` (status flips + commits), `/iterator-review` (review
  notes), `/iterator-test` (log entries).
- The bundle is durable across sessions and is a conformant OKF v0.1 bundle at
  every step.
