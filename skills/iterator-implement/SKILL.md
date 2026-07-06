---
name: iterator-implement
description: Implement chunks one at a time in dependency order from the memory/ bundle. Picks the next chunk whose dependencies are all done, builds it — using the chunk's tests as the goal when they exist (red/green flow, drive them green before review) — auto-opens the review UI scoped to that chunk, and on Accept and commit commits it (chunk(<slug>) with a Chunk trailer), flips its status to done, and records the commit. Use when the user types /iterator-implement, wants to build the next chunk, or wants to work through the chunk plan sequentially.
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
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it (step 4)
before continuing.

## Steps

### 1. Pick the next dependency-ready chunk

Selection is scripted — do **not** read bundle files yourself:

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

It prints `{ next, ready, blocked, stuck, progress }`: `next` is the first
dependency-ready pending chunk **with its full contract** (implementation
notes, snippets, files, blast radius, tests + test status); `blocked` lists
what each remaining chunk is waiting on.

- Implement `next`. **Never implement a chunk before its dependencies are
  done.**
- If `stuck` is true (pending chunks remain but none is ready), there is a
  dependency cycle or a dependency on a non-existent chunk. Report it and stop
  — do not guess an order.
- If the user named a specific chunk, it must appear in `ready`; if not, name
  the missing dependency (from `blocked`) and stop.

### 2. Implement the chunk — tests are the goal when they exist

Implement the selected chunk using `next`'s implementation notes, snippets,
`ARCHITECTURE.md` (read if present), and `GUIDELINES.md` **only if it exists**
(read and follow it; skip silently if absent). Make the actual code changes in
the working tree, scoped to the chunk's `files` where possible.

**Design quality (`impeccable`):** if the `impeccable` skill is available in
this harness **and** the chunk touches frontend/UI surface (markup, styles,
client-side components), use it while building: `/impeccable audit` the
changed UI after implementing and apply its findings, `/impeccable polish`
for final refinement — before opening the review UI. Skip silently if the
skill is not installed or the chunk has no UI surface.

**Green gate:** if the chunk has `tests` (written red by `/iterator-test`),
they define done. After implementing, run exactly the chunk's test files and
loop *implement → run → fix* until they pass — **before** opening the review
UI. Never weaken or delete a test to get green; if a test looks wrong, say so.
If the tests are still red after a few honest attempts, stop and show the user
the real failing output, then let them choose: keep fixing, open the review
anyway (the red badge will be visible), or pause. If the chunk has no tests,
skip this gate — it is not an error.

### 3. Auto-open the review UI (commit mode)

The review payload (diff parsed into hunks, mapped to the chunk, stats) is
computed by script; you only add the commit-mode fields. Gather it, then pipe
the augmented payload into the **shared UI server** (both ship with the
`/iterator` hub skill):

```sh
node <skill-dir>/../iterator/gather.mjs --step review --chunk <slug>
```

Take the printed JSON, set `"mode": "commit"`, and — when the chunk has tests —
add `"tests": { "status": "<red|green>", "total": N, "passing": N }` from your
green-gate run (omit it otherwise), then pipe the result into
`node <skill-dir>/../iterator/server.mjs` via a heredoc. The UI shows a 🔴/🟢
badge next to the chunk so the test state is visible exactly where the commit
decision happens.

The UI shows the chunk, its diff grouped by file, per-line comments, and the
**Accept and commit** / **Send review** primary. Closing the tab sends
`{ "type": "cancel" }`; a 2h idle sends `{ "type": "timeout" }`.

### 4. Process the result

- `{ "type": "accept-commit", "chunk": "<slug>" }` → the implementation is
  accepted:
  1. **Branch safety:** if the current branch is the default (`main`/`master`),
     create and switch to a working branch first — never commit to the default
     branch.
  2. **Flip the chunk through the bundle writer** — it sets `status: done`
     (with the `done` date and `timestamp`) and regenerates the index (✅
     marker, 🔴/🟢 badge) and log:

     ```sh
     node <skill-dir>/../iterator/write.mjs << 'DONE_WRITE'
     {
       "op": "update-chunk",
       "chunk": "<slug>",
       "set": { "status": "done", "tests_status": "<red|green>" },
       "log": "**Implementation**: Committed chunk(<slug>) on branch <branch>."
     }
     DONE_WRITE
     ```

     Include `tests_status` only when the chunk has tests: the color of the
     last real run (normally `red → green`; keep `red` if the user accepted
     with red tests — `status` and `tests_status` are independent by design).
  3. **Commit** the code changes **together with** the bundle updates in one
     commit:

     ```
     chunk(<slug>): <short summary>

     Chunk: <slug>
     ```

     (The `Chunk: <slug>` trailer lets tooling find every commit for a chunk.)
  4. **Record the commit**: in the *next* bundle write, pipe
     `{ "op": "update-chunk", "chunk": "<slug>", "appendCommit": { "sha": "<sha>", "kind": "implement" } }`
     into the writer (a commit cannot contain its own sha; the trailer keeps
     the chunk findable meanwhile — see `memory/format.md`).
  5. Report what was committed, then offer to continue with the next
     dependency-ready chunk (loop to step 1).

- `{ "type": "review-feedback", "features": [...], "lineComments": [...] }` →
  revise the implementation per the feedback (per-chunk notes/status and line
  comments), **re-run the chunk's tests** (the green gate applies to every
  round, not just the first), then re-run from step 3 with the fresh test
  state. **Do not commit yet.**

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
  mode); `/iterator-test` generates a chunk's tests — written red before
  implementation, they are this skill's definition of done.
