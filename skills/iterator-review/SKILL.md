---
name: iterator-review
description: Open a chunk-grouped code review in the browser. Reads memory/chunks/ for scope, maps git diff hunks to chunks via each chunk's files globs, and records review outcomes into the chunk files (reviewed date + notes under # Review). Use when the user types /iterator-review, asks to review local changes, or wants to review a specific chunk. Never marks a chunk done — that is owned by /iterator-implement.
---

# iterator-review

Opens a chunk-grouped diff viewer in the browser. Chunks come from the `memory/`
bundle (`memory/chunks/<slug>.md`), not raw file paths, so related changes across
several files are reviewed together with dependency/blast-radius context.

This skill is used two ways:
- **By `/iterator-implement`** — automatically, in commit mode, to review the
  chunk just built (that flow is described in `/iterator-implement`).
- **Standalone** — the developer runs `/iterator-review`; it first asks which
  chunk to review against.

Review records outcomes into the chunk file (`reviewed:` date + notes under
`# Review`). It **never** sets `status: done` — that stays owned by
`/iterator-implement`.

## When to use this skill

When the user types `/iterator-review`, asks to review local changes, or wants
to review a specific chunk.

If `memory/chunks/` has no chunk files, tell the user: "No chunks found. Run
`/iterator-plan` → `/iterator-chunk` first." and stop.

If the user's message contains feedback JSON (`"type": "review-feedback"`) from a
previous session, process it (step 4) before re-running.

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below.
`iterator_ui { step: "review", chunk: "<slug>" }` gathers the diff payload
itself (pass no diff data); `iterator_write` replaces the write.mjs heredocs.
Steps, payloads, and rules are unchanged.

The review view shows each chunk's `lines_estimate` next to the actual diff
size and flags large deviations — when you see one, note it and calibrate
future `lines_estimate` values at chunking time from the chunk's `files`
instead of gut feel. Size verdicts (complexity dot, over-limit warning,
est-vs-actual) count **code lines only**: comment and doc changes are shown
with the chunk but excluded. A chunk's test files are grouped with it (via
its `files` globs or `tests` entries), so tests are always reviewed next to
the logic they cover.

## Steps

### 1. Load the chunk state

Scripted — do **not** read bundle files yourself:

```sh
node <skill-dir>/../iterator/gather.mjs --step hub
```

gives the ordered chunk list with status, test badges, and per-chunk
`hasDiff`/`hasCommits` (which is exactly what decides reviewability).

### 2. Choose which chunk(s) to review

- If invoked by `/iterator-implement` (or the user named a chunk), review that
  chunk.
- **Standalone with no chunk specified:** use `AskUserQuestion` (header `Chunk`)
  to ask which chunk to review — list **pending chunks first, in dependency
  order**, then done chunks (reviewable from their commits — see step 3), plus
  an **"All pending"** option.

Report the current state before opening the browser: total chunks, how many
done, how many remain, and which chunk(s) are being reviewed.

### 3. Build the payload and open the server

The entire review payload is computed by script — the git diff parsed into
hunks, each changed file mapped to the first chunk whose `files` globs match
(unmatched → **Uncategorized**), per-chunk stats (added/removed; complexity
green ≤ 100, yellow 101–200, red > 200), plan title, and progress. For a
**done** chunk with a clean working tree it automatically rebuilds the diff
from the chunk's recorded commits (validated shas, falling back to the
`Chunk: <slug>` trailer), excluding the bundle's own `memory/` paths.

Pipe it straight into the shared UI server (both ship with the `/iterator` hub
skill, a sibling folder):

```sh
node <skill-dir>/../iterator/gather.mjs --step review --chunk <slug> \
  | node <skill-dir>/../iterator/server.mjs
```

Omit `--chunk` to review everything with a diff ("All pending"). If the
printed payload has empty `chunks[].files` and `uncategorized` (no working-tree
diff and no resolvable commits), don't open the browser — show the progress
summary from `--step hub` instead.

The server starts on **port 7777** (or `$ITERATOR_PORT`; fixed — a lingering
iterator server from an earlier run is replaced), opens the browser, and
blocks. The UI shows a chunk sidebar (colored by
complexity), the selected chunk's diff grouped by file, per-chunk status buttons
(Approved / Needs Changes / Question), chunk notes, and line-level comments.
Header controls: **Accept** / **Cancel** / **Send review**; a closed tab sends
`{ "type": "cancel" }`, a 2h idle sends `{ "type": "timeout" }`.

### 4. Process the output and record the outcome

The server prints `{ "type": "review-feedback", ... }`, `{ "type": "cancel" }`, or
`{ "type": "timeout" }`.

For `cancel` / `timeout`: stop and report that the review ended without changes.

For `review-feedback`, for each entry in `features[]` (each is a reviewed
chunk), record the outcome through the bundle writer — it refreshes
`reviewed`/`timestamp`, appends the note under `# Review` (newest first, never
overwriting history), regenerates the index, and prepends the log entry:

```sh
node <skill-dir>/../iterator/write.mjs << 'REVIEW_WRITE'
{
  "op": "update-chunk",
  "chunk": "<slug>",
  "appendReview": "* **Approved** — <note or \"no changes requested\">",
  "log": "**Review**: Reviewed [<Title>](/chunks/<slug>.md); <approved / N changes requested>."
}
REVIEW_WRITE
```

The review line by status: `approved` → `* **Approved** — <note>`; `changes` →
`* **Needs changes** — <note>` (and address the note); `question` → answer
inline for the user, then record `* **Question** — <note> → <answer>`.
**Do not** set `status: done` (the writer flips status only when explicitly
asked — never ask it to here).

For each `lineComments[]` entry: explain or fix (ask before changing code).

Only the reviewed chunk file(s) plus the generated files should change (the
writer guarantees this). Report which chunks were
approved/flagged and how many remain: "All chunks reviewed ✓" or "N chunk(s)
still pending. Run `/iterator-review` again to continue."

## Relationship to the other skills

- `/iterator-plan` + `/iterator-chunk` create the chunk files.
- `/iterator-implement` builds chunks and owns `done` (it reuses this UI in
  commit mode).
- `/iterator-review` records `reviewed`/notes into the chunk files (this skill).
- `/iterator-test` generates a chunk's tests.
