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
previous session, process it (step 6) before re-running.

## Steps

### 1. Load chunks via the index

Read `memory/chunks/index.md` for the ordered chunk list with status. Open only
the chunk files you need for the selected scope; parse each: `title`,
`description`, `files`, `depends_on`, `size`, `status`, and existing `# Review`
notes.

### 2. Choose which chunk(s) to review

- If invoked by `/iterator-implement` (or the user named a chunk), review that
  chunk.
- **Standalone with no chunk specified:** use `AskUserQuestion` (header `Chunk`)
  to ask which chunk to review — list **pending chunks first, in dependency
  order**, then done chunks (reviewable from their commits — see step 3), plus
  an **"All pending"** option.

Report the current state before opening the browser: total chunks, how many
done, how many remain, and which chunk(s) are being reviewed.

### 3. Collect git state

```sh
git diff HEAD --stat
git diff HEAD
git rev-parse --abbrev-ref HEAD
git log -1 --format="%H %s"
```

If the working tree is clean vs. HEAD, fall back to `git diff --stat` / `git
diff`.

**Committed chunk (red/green history):** if the diff is still empty and the
selected chunk is `status: done`, build the diff from the chunk's commits
instead:

1. Prefer the shas recorded in the chunk's `commits` frontmatter — validate
   each with `git cat-file -e <sha>^{commit}` first (recorded shas go stale
   after a rebase/amend).
2. Fall back to the trailer: `git log --format=%H --grep='^Chunk: <slug>$'`.
3. Produce the diff with `git show <sha>` per commit (oldest first), or
   `git diff <oldest>^ <newest>` when they are consecutive. Exclude the
   bundle's own `memory/` paths so the review shows code, not bookkeeping.
   Set the payload's `commit` field to the reviewed range so the UI header
   says what is being shown.

Only if there is no working-tree diff **and** no resolvable commits, show the
`chunks/index.md` progress summary instead of opening the browser.

### 4. Map hunks to the selected chunk(s)

For each changed file, find the **first** chunk whose `files` list matches (exact
path or simple glob); unmatched files go to **Uncategorized**. Only include the
chunk(s) selected in step 2. Compute per-chunk stats: lines added/removed;
complexity green ≤ 100, yellow 101–200, red > 200.

### 5. Build the payload and open the server (no temp file)

Pipe the data into the shared UI server (it ships with the `/iterator` hub
skill, a sibling folder) via a heredoc:

```sh
node <skill-dir>/../iterator/server.mjs << 'REVIEW_DATA'
{
  "step": "review",
  "branch": "<branch>",
  "commit": "<hash subject>",
  "plan": "<plan title>",
  "progress": { "done": 1, "total": 3 },
  "hasChunksFile": true,
  "chunks": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware for protected routes.",
      "blastRadius": "All routes behind the auth guard",
      "dependsOn": ["config-module"],
      "stats": { "added": 42, "removed": 8, "files": 3, "complexity": "yellow" },
      "files": [
        { "path": "src/auth.ts", "hunks": [
          { "header": "@@ -41,5 +41,12 @@", "oldStart": 41, "newStart": 41,
            "lines": [ { "type": "context", "content": "function login(user) {" },
                       { "type": "addition", "content": "  const jwt = sign(payload, SECRET);" } ] } ] }
      ]
    }
  ],
  "uncategorized": []
}
REVIEW_DATA
```

The server starts on **port 7777** (or `$ITERATOR_PORT`; fixed — a lingering
iterator server from an earlier run is replaced), opens the browser, and
blocks. The UI shows a chunk sidebar (colored by
complexity), the selected chunk's diff grouped by file, per-chunk status buttons
(Approved / Needs Changes / Question), chunk notes, and line-level comments.
Header controls: **Accept** / **Cancel** / **Send review**; a closed tab sends
`{ "type": "cancel" }`, a 2h idle sends `{ "type": "timeout" }`.

### 6. Process the output and update the chunk files

The server prints `{ "type": "review-feedback", ... }`, `{ "type": "cancel" }`, or
`{ "type": "timeout" }`.

For `cancel` / `timeout`: stop and report that the review ended without changes.

For `review-feedback`, for each entry in `features[]` (each is a reviewed chunk):
- Refresh the chunk file's `reviewed: <YYYY-MM-DD>` and `timestamp`.
- **Append** (newest first) a dated entry under the chunk's `# Review` section —
  never overwrite prior review history:
  - `status: "approved"` → `* **Approved** — <note or "no changes requested">`
  - `status: "changes"` → `* **Needs changes** — <note>` (and address the note)
  - `status: "question"` → answer inline for the user; record
    `* **Question** — <note> → <answer>`
- **Do not** set `status: done`.

For each `lineComments[]` entry: explain or fix (ask before changing code).

Then regenerate `memory/chunks/index.md` (reflecting refreshed metadata) and
prepend a `memory/log.md` entry, e.g.
`* **Review**: Reviewed [<Title>](/chunks/<slug>.md); <approved / N changes requested>.`

Only the reviewed chunk file(s) plus the two generated files
(`chunks/index.md`, `log.md`) should change. Report which chunks were
approved/flagged and how many remain: "All chunks reviewed ✓" or "N chunk(s)
still pending. Run `/iterator-review` again to continue."

## Relationship to the other skills

- `/iterator-plan` + `/iterator-chunk` create the chunk files.
- `/iterator-implement` builds chunks and owns `done` (it reuses this UI in
  commit mode).
- `/iterator-review` records `reviewed`/notes into the chunk files (this skill).
- `/iterator-test` generates a chunk's tests.
