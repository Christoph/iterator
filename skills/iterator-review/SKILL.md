---
name: iterator-review
description: Open a chunk-grouped code review in the browser. Reads memory/chunks/ for scope, maps git diff hunks to chunks via each chunk's files globs, and records review outcomes into the chunk files (reviewed date + notes under # Review). Use when the user types /iterator-review, asks to review local changes, or wants to review a specific chunk. Never marks a chunk done — that is owned by /iterator-implement.
---

# iterator-review

Opens a chunk-grouped diff viewer in the browser. Chunks come from the
`memory/` bundle, not raw file paths, so related changes across several files
are reviewed together with dependency/blast-radius context. Used two ways:
by `/iterator-implement` automatically in commit mode (that flow is described
there), and **standalone** — this skill, which first asks which chunk to
review. Review records outcomes into the chunk file (`reviewed:` date + notes
under `# Review`); it **never** sets `status: done`.

The gathered payload also carries **pitfall cards**: `pitfalls/` concepts
whose `files:` anchors match a chunk's changed files render as a warning next
to that chunk. Before accepting such a chunk, read the pitfall's concept file
(its `path`) and verify the diff against it; mention the verdict ("pitfall X
checked — not triggered / fixed / still applies") in the chunk's review note.

The payload also carries `designFile` (the project's design params,
`memory/design.md`, or null). **When the diff touches UI/frontend surface**,
read the design file and verify the changes conform to it (typography, color,
spacing, direction) per `/iterator-design`; note the verdict in the review.
If `designFile` is null for a UI-touching diff, flag that design params were
never captured.

Size verdicts are computed from the **actual** diff and count **code lines
only** (comment/doc changes are shown but excluded). When a chunk's real diff
blows past the warning, its feature boundary was too broad — worth noting for
the next chunking pass. A chunk's test files are grouped with it, so tests
are always reviewed next to the logic they cover.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-review`, asks to review local changes, or
wants to review a specific chunk. If `memory/chunks/` has no chunk files,
tell the user: "No chunks found. Run `/iterator-plan` → `/iterator-chunk`
first." and stop. If the user's message contains
`{ "type": "review-feedback", ... }` from a previous session, process it
(step 3) first.

## Steps

### 1. Choose which chunk(s) to review

```sh
node <skill-dir>/../iterator/gather.mjs --step hub
```

gives the ordered chunk list with status, test badges, and per-chunk
`hasDiff`/`hasCommits` — exactly what decides reviewability. Do **not** read
bundle files yourself.

- If the user named a chunk, review that one.
- Otherwise ask **via the browser question view first** (pipe
  `{ "step": "question", "title": "Chunk", "question": "...", "options":
  [...] }` into `node <skill-dir>/../iterator/server.mjs`; pi mode:
  `iterator_ui` step `question`), printing "Question waiting in the browser
  dashboard." in the terminal; fall back to terminal `AskUserQuestion` only
  when the server is unavailable. Options: pending chunks first in
  dependency order, then done chunks (reviewable from their recorded
  commits), plus an **"All pending"** option.

If the chosen scope has neither a diff nor commits, don't open the browser —
report the progress summary instead. Otherwise report the current state
(done/total, which chunk(s) are being reviewed) and open the review:

```sh
echo '{"gather":true,"step":"review","chunk":"<slug>"}' | node <skill-dir>/../iterator/server.mjs
```

Omit `"chunk"` to review everything with a diff. The gather maps the diff to
chunks by their `files` globs (unmatched → Uncategorized); for a **done**
chunk with a clean working tree it rebuilds the diff from the chunk's
recorded commits (falling back to the `Chunk: <slug>` trailer).

### 2. Process the output (one JSON line)

For `cancel` / `timeout`: relay the result's `report` and stop.

For `{ "type": "review-feedback", ... }`: recording is fully deterministic —
pipe the line **verbatim** into `node <skill-dir>/../iterator/write.mjs`. It
maps each `features[]` entry to its chunk, refreshes `reviewed`/`timestamp`,
appends the status line under `# Review` (newest first, never overwriting
history), regenerates the index, and prepends the log entries. It never sets
`status: done`.

### 3. The semantic residue (yours)

Address every `changes` note, answer every `question` inline for the user,
and for each `lineComments[]` entry explain or fix (ask before changing
code). Report which chunks were approved/flagged and how many remain: "All
chunks reviewed ✓" or "N chunk(s) still pending. Run `/iterator-review` again
to continue."

## Agent review mode (`--agent <chunk>`)

When invoked as `/iterator-review <chunk> --agent` (dispatched by the
auto-mode driver), **you are the reviewer** — no browser, no human. Judge as
skeptically as the user would; approving broken work costs a full rework
round.

1. Gather the evidence:
   `node <skill-dir>/../iterator/gather.mjs --step review --chunk <slug>` —
   the actual diff mapped to the chunk, its pitfall cards, and `designFile`.
   Read the chunk's contract (implementation notes, blast radius), every
   pitfall card's file, and `memory/design.md` for UI-touching diffs.
2. Verify, in order: the diff fulfills the chunk's contract; tests exist and
   cover the behavior (run them); no pitfall is triggered; design params are
   respected; nothing outside the chunk's scope changed without reason.
3. **Needs work** (any check fails): record it and stop —
   `{ "op": "record-review", "by": "agent", "model": "<provider/model>",
   "features": [{ "name": "<slug>", "status": "changes", "note": "<specific,
   actionable findings>" }] }` piped into `write.mjs`. The driver dispatches
   the rework round; after 3 strikes it escalates to the human.
4. **Approve**: commit exactly like the human accept path —
   `{ "op": "accept-commit", "chunks": ["<slug>"], "uncategorized": [<a
   disposition per uncategorized file: assign to the chunk when it plainly
   belongs, else "skip">], "advance": false }` — then record the approval via
   `record-review` (`"status": "approved"`, `by: "agent"`, your model). Never
   pass memory proposals in agent mode — memorization stays with the human
   flows. If `accept-commit` fails (leftovers, staging), record `changes`
   with the error instead of retrying blindly.
