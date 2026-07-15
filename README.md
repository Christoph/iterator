# iterator

A Claude Code plugin for feature-grouped local code review. Instead of reviewing changes file-by-file, iterator groups your git changes by **feature** so you see related changes across multiple files together — with blast radius context and a direct feedback loop back to Claude.

Inspired by [Plannotator](https://github.com/backnotprop/plannotator).

## The problem

Classical diff tools (`git diff`, GitHub PRs) group changes by file. But a feature often touches 3–10 files simultaneously, and forcing reviewers to mentally reconstruct feature boundaries from file-by-file diffs causes cognitive overload and missed connections.

iterator inverts the default: **features are the primary grouping, files are secondary.**

Human reviewers can only process ~1 feature per sitting. This plugin enforces that discipline — features larger than 200 lines get flagged and should be split before review.

## Skills

### `/iterator-plan-features`

Analyzes your current git changes, groups them into small cohesive features, and writes a `## Review Features` section to `PLAN.md`. Opens an interactive browser UI where you can:

- See all features as cards with a size bar chart
- Drag files between feature cards to adjust groupings
- Rename features (inline edit)
- Split oversized features (> 200 lines)
- Merge small related features
- Click "Apply adjustments to PLAN.md" — feedback goes directly to Claude, no copy-paste

**Run this first**, before `/iterator-review`.

### `/iterator-review`

Opens a feature-grouped diff viewer in the browser. For each feature, you see all its changed hunks across files together, with blast radius context. Supports:

- Feature-level status: Approved / Needs Changes / Question
- Feature notes and line-level comments
- Click "Send feedback to Claude" — Claude immediately processes your feedback, explains changes, or applies fixes

## How it works

Both skills run a local Node.js HTTP server on **port 8888**. The browser UI POSTs structured feedback directly to the server, which prints it to stdout for Claude to read — no clipboard, no copy-paste.

```
/iterator-plan-features
  └─ Claude analyzes git diff
  └─ Claude writes ## Review Features to PLAN.md
  └─ node server.mjs ← JSON data piped in
       └─ Opens http://localhost:8888
       └─ Blocks waiting for user adjustments
       └─ User clicks "Apply" → JSON posted to /submit
       └─ Prints adjustment JSON to stdout → Claude reads it
       └─ Claude updates PLAN.md, loops back

/iterator-review
  └─ Claude reads PLAN.md features + git diff
  └─ Maps hunks to features
  └─ node server.mjs ← JSON data piped in
       └─ Opens http://localhost:8888
       └─ Blocks waiting for user review
       └─ User clicks "Send feedback" → JSON posted to /submit
       └─ Prints feedback JSON to stdout → Claude reads it
       └─ Claude explains, fixes, or acknowledges
```

## Installation

```bash
claude plugins install /path/to/iterator
```

Or from this repo after cloning:

```bash
claude plugins install .
```

## Requirements

- Node.js ≥ 18 (uses native `node:http` and `node:child_process` — no npm install needed)
- Claude Code with plugin support
- A git repository with uncommitted changes

## Configuration

Port defaults to **8888**. Override with the `ITERATOR_PORT` environment variable:

```bash
ITERATOR_PORT=9000 # set in your shell or .env
```

## Two-file design

The plugin uses two files with different scopes, keeping Claude's context small:

**`PLAN.md`** — high-level plan + a `## Features Index` table with line references into FEATURES.md. Claude reads this first to understand intent and find exactly which lines to load — without reading the whole features file.

```markdown
# Plan

Add JWT authentication and REST API routes.

## Features Index

| Feature | Line | Status | Size |
|---|---|---|---|
| config-module | 8 | [x] reviewed | small |
| auth-middleware | 18 | [ ] pending | small |
| api-routes | 30 | [ ] pending | medium |
```

**`FEATURES.md`** — full per-feature spec and review history, with checkboxes for persistent progress tracking.

```markdown
# Features

> **Plan:** Add JWT authentication and REST API routes
> **Branch:** feature/auth
> **Created:** 2026-07-01
> **Progress:** 1/3 reviewed

---

## [x] config-module
- **description**: Centralize all env/config access
- **files**: `src/config.ts`
- **blast-radius**: Every file reading env vars directly
- **depends-on**: none
- **size**: small (30 lines)
- **reviewed**: 2026-07-01
- **notes**: Approved

## [ ] auth-middleware
- **description**: JWT-based auth middleware
- **files**: `src/auth.ts`, `src/middleware/auth.ts`
- **blast-radius**: All routes behind auth guard
- **depends-on**: config-module
- **size**: small (50 lines)
```

`/iterator-plan-features` creates and maintains both files. `/iterator-review` reads PLAN.md for the index, then loads only the relevant feature lines from FEATURES.md — keeping context efficient.

### Sizing guideline

| Lines changed | Label | Color | Review time |
| --- | --- | --- | --- |
| ≤ 100 | small | 🟢 green | ~10 min |
| 101–200 | medium | 🟡 yellow | ~30 min |
| > 200 | large | 🔴 red | needs splitting |

## Repository structure

```
iterator/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   ├── iterator-review/
│   │   ├── SKILL.md         # /iterator-review skill definition
│   │   ├── server.mjs       # Local HTTP server + browser UI
│   │   └── templates/
│   │       └── feature-review.md  # HTML/UI reference spec
│   └── iterator-plan-features/
│       ├── SKILL.md         # /iterator-plan-features skill definition
│       ├── server.mjs       # Local HTTP server + browser UI
│       └── templates/
│           └── feature-planner.md # HTML/UI reference spec
├── ARCHITECTURE.md          # Technical design decisions
├── CONTRIBUTING.md
└── README.md
```

## Workflow

```
1. Make some code changes
2. Run /iterator-plan-features
   → Browser opens with feature cards
   → Adjust groupings, rename, split large features
   → Click "Apply adjustments to PLAN.md"
3. Run /iterator-review
   → Browser opens with feature-grouped diff
   → Review each feature's changes together
   → Add notes, mark status, ask questions
   → Click "Send feedback to Claude"
4. Claude processes feedback:
   → Explains flagged changes
   → Applies fixes (with your approval)
   → Offers to re-run the review
```

## License

MIT
