---
name: iterator-implement
description: Implement chunks one at a time in dependency order from the memory/ bundle. Picks the next chunk whose dependencies are all done, builds it, auto-opens the review UI scoped to that chunk, and on Accept and commit commits it (chunk(<slug>) with a Chunk trailer) and flips its status to done. Use when the user types /iterator-implement, wants to build the next chunk, or wants to work through the chunk plan sequentially.
---

# iterator-implement

The third step of the iterator flow: **plan → chunk → implement → review**.
Implements **chunks** sequentially in dependency order from the `memory/` bundle.
Picks the next chunk whose dependencies are all done, builds it, auto-opens the
`/iterator-review` UI scoped to that chunk (primary **Accept and commit**), and
on accept commits the change with the chunk slug and marks the chunk done. Then
it offers the next dependency-ready chunk.

## When to use this skill

When the user types `/iterator-implement`, wants to build the next chunk, or
wants to work through the chunk plan. If `memory/chunks/` has no chunk files,
tell the user to run `/iterator-plan` → `/iterator-chunk` first and stop.

If the user's message contains a result payload from a previous session
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it (step 5)
before continuing.

## Steps

### 1. Load the chunk graph

Read `memory/chunks/index.md` for the ordered chunk list with status. Load the
candidate chunk's file `memory/chunks/<slug>.md` for its `depends_on`, `status`,
`files`, `# Implementation notes`, and `# Snippets`. (Read only the files you
need — the index is enough to choose.)

### 2. Pick the next dependency-ready chunk

- Consider only chunks with `status: pending`.
- A chunk is **ready** when every slug in its `depends_on` has `status: done`.
- Choose the first ready chunk in dependency order. **Never implement a chunk
  before its dependencies are done.**
- **Cycle / stuck check:** if pending chunks remain but none is ready, there is a
  dependency cycle or a dependency on a non-existent chunk. Report it and stop —
  do not guess an order.

If the user named a specific chunk, verify its `depends_on` are all done before
implementing; if not, name the missing dependency and stop.

### 3. Implement the chunk

Implement the selected chunk using its `# Implementation notes`, `# Snippets`,
`ARCHITECTURE.md` (read if present), and `GUIDELINES.md` **only if it exists**
(read and follow it; skip silently if absent). Make the actual code changes in
the working tree, scoped to the chunk's `files` where possible.

### 4. Auto-open the review UI (commit mode)

Collect the diff you produced and pipe it into the **review** server in commit
mode — this is the same UI as `/iterator-review`, scoped to the one chunk, with
**Accept and commit** as the primary button:

```sh
git diff --stat
node <plugin-root>/skills/iterator-review/server.mjs << 'REVIEW_DATA'
{
  "mode": "commit",
  "branch": "<branch>",
  "hasChunksFile": true,
  "chunks": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware for protected routes.",
      "dependsOn": ["config-module"],
      "stats": { "added": 42, "removed": 8, "files": 2, "complexity": "yellow" },
      "files": [
        { "path": "src/auth.ts", "hunks": [
          { "header": "@@ -1,0 +1,12 @@", "oldStart": 1, "newStart": 1,
            "lines": [ { "type": "addition", "content": "export function requireAuth(){ /* ... */ }" } ] } ] }
      ]
    }
  ],
  "uncategorized": []
}
REVIEW_DATA
```

The UI shows the chunk, its diff grouped by file, per-line comments, and the
**Accept and commit** / **Send review** primary. Closing the tab sends
`{ "type": "cancel" }`; a 2h idle sends `{ "type": "timeout" }`.

### 5. Process the result

- `{ "type": "accept-commit", "chunk": "<slug>" }` → the implementation is
  accepted:
  1. **Branch safety:** if the current branch is the default (`main`/`master`),
     create and switch to a working branch first — never commit to the default
     branch.
  2. **Flip the chunk file** `memory/chunks/<slug>.md`: `status: done`, add
     `done: <YYYY-MM-DD>`, update `timestamp`.
  3. **Regenerate** `memory/chunks/index.md` (✅ done marker) and prepend a
     `memory/log.md` entry:
     `* **Implementation**: Committed chunk(<slug>) on branch <branch>.`
  4. **Commit** the code changes **together with** the chunk-file flip, index,
     and log updates in one commit:

     ```
     chunk(<slug>): <short summary>

     Chunk: <slug>
     ```

     (The `Chunk: <slug>` trailer lets tooling find every commit for a chunk.)
  5. Report what was committed, then offer to continue with the next
     dependency-ready chunk (loop to step 2).

- `{ "type": "review-feedback", "features": [...], "lineComments": [...] }` →
  revise the implementation per the feedback (per-chunk notes/status and line
  comments), then re-run from step 4. **Do not commit yet.**

- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop without committing; the
  working-tree changes remain for the user to inspect. Report that
  implementation was paused.

## Sequential flow

`/iterator-implement` runs one chunk per round, committing each on Accept, so
progress is durable and the dependency order is always respected. Run it again
(or accept-and-continue) to build the next chunk. `/iterator-review` owns review
notes; this skill owns the `done` state.

## Relationship to the other skills

- `/iterator-plan` + `/iterator-chunk` produce the `memory/` bundle and chunk
  files.
- `/iterator-implement` builds chunks in dependency order and owns `done` (this
  skill).
- `/iterator-review` reviews a chunk's diff (this skill reuses its UI in commit
  mode); `/iterator-test` generates a chunk's tests.
