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

Both are scripted — do **not** read bundle files yourself:

```sh
node <skill-dir>/../iterator/gather.mjs --step chunk   # existing chunks, UI-shaped
node <skill-dir>/../iterator/gather.mjs --step plan    # plan sections, when you need the text
```

`--step chunk` prints `{ plan: <title>, chunks: [...] }` with every existing
chunk already in the UI payload shape (notes, snippets, files, dependsOn,
status). **Preserve any chunk with `status: done`** — the bundle writer
refuses to rewrite them, so build your breakdown around them.

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

Pipe the chunk data into the shared UI server (it ships with the `/iterator`
hub skill, a sibling folder) via a heredoc (no temp file). Include
`"status": "done"` for already-completed chunks so they render locked:

```sh
node <skill-dir>/../iterator/server.mjs << 'CHUNK_DATA'
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

- `{ "type": "plan-approved" }` → the breakdown is accepted. **Write the chunks
  through the bundle writer** (step 5), then tell the user they can run
  `/iterator-implement` to build chunks in dependency order.
- `{ "type": "plan-adjustments", "moves": [...], "renames": [...], "descUpdates": [...], "comments": [...] }`
  → the mechanical edits are applied by the writer — pipe the server's output
  line **verbatim** into it:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'ADJUSTMENTS'
  <the plan-adjustments JSON line, unchanged>
  ADJUSTMENTS
  ```

  It applies moves, renames (including `depends_on` and link rewiring), and
  description updates, and regenerates the indexes. You only act on the
  `comments[]` (semantic feedback). Then re-run
  `gather.mjs --step chunk | server.mjs` to reopen the UI with fresh state.
- `{ "type": "split-request", "chunk": "<slug>", "content": "..." }` → split that
  chunk into ~200-line sub-chunks with clear slugs and correct `depends_on`
  (semantic work — yours), then write via step 5 with the new chunks in
  `chunks` and the old slug in `deletes`. Re-run step 3.
- `{ "type": "merge-request", "chunks": ["a","b"] }` → merge them meaningfully
  into one chunk with a clear slug; write via step 5 with the merged chunk in
  `chunks`, both old slugs in `deletes`, and any `depends_on` that pointed at
  either old slug redirected to the new one. Re-run step 3.
- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop; report that chunking
  was cancelled. Only files already written on a prior approval remain.

### 5. Write chunks through the bundle writer

The write is scripted — pipe the chunk set into the shared bundle writer. It
owns frontmatter, timestamps, dependency-order (topological) indexes, the plan
`# Chunks` section, the log entry, and OKF conformance, and it **validates
before writing**: an acyclic graph, every `depends_on` referencing an existing
chunk, and done chunks left untouched.

```sh
node <skill-dir>/../iterator/write.mjs << 'CHUNKS_WRITE'
{
  "op": "chunks",
  "chunks": [
    {
      "name": "auth-middleware",
      "title": "Auth middleware",
      "description": "JWT middleware for protected routes",
      "implementationNotes": "Verify token from the config secret.",
      "files": ["src/auth.ts"],
      "dependsOn": ["config-module"],
      "linesEstimate": 60,
      "size": "small",
      "snippets": [{ "lang": "ts", "code": "export function requireAuth(){ /* ... */ }" }],
      "blastRadius": "All routes behind the auth guard."
    }
  ],
  "deletes": []
}
CHUNKS_WRITE
```

On a validation failure it prints `{ "ok": false, "error": ... }` and writes
**nothing** — fix the breakdown (or reopen the UI so the user can fix the
cycle) rather than writing files by hand.

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
