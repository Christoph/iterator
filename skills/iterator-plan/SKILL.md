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

## Steps

### 1. Resolve the bundle location and check existing state

```sh
git rev-parse --show-toplevel        # bundle lives at <root>/memory (or $ITERATOR_MEMORY_DIR)
git rev-parse --abbrev-ref HEAD      # branch, for the plan frontmatter
```

The memory directory is `<git-root>/memory` unless `ITERATOR_MEMORY_DIR` is set
(always resolve it relative to the git root). Then:

```sh
test -f memory/plan.md && echo "bundle:exists" || echo "bundle:missing"
test -f PLAN.md && echo "legacy-plan:exists"      # old pre-bundle state files
test -f CHUNKS.md && echo "legacy-chunks:exists"
```

**If `memory/plan.md` exists**, use `AskUserQuestion` (header `Plan`): "Use the
existing plan" (read it, skip to step 3 with its sections pre-filled) vs.
"Create a new plan" (continue to step 2, overwriting on approval).

**If legacy `PLAN.md`/`CHUNKS.md` exist but no `memory/` bundle**, offer a
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

Draft the plan sections, then open the plan-review UI by piping the payload into
the server via a heredoc (no temp file):

```sh
node <skill-dir>/server.mjs << 'PLAN_DATA'
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

On approval, create the bundle if it doesn't exist and write/update these files.
Use ISO dates/timestamps (today's date; a full ISO 8601 `timestamp`).

**`memory/format.md`** — copy `<skill-dir>/templates/format.md` verbatim
if it does not already exist (it is the self-describing schema).

**`memory/plan.md`**:

```markdown
---
type: Plan
title: <title>
description: <one-line summary>
status: approved
branch: <branch>
created: <YYYY-MM-DD>
timestamp: <ISO 8601>
---

# Goal
<goal>

# Architecture
<architecture>

# Dependencies
* `<pkg>` — <why>

# Key decisions
<keyDecisions>

# Product fit
<productFit>

# Chunks

<!-- regenerated by /iterator-chunk; empty until chunks exist -->
```

**`memory/index.md`** (root — the only index with frontmatter, carrying
`okf_version`):

```markdown
---
okf_version: "0.1"
---

# iterator memory

* [Plan](plan.md) - <plan description>
* [Format](format.md) - Metadata schema for this bundle.
* [Chunks](chunks/) - One document per implementation chunk.
* [Log](log.md) - Chronological history of plan/chunk/implement/review events.
```

**`memory/log.md`** — create if missing, then prepend a dated entry:

```markdown
# iterator update log

## <YYYY-MM-DD>
* **Creation**: Plan "<title>" approved on branch <branch>.
```

Keep the bundle OKF-conformant: every `.md` file (except `index.md`/`log.md`)
must have frontmatter with a non-empty `type`; cross-links are bundle-absolute
(`/chunks/<slug>.md`).

### 6. Continue

After writing the bundle, continue straight into `/iterator-chunk` to break the
plan into chunks (no re-invocation needed). If chunking is not available yet,
tell the user: "Plan saved to `memory/plan.md`. Run `/iterator-chunk` to break
it into chunks."

## Shared UI behavior (all iterator UIs)

- All interaction happens in the browser and is sent back automatically via the
  local server — no manual copy/paste of JSON.
- Header controls: **Toggle theme**, **Cancel** (always), and a primary button
  that reads **Accept** with no changes and flips to **Send review** once you
  edit a section, change dependencies, or add a comment.
- Closing the browser tab sends `{ "type": "cancel" }`, so a closed tab never
  leaves the flow hanging. After 2h with no answer the server emits
  `{ "type": "timeout" }`.
- Port is `7777` by default (or `$ITERATOR_PORT`); if busy the server picks the
  next free port and prints the real URL to stderr.

## Lifecycle

- **Created by:** `/iterator-plan` — the `memory/` bundle (`index.md`,
  `format.md`, `log.md`, `plan.md`).
- **Extended by:** `/iterator-chunk` (chunk files + plan `# Chunks` section),
  `/iterator-implement` (status flips + commits), `/iterator-review` (review
  notes), `/iterator-test` (log entries).
- The bundle is durable across sessions and is a conformant OKF v0.1 bundle at
  every step.
