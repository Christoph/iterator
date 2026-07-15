# iterator Architecture

A Claude Code plugin that makes code review and implementation human-sized by organizing work into **features** — small, dependency-aware units — rather than by file.

## Core Problem

Classical diff tools group changes by file. But a developer's mental model is organized around *what changed and why* — a unit of work often touches several files at once. This plugin inverts the default: features are the primary grouping, files are secondary. A feature is a meaningful, connected unit of implementation of roughly 200 lines.

## Guided sequential flow

```
/iterator-plan-features   plan → feature breakdown (PLAN.md + FEATURES.md)
       │
       ▼
/iterator-implementer     build the next dependency-ready feature, review, Accept and commit
       │
       ├── /iterator-review        review a feature's diff (standalone: asks which feature)
       └── /iterator-test-features generate tests for a feature
```

All skills share the `iterator-` prefix so they group together in autocomplete.

## Plugin Structure

```
iterator/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (skills auto-discovered from skills/)
├── skills/
│   ├── iterator-plan-features/
│   │   ├── SKILL.md             # plan-review + feature-plan UIs, LLM split/merge
│   │   └── server.mjs
│   ├── iterator-implementer/
│   │   ├── SKILL.md             # builds features in dependency order; Accept and commit
│   │   └── server.mjs           # implementation-review UI
│   ├── iterator-review/
│   │   ├── SKILL.md             # feature-grouped diff viewer
│   │   └── server.mjs
│   └── iterator-test-features/
│       └── SKILL.md             # per-feature test generation (no UI)
├── PLAN.md                      # plan narrative + Features Index (dependency graph + status)
├── FEATURES.md                    # per-feature detail + status
└── ARCHITECTURE.md
```

Skills are discovered automatically from `skills/*/SKILL.md`; the manifest does not list them.

## Skills

### `/iterator-plan-features`
Turns a goal (or existing `PLAN.md`) into a plan, then breaks it into features. The plan-review UI renders sections as markdown (click-to-edit, per-section comments, editable dependency chips). Accepting the plan immediately starts feature creation; the feature-plan UI shows a dependency-graph visualization, code snippets, per-feature comments, and **Split**/**Merge** buttons that round-trip to Claude (the browser has no LLM access) to split/merge features meaningfully and rewire dependencies. Writes `PLAN.md` (Features Index) + `FEATURES.md` (detail).

### `/iterator-implementer`
Reads the Features Index + `FEATURES.md`, picks the next feature whose dependencies are all done (topological order; reports cycles), and implements it using the feature description, implementation notes, snippets, `ARCHITECTURE.md`, and `GUIDELINES.md` if it exists. Opens an implementation-review UI; on **Accept and commit** it commits with the feature name (branching off the default branch if needed) and marks the feature done in `FEATURES.md` + the index.

### `/iterator-review`
Feature-grouped diff viewer. Maps `git diff` hunks to features via each feature's `files` list. Used automatically by `/iterator-implementer`, or standalone — in which case it first asks which feature to review against. Records `reviewed`/notes back into `FEATURES.md`.

### `/iterator-test-features`
Generates tests one feature at a time: detects the project's test runner and conventions, reads the feature's real code, and writes focused tests (happy path + failure modes). Opt-in per feature; does not change status.

## Two-file layout: PLAN.md + FEATURES.md

### PLAN.md — the overview
Holds the plan narrative plus a `## Features Index`: the ordered feature list with dependencies (the graph) and status. Read first to understand intent, determine implementation order, and find the exact lines to load per feature.

```markdown
## Features Index

| Feature | Line | Status | Size | Depends on |
|---|---|---|---|---|
| config-module | 8 | [x] done | small | — |
| auth-middleware | 20 | [ ] pending | small | config-module |
| api-routes | 34 | [ ] pending | medium | auth-middleware |
```

### FEATURES.md — the detail
One self-contained block per feature (description, implementation-notes, files, snippets, depends-on, size, status), loaded per-feature via the index line numbers so context stays small.

### Why two files?
- **Context efficiency:** read the small `PLAN.md` to orient, then jump to the exact `FEATURES.md` lines for one feature.
- **Persistent progress:** `[x]`/done state in `FEATURES.md` is mirrored in the index and survives across sessions.
- **Shared source of truth:** all four skills read `FEATURES.md` for what a feature is.

**Glob matching:** the `files` field supports simple globs (`src/handlers/*.ts`); first matching feature wins.
**Dependency order:** the `depends-on` fields define the implementation order the implementer follows.

## Feature Sizing Guidelines

| Est. lines | Label | Color | Guideline |
|---|---|---|---|
| ≤ 100 | small | green | Ideal — 10-minute review |
| 101–200 | medium | yellow | Acceptable — 30-minute review |
| > 200 | large | red | Should be split |

Size is estimated from the plan before code exists, so it is a soft target. `/iterator-plan-features` flags oversized features and offers Split; `/iterator-review` warns on oversized diffs.

## Browser UI via local server (no temp files)

Every interactive step is driven by a small dependency-free Node server (`skills/*/server.mjs`):

1. Claude builds a JSON payload and pipes it to `server.mjs` via a heredoc — **nothing is written to `/tmp`**.
2. `server.mjs` reads the JSON from stdin, starts an HTTP server on **port 8888** (or `$ITERATOR_PORT`) bound to `127.0.0.1`, and opens the browser.
3. The page is self-contained: inlined CSS/JS, data embedded as a JSON blob, rendered dynamically (including a dependency-free markdown renderer and an inline-SVG dependency graph).
4. On submit the browser `POST`s structured JSON to `/submit`; the server prints it to **stdout** and exits. Closing the tab `POST`s `/cancel` (via `sendBeacon`), which emits `{ "type": "cancel" }` so a closed tab never leaves the flow hanging.
5. Claude reads stdout, applies the changes, and re-runs the server for the next round. A 2-hour timeout closes an abandoned server.

### Shared UI controls
Top-right on every UI: **Accept** (primary when no comment), **Cancel** (always), **Send review** (primary once any comment is added), plus **Accept and commit** in the implementer UI.

## Design Decisions

**Why a local server instead of static files or an in-editor panel?** A browser page can't write to disk, and there is no skill-drivable in-editor UI channel, so a tiny localhost server closes the loop: the browser POSTs JSON and the server prints it to stdout. It is dependency-free, binds only to `127.0.0.1`, writes nothing to `/tmp`, and exits on submit or timeout.

**Why LLM-driven split/merge via round-trip?** The browser can't call an LLM, so Split/Merge POST a request; Claude performs the semantic split/merge and re-opens the UI.

**Why ~200 lines?** Review-effectiveness research (Cisco/SmartBear) shows defect detection degrades past ~200–400 lines; 200 is a conservative, reviewable default.

**Why a separate `/iterator-test-features` skill?** Tests are opt-in per feature rather than generated up front, written against a feature's real code once the breakdown exists.
