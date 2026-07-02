---
name: iterator-chunk
description: Break an approved plan into small, dependency-ordered chunks — one OKF file per chunk under memory/chunks/. Opens an interactive chunk-plan UI with a dependency graph, code snippets, drag-to-move files, and LLM-backed Split/Merge. Use when the user types /iterator-chunk, after /iterator-plan approves a plan, or to re-chunk/adjust an existing breakdown.
---

# iterator-chunk

The second step of the iterator flow: **plan → chunk → implement → review**.
Splits the approved plan (`memory/plan.md`) into meaningful, connected **chunks**
of roughly 200 lines each, in dependency order, writing **one OKF file per
chunk** at `memory/chunks/<slug>.md`. Chunks are then built one at a time by
`/iterator-implement`.

See `memory/format.md` for the chunk schema. The chunk **slug** (kebab-case
filename without `.md`) is the chunk's identity: its OKF concept ID, its
`depends_on` key, and its commit-message name.

## When to use this skill

When the user types `/iterator-chunk`, right after `/iterator-plan` approves a
plan (auto-continued), or to re-chunk / adjust an existing breakdown.

If `memory/plan.md` does not exist, tell the user to run `/iterator-plan` first
and stop.

If the user's message contains a chunk-UI result payload (`plan-adjustments`,
`split-request`, `merge-request`, `plan-approved`, `cancel`, `timeout`), process
it per step 4.

## Steps

### 1. Load the plan and any existing chunks

Read `memory/plan.md`. If `memory/chunks/index.md` exists, read it first, then
open only the chunk files you need (progressive disclosure). **Preserve any
chunk with `status: done`** — never rewrite or renumber done chunks when
re-chunking.

### 2. Analyze the plan into chunks

Split the whole plan (using `ARCHITECTURE.md` for context) into meaningful,
connected chunks:

- Each chunk is a logical unit of work with a clear, descriptive **slug**.
- Target ~200 lines (soft guideline, estimated from the plan). Flag chunks
  likely to exceed it (`size: large`).
- Record **dependencies** (`depends_on`, chunk slugs). Order dependency-first;
  the graph MUST be acyclic and every `depends_on` entry must reference an
  existing chunk.
- For each chunk gather **relevant snippets** — the most useful illustrative
  parts (interfaces, key functions, call sites), **not** full implementations —
  enough that an implementer can build it from the notes + snippets +
  `ARCHITECTURE.md`.
- Assign the `files` each chunk owns (paths or simple globs).

### 3. Open the chunk-plan UI

Pipe the chunk data into the server via a heredoc (no temp file). Include
`"status": "done"` for already-completed chunks so they render locked:

```sh
node <skill-dir>/server.mjs << 'CHUNK_DATA'
{
  "step": "chunk",
  "branch": "<branch>",
  "plan": "<plan title>",
  "chunks": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware for protected routes.",
      "implementationNotes": "Verify token from the config secret; wrap protected routes.",
      "files": ["src/auth.ts"],
      "dependsOn": ["config-module"],
      "linesEstimate": 60,
      "size": "small",
      "status": "pending",
      "snippets": [{ "lang": "ts", "code": "export function requireAuth(req,res,next){ /* ... */ }" }]
    }
  ]
}
CHUNK_DATA
```

The UI shows chunk cards, a dependency **graph visualization** (with cycle
warning), snippets, per-chunk comments, drag-to-move files between chunks, and
**Split** / **Merge** buttons. Header controls follow the shared pattern
(**Accept** / **Cancel** / **Send review**).

### 4. Process the server output

- `{ "type": "plan-approved" }` → the breakdown is accepted. **Write the chunk
  files and regenerate the indexes** (step 5), then tell the user they can run
  `/iterator-implement` to build chunks in dependency order.
- `{ "type": "plan-adjustments", "moves": [...], "renames": [...], "descUpdates": [...], "comments": [...] }`
  → apply each change to the chunk **files** (a `move` rewrites both chunks'
  `files`; a `rename` renames the file **and** rewrites every `depends_on`
  reference; a `descUpdate` edits `description`), regenerate indexes, then re-run
  step 3 with the updated chunks.
- `{ "type": "split-request", "chunk": "<slug>", "content": "..." }` → split that
  chunk into ~200-line sub-chunks with clear slugs and correct `depends_on`,
  **create the new files, delete the old file**, rewire references, regenerate
  indexes, and re-run step 3.
- `{ "type": "merge-request", "chunks": ["a","b"] }` → merge them meaningfully
  into one chunk with a clear slug, **delete the two merged files**, redirect any
  `depends_on` that pointed at either merged slug to the new slug, drop the
  merged nodes, regenerate indexes, and re-run step 3.
- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop; report that chunking
  was cancelled. Only files already written on a prior approval remain.

**Cycle check:** before writing, confirm the dependency graph is acyclic and
every `depends_on` references an existing chunk. If not, do not write — surface
the cycle/missing reference and re-open the UI so the user can fix it.

### 5. Write chunk files and regenerate indexes

For each chunk write `memory/chunks/<slug>.md` per `memory/format.md`:

```markdown
---
type: Chunk
title: <title>
description: <one sentence>
status: pending
size: <small|medium|large>
lines_estimate: <N>
depends_on: [<slug>, ...]
files: ["<path-or-glob>", ...]
timestamp: <ISO 8601>
tags: []
---

# Implementation notes
<how to build it>

# Snippets
```<lang>
<illustrative code>
```

# Depends on
* [<Title>](/chunks/<slug>.md) — <why>

# Blast radius
<what breaks if this is wrong>
```

Then regenerate the two generated files and record the event:

- **`memory/chunks/index.md`** (no frontmatter) — chunks in dependency order
  (topological, ties by creation order):

  ```markdown
  # Chunks

  * [Config module](config-module.md) - ✅ done · small · Centralize env/config access
  * [Auth middleware](auth-middleware.md) - ⬜ pending · small · depends: config-module · JWT middleware
  ```

- **`memory/plan.md` `# Chunks` section** — regenerate as bundle-absolute links
  so graph consumers see plan → chunk edges:

  ```markdown
  # Chunks

  * [Config module](/chunks/config-module.md) - Centralize env/config access
  * [Auth middleware](/chunks/auth-middleware.md) - JWT middleware for protected routes
  ```

- **`memory/index.md`** — refresh the plan description line if it changed.
- **`memory/log.md`** — prepend a dated entry, e.g.
  `* **Creation**: Created <N> chunks from the plan.` (or `**Update**` for a
  re-chunk / split / merge).

Update each edited chunk file's `timestamp`. Keep the bundle OKF-conformant.

## Shared UI behavior

Same header/theme/cancel/timeout behavior as the other iterator UIs; the
primary button reads **Accept** with no changes and flips to **Send review**
once you move a file, rename a chunk, edit a description, or add a comment. The
graph shows a cycle warning that blocks a clean accept until dependencies are
fixed.

## Relationship to the other skills

- `/iterator-plan` produces `memory/plan.md`; accepting a plan auto-continues
  here.
- `/iterator-chunk` writes `memory/chunks/<slug>.md` + regenerates the indexes
  (this skill).
- `/iterator-implement` builds chunks in dependency order and owns the `done`
  state; `/iterator-review` reviews a chunk's diff; `/iterator-test` writes its
  tests.
