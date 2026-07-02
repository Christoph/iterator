# local-review Architecture

A Claude Code plugin that makes code review and implementation human-sized by organizing work into **chunks** — small, dependency-aware units — rather than by file.

## Core Problem

Classical diff tools group changes by file. But a developer's mental model is organized around *what changed and why* — a unit of work often touches several files at once. This plugin inverts the default: chunks are the primary grouping, files are secondary. A chunk is a meaningful, connected unit of implementation of roughly 200 lines.

## Guided sequential flow

```
/lr-plan-features   plan → chunk breakdown (PLAN.md + CHUNKS.md)
       │
       ▼
/lr-implementer     build the next dependency-ready chunk, review, Accept and commit
       │
       ├── /lr-review        review a chunk's diff (standalone: asks which chunk)
       └── /lr-test-features generate tests for a chunk
```

All skills share the `lr-` prefix so they group together in autocomplete.

## Plugin Structure

```
local-review/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (skills auto-discovered from skills/)
├── skills/
│   ├── lr-plan-features/
│   │   ├── SKILL.md             # plan-review + chunk-plan UIs, LLM split/merge
│   │   └── server.mjs
│   ├── lr-implementer/
│   │   ├── SKILL.md             # builds chunks in dependency order; Accept and commit
│   │   └── server.mjs           # implementation-review UI
│   ├── lr-review/
│   │   ├── SKILL.md             # chunk-grouped diff viewer
│   │   └── server.mjs
│   └── lr-test-features/
│       └── SKILL.md             # per-chunk test generation (no UI)
├── PLAN.md                      # plan narrative + Chunks Index (dependency graph + status)
├── CHUNKS.md                    # per-chunk detail + status
└── ARCHITECTURE.md
```

Skills are discovered automatically from `skills/*/SKILL.md`; the manifest does not list them.

## Skills

### `/lr-plan-features`
Turns a goal (or existing `PLAN.md`) into a plan, then breaks it into chunks. The plan-review UI renders sections as markdown (click-to-edit, per-section comments, editable dependency chips). Accepting the plan immediately starts chunk creation; the chunk-plan UI shows a dependency-graph visualization, code snippets, per-chunk comments, and **Split**/**Merge** buttons that round-trip to Claude (the browser has no LLM access) to split/merge chunks meaningfully and rewire dependencies. Writes `PLAN.md` (Chunks Index) + `CHUNKS.md` (detail).

### `/lr-implementer`
Reads the Chunks Index + `CHUNKS.md`, picks the next chunk whose dependencies are all done (topological order; reports cycles), and implements it using the chunk description, implementation notes, snippets, `ARCHITECTURE.md`, and `GUIDELINES.md` if it exists. Opens an implementation-review UI; on **Accept and commit** it commits with the chunk name (branching off the default branch if needed) and marks the chunk done in `CHUNKS.md` + the index.

### `/lr-review`
Chunk-grouped diff viewer. Maps `git diff` hunks to chunks via each chunk's `files` list. Used automatically by `/lr-implementer`, or standalone — in which case it first asks which chunk to review against. Records `reviewed`/notes back into `CHUNKS.md`.

### `/lr-test-features`
Generates tests one chunk at a time: detects the project's test runner and conventions, reads the chunk's real code, and writes focused tests (happy path + failure modes). Opt-in per chunk; does not change status.

## Two-file layout: PLAN.md + CHUNKS.md

### PLAN.md — the overview
Holds the plan narrative plus a `## Chunks Index`: the ordered chunk list with dependencies (the graph) and status. Read first to understand intent, determine implementation order, and find the exact lines to load per chunk.

```markdown
## Chunks Index

| Chunk | Line | Status | Size | Depends on |
|---|---|---|---|---|
| config-module | 8 | [x] done | small | — |
| auth-middleware | 20 | [ ] pending | small | config-module |
| api-routes | 34 | [ ] pending | medium | auth-middleware |
```

### CHUNKS.md — the detail
One self-contained block per chunk (description, implementation-notes, files, snippets, depends-on, size, status), loaded per-chunk via the index line numbers so context stays small.

### Why two files?
- **Context efficiency:** read the small `PLAN.md` to orient, then jump to the exact `CHUNKS.md` lines for one chunk.
- **Persistent progress:** `[x]`/done state in `CHUNKS.md` is mirrored in the index and survives across sessions.
- **Shared source of truth:** all four skills read `CHUNKS.md` for what a chunk is.

**Glob matching:** the `files` field supports simple globs (`src/handlers/*.ts`); first matching chunk wins.
**Dependency order:** the `depends-on` fields define the implementation order the implementer follows.

## Chunk Sizing Guidelines

| Est. lines | Label | Color | Guideline |
|---|---|---|---|
| ≤ 100 | small | green | Ideal — 10-minute review |
| 101–200 | medium | yellow | Acceptable — 30-minute review |
| > 200 | large | red | Should be split |

Size is estimated from the plan before code exists, so it is a soft target. `/lr-plan-features` flags oversized chunks and offers Split; `/lr-review` warns on oversized diffs.

## Browser UI via local server (no temp files)

Every interactive step is driven by a small dependency-free Node server (`skills/*/server.mjs`):

1. Claude builds a JSON payload and pipes it to `server.mjs` via a heredoc — **nothing is written to `/tmp`**.
2. `server.mjs` reads the JSON from stdin, starts an HTTP server on **port 8888** (or `$LOCAL_REVIEW_PORT`) bound to `127.0.0.1`, and opens the browser.
3. The page is self-contained: inlined CSS/JS, data embedded as a JSON blob, rendered dynamically (including a dependency-free markdown renderer and an inline-SVG dependency graph).
4. On submit the browser `POST`s structured JSON to `/submit`; the server prints it to **stdout** and exits. Closing the tab `POST`s `/cancel` (via `sendBeacon`), which emits `{ "type": "cancel" }` so a closed tab never leaves the flow hanging.
5. Claude reads stdout, applies the changes, and re-runs the server for the next round. A 2-hour timeout closes an abandoned server.

### Shared UI controls
Top-right on every UI: **Accept** (primary when no comment), **Cancel** (always), **Send review** (primary once any comment is added), plus **Accept and commit** in the implementer UI.

## Design Decisions

**Why a local server instead of static files or an in-editor panel?** A browser page can't write to disk, and there is no skill-drivable in-editor UI channel, so a tiny localhost server closes the loop: the browser POSTs JSON and the server prints it to stdout. It is dependency-free, binds only to `127.0.0.1`, writes nothing to `/tmp`, and exits on submit or timeout.

**Why LLM-driven split/merge via round-trip?** The browser can't call an LLM, so Split/Merge POST a request; Claude performs the semantic split/merge and re-opens the UI.

**Why ~200 lines?** Review-effectiveness research (Cisco/SmartBear) shows defect detection degrades past ~200–400 lines; 200 is a conservative, reviewable default.

**Why a separate `/lr-test-features` skill?** Tests are opt-in per chunk rather than generated up front, written against a chunk's real code once the breakdown exists.
