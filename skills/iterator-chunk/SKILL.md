---
name: iterator-chunk
description: Break an approved plan into small, dependency-ordered chunks — one OKF file per chunk under memory/chunks/. Writes the proposal as draft chunks, then opens an interactive chunk-plan UI with a dependency graph, code snippets, drag-to-move files, and LLM-backed Split/Merge; accepting promotes drafts to pending. Use when the user types /iterator-chunk, after /iterator-plan approves a plan, or to re-chunk/adjust an existing breakdown.
---

# iterator-chunk

The second step of the iterator flow: **plan → chunk → implement → review**.
Splits the approved plan into meaningful, connected **chunks** in dependency
order — one OKF file per chunk at `memory/chunks/<slug>.md` (schema in
`memory/format.md`). The chunk **slug** is the chunk's identity: its concept
ID, its `depends_on` key, and its commit-message name.

The breakdown is **draft-first**: write the proposal to the bundle as
`status: draft` chunks immediately; the UI renders from disk. You never hold
or re-emit chunk bodies — the bundle is the single copy. Accepting the set
promotes every draft to `pending`.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-chunk`, right after `/iterator-plan` approves
a plan (auto-continued), or to re-chunk / adjust an existing breakdown. If
`memory/plan.md` does not exist, tell the user to run `/iterator-plan` first
and stop. If the user's message contains a chunk-UI result payload
(`plan-adjustments`, `split-request`, `merge-request`, `plan-approved`,
`cancel`, `timeout`), process it per step 4.

## Steps

### 1. Load the plan and any existing chunks

```sh
node <skill-dir>/../iterator/gather.mjs --step chunk   # existing chunks, UI-shaped
node <skill-dir>/../iterator/gather.mjs --step plan    # plan sections, when you need the text
```

Do **not** read bundle files yourself. **Preserve any chunk with
`status: done`** — the writer refuses to rewrite them; build around them.
The payload's `architecture` list is the project's recorded subsystem seams
(`{ id, title, description, files }` per concept).

### 2. Analyze the plan into chunks

Split the whole plan (using `ARCHITECTURE.md` for context):

- **Chunk by feature.** Each chunk is **one user-visible capability or
  behavior** — a vertical slice that can be implemented, tested, and reviewed
  on its own ("auth middleware", "CSV export", "retry on failure"). The test
  of a good boundary: you can describe it in one sentence without "and", and
  the plan still makes sense if this chunk ships and the rest doesn't yet.
  Never chunk by layer ("all the models", "all the routes") and never make a
  task-fragment chunk that only means something combined with another.
- **A chunk contains its own tests.** The reviewer must see the tests next to
  the logic they cover — include the chunk's (expected) test file paths in
  its `files`. Never make a separate "write tests for X" chunk.
- **Size is a judgment call, not a count.** `small` (one focused change),
  `medium` (a feature touching a few files), `large` (a feature you already
  suspect is really two — prefer splitting it into two real features first).
  When in doubt between two small chunks and one medium, go bigger: too many
  tiny chunks is the common failure mode, and each one costs a full
  test/implement/review round. The reviewability backstop is the review UI,
  which warns on the **actual** diff size.
- **Comment and doc changes ride along** with the code they describe (review
  counts only code lines) — never split a chunk because of comments/docs.
- Record **dependencies** (`depends_on`, chunk slugs). Order
  dependency-first; the graph must be acyclic and every entry must reference
  an existing chunk.
- Gather **relevant snippets** per chunk — the most useful illustrative parts
  (interfaces, key functions, call sites), **not** full implementations —
  enough that an implementer can build from notes + snippets +
  `ARCHITECTURE.md`.
- Assign the `files` each chunk owns (paths or simple globs), including its
  test files.
- **Cut along the recorded architecture.** When `architecture` is non-empty,
  prefer chunk boundaries that follow those subsystem seams (a chunk inside
  one concept's territory beats one straddling two), and seed each chunk's
  `files` from the matching concept's anchors. Read a concept's file only
  when its one-line description isn't enough.

### 3. Write the proposal as drafts, then open the UI

Write the breakdown through the writer with `"status": "draft"` on every
new/changed chunk (`--schema chunks` prints the full shape):

```sh
node <skill-dir>/../iterator/write.mjs << 'CHUNKS_WRITE'
{ "op": "chunks",
  "chunks": [
    { "name": "auth-middleware", "title": "Auth middleware",
      "description": "JWT middleware for protected routes", "status": "draft",
      "implementationNotes": "Verify token from the config secret.",
      "files": ["src/auth.ts"], "dependsOn": ["config-module"], "size": "small",
      "snippets": [{ "lang": "ts", "code": "export function requireAuth(){ /* ... */ }" }],
      "blastRadius": "All routes behind the auth guard." } ],
  "deletes": [] }
CHUNKS_WRITE
```

The writer validates before writing (acyclic graph, existing `depends_on`
targets, valid size, done chunks untouched) and on failure writes **nothing**
— fix the breakdown and re-pipe. Watch `warnings.unmatchedGlobs` in its
result: a chunk glob matching no files usually means a typo'd path.

Then open the UI **from disk** — no hand-authored chunk payload, ever:

```sh
echo '{"gather":true,"step":"chunk"}' | node <skill-dir>/../iterator/server.mjs
```

### 4. Process the server output (one JSON line)

- `{ "type": "plan-approved" }` → pipe the line **verbatim** into
  `node <skill-dir>/../iterator/write.mjs` — it promotes every draft to
  `pending`. Then tell the user to run `/iterator-implement`.
- `{ "type": "plan-adjustments", ... }` → pipe the line **verbatim** into the
  writer — it applies moves, renames (incl. `depends_on` rewiring), and
  description updates. You only act on `comments[]` (semantic feedback):
  update the affected drafts via another `chunks` op, then reopen the UI.
- `{ "type": "split-request", "chunk": "<slug>", "content": "..." }` → split
  that chunk into right-sized sub-chunks with clear slugs and correct
  `depends_on` (semantic work — yours), write drafts via step 3 with the old
  slug in `deletes`. Reopen the UI.
- `{ "type": "merge-request", "chunks": ["a","b"] }` → merge them
  meaningfully into one chunk; write via step 3 with both old slugs in
  `deletes` and any `depends_on` that pointed at either redirected to the new
  slug. Reopen the UI.
- `cancel` / `timeout` → relay the result's `report` and stop. Drafts stay on
  disk (visible on the hub, not implementable) — a later `/iterator-chunk`
  run picks them up.
