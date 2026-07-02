---
name: lr-review
description: Open a chunk-grouped code review in the browser. Reads CHUNKS.md for scope, groups git diff hunks by chunk, tracks review progress with checkboxes. Use when the user types /lr-review, asks to review local changes, or wants to review a specific chunk.
---

# lr-review

Opens a chunk-grouped diff viewer in the browser. Chunks come from `CHUNKS.md` (created by `/lr-plan-features`), not raw file paths. Related changes across multiple files are shown together with blast-radius/dependency context.

This skill is used two ways:
- **By `/lr-implementer`** — automatically, to review the chunk that was just implemented.
- **Standalone** — the developer runs `/lr-review` directly; in that case it first **asks which chunk to review against**.

## When to use this skill

When the user types `/lr-review`, asks to review local changes, or wants to review a specific chunk.

If `CHUNKS.md` doesn't exist, tell the user: "No CHUNKS.md found. Run `/lr-plan-features` first to create a chunk breakdown." and stop.

If the user's message contains feedback JSON (`"type": "review-feedback"`) from a previous session, process it (step 6) before re-running.

## Steps

### 1. Load chunks efficiently via the PLAN.md index

If `PLAN.md` has a `## Chunks Index`, read it first and use the line numbers to load only the chunk blocks you need from `CHUNKS.md`. Otherwise read `CHUNKS.md` in full.

Parse each chunk: name, description, implementation-notes, files, depends-on, size, status (`[ ]`/`[x]`), notes.

### 2. Choose which chunk(s) to review

- If invoked by `/lr-implementer` (or the user named a chunk), review that chunk.
- **Standalone with no chunk specified:** use `AskUserQuestion` to ask which chunk to review — list pending chunks first (dependency order), plus an "All pending chunks" option. Header `Chunk`.

Report the current state before opening the browser: total chunks, how many done, how many remain, and which chunk is being reviewed.

### 3. Collect git state

```sh
git diff HEAD --stat
git diff HEAD
git rev-parse --abbrev-ref HEAD
git log -1 --format="%H %s"
```

If the working tree is clean, try `git diff --stat` / `git diff`. If still empty, show the CHUNKS.md progress summary instead.

### 4. Map hunks to the selected chunk(s)

For each changed file, find the first chunk whose `files` list matches (exact path or glob); unmatched files go to "Uncategorized". Only include the chunk(s) selected in step 2. Compute per-chunk stats: lines added/removed; complexity green ≤ 100, yellow 101–200, red > 200.

### 5. Build data JSON and run the server (no temp file)

Pipe the data straight into the server via a heredoc — nothing is written to disk:

```sh
node <skill-dir>/server.mjs << 'REVIEW_DATA'
{
  "branch": "<branch>",
  "commit": "<hash subject>",
  "plan": "<plan title>",
  "progress": { "done": 1, "total": 3 },
  "hasChunksFile": true,
  "chunks": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware",
      "blastRadius": "All routes behind the auth guard",
      "dependsOn": ["config-module"],
      "reviewStatus": "pending",
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

The server starts on **port 8888** (or `$LOCAL_REVIEW_PORT`), opens the browser, and blocks. Top-right controls follow the shared pattern (Accept / Cancel / Send review); closing the tab sends `{ "type": "cancel" }`.

### 6. Process the server output and update CHUNKS.md

On submit the server prints either `{ "type": "review-feedback", ... }` or `{ "type": "cancel" }`.

For `cancel`: stop and report that the review was cancelled (nothing changed).

For `review-feedback`, for each entry in `chunks[]`:
- `status: "approved"` → mark `## [x]` in CHUNKS.md, append `- **reviewed**: <YYYY-MM-DD>` and `- **notes**: Approved`; mirror the status in the `PLAN.md` Chunks Index.
- `status: "needs-changes"` + `note` → keep `[ ]`, append/update `- **notes**: <note>`.
- `status: "question"` → answer inline, keep `[ ]`.

For each `lineComments[]` entry: explain or fix (ask before changing code).

Update the `> **Progress:**` line, then report which chunks were approved/flagged and how many remain. If all done: "All chunks reviewed ✓". Otherwise: "N chunk(s) still pending. Run `/lr-review` again to continue."

> Note: `/lr-review` updates review status (`reviewed`/notes). Completion (`done`) of a chunk is owned by `/lr-implementer` after Accept and commit.

## CHUNKS.md format reference

```markdown
# Chunks

> **Plan:** <title>
> **Branch:** <branch>
> **Created:** 2026-07-01
> **Progress:** 1/3 done

---

## [x] config-module
- **description**: Centralize env/config access
- **files**: `src/config.ts`
- **depends-on**: none
- **size**: small (~30 lines)
- **done**: 2026-07-01

## [ ] auth-middleware
- **description**: JWT-based auth middleware
- **files**: `src/auth.ts`, `src/middleware/auth.ts`
- **depends-on**: config-module
- **size**: small (~50 lines)
```

## How the server works

`server.mjs` reads JSON from stdin, starts on port 8888, opens the browser, and blocks until submit. Feedback returns over HTTP (`POST /submit`); a closed tab sends `POST /cancel`. Nothing is written to `/tmp`. The UI shows a chunk sidebar (colored by complexity), the selected chunk's diff grouped by file, per-chunk status buttons (Approved / Needs Changes / Question), and line-level comments.
