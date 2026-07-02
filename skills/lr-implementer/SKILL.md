---
name: lr-implementer
description: Implement chunks one at a time in dependency order from a CHUNKS.md plan. Picks the next chunk whose dependencies are all done, implements it, opens a review UI, and on Accept commits it with the chunk name. Use when the user types /lr-implementer, wants to build the next chunk, or wants to work through a chunk plan sequentially.
---

# lr-implementer

Implements **chunks** sequentially in dependency order. Reads the chunk plan (`PLAN.md` index + `CHUNKS.md` detail), picks the next chunk whose dependencies are all complete, builds it, and opens an implementation-review UI. On **Accept and commit** it commits the change with the chunk name and marks the chunk done. Then it offers the next dependency-ready chunk.

## When to use this skill

When the user types `/lr-implementer`, wants to build the next chunk, or wants to work through the chunk plan. If `CHUNKS.md` doesn't exist, tell the user to run `/lr-plan-features` first and stop.

If the user's message contains a result payload from a previous session (`accept-commit`, `review-feedback`, or `cancel`), process it (step 5) before continuing.

## Steps

### 1. Load the chunk plan and dependency graph

Read `PLAN.md`'s `## Chunks Index` for the ordered chunk list with `Depends on` and `Status`. Load the target chunk's block from `CHUNKS.md` (description, implementation-notes, files, snippets, depends-on) using the index line numbers.

### 2. Pick the next dependency-ready chunk

- Consider only chunks whose status is pending (`[ ]`).
- A chunk is **ready** when every entry in its `depends-on` is already `done` (`[x]`).
- Choose the first ready chunk in dependency order. **Never implement a chunk before its dependencies are done.**
- **Cycle / stuck check:** if no pending chunk is ready but pending chunks remain, there is a dependency cycle (or a dependency on a non-existent chunk). Report it and stop — do not guess an order.

If the user named a specific chunk, verify its dependencies are done before implementing it; if not, say which dependency is missing and stop.

### 3. Implement the chunk

Implement the selected chunk using:
- its `description` and `implementation-notes`
- its relevant code `snippets`
- `ARCHITECTURE.md` (read if present)
- `GUIDELINES.md` **only if it exists** — read it and follow it; if it does not exist, skip it silently

Make the actual code changes in the working tree. Keep the change scoped to this chunk's `files` where possible.

### 4. Open the implementation-review UI (no temp file)

Collect the diff you produced and pipe the data straight into the server via a heredoc:

```sh
git diff --stat
node <skill-dir>/server.mjs << 'IMPL_DATA'
{
  "branch": "<branch>",
  "chunk": {
    "name": "auth-middleware",
    "description": "JWT-based auth middleware",
    "implementationNotes": "Wraps protected routes; verifies token from config secret."
  },
  "summary": "Added requireAuth() and wired it into the protected router.",
  "diff": [
    { "path": "src/auth.ts", "hunks": [
      { "header": "@@ -1,0 +1,12 @@", "lines": [ { "type": "addition", "content": "export function requireAuth(){ /* ... */ }" } ] }
    ] }
  ]
}
IMPL_DATA
```

The UI shows the chunk name, description, implementation notes, the diff, and a comment box. Top-right controls: **Cancel**, and a primary button that reads **Accept and commit** when there is no comment and becomes **Send review** once a comment is added. Closing the tab sends `{ "type": "cancel" }`.

### 5. Process the result

The server prints one of:

- `{ "type": "accept-commit", "chunk": "<name>" }` → the implementation is accepted:
  1. **Branch safety:** if the current branch is the default (`main`/`master`), create and switch to a working branch first (do not commit directly to the default branch).
  2. Commit the change with a message that includes the chunk name, e.g. `chunk(<name>): <short summary>`.
  3. Mark the chunk **done** in `CHUNKS.md` (`## [x]`, add `- **done**: <YYYY-MM-DD>`) and mirror the status in the `PLAN.md` Chunks Index — include these edits in the same commit.
  4. Report what was committed, then offer to continue with the next dependency-ready chunk (loop to step 2).

- `{ "type": "review-feedback", "chunk": "<name>", "comment": "..." }` → revise the implementation per the comment, then re-run from step 4 (do not commit yet).

- `{ "type": "cancel" }` → stop without committing; the working-tree changes remain for the user to inspect. Report that implementation was paused.

## Sequential flow

`/lr-implementer` is the last stage of the guided flow: **plan (`/lr-plan-features`) → chunk creation → implementation**. It runs one chunk per round, committing each on Accept, so progress is durable and the dependency order is always respected. Run it again (or accept-and-continue) to build the next chunk.

## Relationship to the other skills

- `/lr-plan-features` produces `PLAN.md` + `CHUNKS.md`.
- `/lr-implementer` builds chunks in dependency order and owns the `done` state (this skill).
- `/lr-review` reviews a chunk's diff; `/lr-test-features` generates its tests.
