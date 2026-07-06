---
name: iterator-chunk
description: Break an approved plan into small, dependency-ordered chunks — one OKF file per chunk under memory/chunks/. Writes the proposal as draft chunks, then opens an interactive chunk-plan UI with a dependency graph, code snippets, drag-to-move files, and LLM-backed Split/Merge; accepting promotes drafts to pending. Use when the user types /iterator-chunk, after /iterator-plan approves a plan, or to re-chunk/adjust an existing breakdown.
---

# iterator-chunk

The second step of the iterator flow: **plan → chunk → implement → review**.
Splits the approved plan (`memory/plan.md`) into meaningful, connected **chunks**
in dependency order, writing **one OKF file per chunk** at
`memory/chunks/<slug>.md`. Chunks are then built one at a time by
`/iterator-implement`.

The breakdown is **draft-first**: you write the proposal to the bundle as
`status: draft` chunks immediately, and the UI renders from disk. You never
hold or re-emit chunk bodies — the bundle is the single copy. Accepting the
set in the UI promotes every draft to `pending`.

See `memory/format.md` for the chunk schema. The chunk **slug** (kebab-case
filename without `.md`) is the chunk's identity: its OKF concept ID, its
`depends_on` key, and its commit-message name.

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below — same payloads,
same rules. `iterator_ui { step: "chunk" }` gathers the chunk state itself
(never pass chunks to it); `iterator_write` replaces the write.mjs heredocs.

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
status — including any `draft` leftovers from an interrupted run). **Preserve
any chunk with `status: done`** — the bundle writer refuses to rewrite them,
so build your breakdown around them.

### 2. Analyze the plan into chunks

Split the whole plan (using `ARCHITECTURE.md` for context) into meaningful,
connected chunks:

- Each chunk is a logical unit of work with a clear, descriptive **slug**.
- **Size for review, not for neatness.** Target **~50–200 estimated changed
  lines** per chunk. Below ~30 lines the flow overhead outweighs the chunk —
  merge it into a neighbor unless it is genuinely isolated; above ~300 lines
  it cannot be meaningfully reviewed — split it. The writer warns outside
  this window; relay its warnings to the user.
- **Estimate `linesEstimate` from the expected diff** — walk the chunk's
  `files` and implementation notes and count what will actually change; do
  not gut-feel it. The review UI shows estimate-vs-actual, so systematic
  misestimates are visible.
- Record **dependencies** (`depends_on`, chunk slugs). Order dependency-first;
  the graph MUST be acyclic and every `depends_on` entry must reference an
  existing chunk.
- For each chunk gather **relevant snippets** — the most useful illustrative
  parts (interfaces, key functions, call sites), **not** full implementations —
  enough that an implementer can build it from the notes + snippets +
  `ARCHITECTURE.md`.
- Assign the `files` each chunk owns (paths or simple globs).

### 3. Write the proposal as drafts, then open the UI

First write the breakdown through the bundle writer with `"status": "draft"`
on every new/changed chunk (full op reference in step 5):

```sh
node <skill-dir>/../iterator/write.mjs << 'CHUNKS_WRITE'
{
  "op": "chunks",
  "chunks": [
    {
      "name": "auth-middleware",
      "title": "Auth middleware",
      "description": "JWT middleware for protected routes",
      "status": "draft",
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

Surface any `warnings` from the result (sizing) to the user. Then open the UI
**from disk** — no hand-authored chunk payload, ever:

```sh
node <skill-dir>/../iterator/gather.mjs --step chunk | node <skill-dir>/../iterator/server.mjs
```

The UI shows chunk cards (drafts badged 📝), a dependency **graph
visualization** (with cycle warning), snippets, per-chunk comments,
drag-to-move files between chunks, and **Split** / **Merge** buttons. Header
controls follow the shared pattern (**Accept** / **Cancel** / **Send review**).

### 4. Process the server output

- `{ "type": "plan-approved" }` → the breakdown is accepted. Pipe the line
  **verbatim** into the writer — it promotes every draft to `pending`:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'APPROVED'
  <the plan-approved JSON line, unchanged>
  APPROVED
  ```

  Then tell the user they can run `/iterator-implement` (or `/iterator-next`
  in pi) to build chunks in dependency order.
- `{ "type": "plan-adjustments", "moves": [...], "renames": [...], "descUpdates": [...], "comments": [...] }`
  → the mechanical edits are applied by the writer — pipe the server's output
  line **verbatim** into it (same heredoc pattern). It applies moves, renames
  (including `depends_on` and link rewiring), and description updates, and
  regenerates the indexes. You only act on the `comments[]` (semantic
  feedback) — update the affected draft chunks via another `chunks` op. Then
  reopen the UI (step 3's gather-pipe; chunks stay draft until accepted).
- `{ "type": "split-request", "chunk": "<slug>", "content": "..." }` → split that
  chunk into right-sized sub-chunks with clear slugs and correct `depends_on`
  (semantic work — yours), then write drafts via step 5 with the new chunks in
  `chunks` and the old slug in `deletes`. Reopen the UI.
- `{ "type": "merge-request", "chunks": ["a","b"] }` → merge them meaningfully
  into one chunk with a clear slug; write via step 5 with the merged draft in
  `chunks`, both old slugs in `deletes`, and any `depends_on` that pointed at
  either old slug redirected to the new one. Reopen the UI.
- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop; report that chunking
  was cancelled. Draft chunks stay on disk as drafts (visible on the hub, not
  implementable) — a later `/iterator-chunk` run picks them up.

### 5. The chunks write op (reference)

The writer owns frontmatter, timestamps, dependency-order (topological)
indexes, the plan `# Chunks` section, the log entry, and OKF conformance, and
it **validates before writing**: an acyclic graph, every `depends_on`
referencing an existing chunk, and done chunks left untouched. It returns
sizing `warnings` for chunks outside the ~30–300 estimated-line window.

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
- `/iterator-chunk` writes `memory/chunks/<slug>.md` as drafts + regenerates
  the indexes; accepting promotes drafts to pending (this skill).
- `/iterator-implement` builds pending chunks in dependency order and owns the
  `done` state; `/iterator-review` reviews a chunk's diff; `/iterator-test`
  writes its tests.
