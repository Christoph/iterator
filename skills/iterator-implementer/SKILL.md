---
name: iterator-implementer
description: Implement features one at a time in dependency order from a FEATURES.md plan. Picks the next feature whose dependencies are all done, implements it, opens a review UI, and on Accept commits it with the feature name. Use when the user types /iterator-implementer, wants to build the next feature, or wants to work through a feature plan sequentially.
---

# iterator-implementer

Implements **features** sequentially in dependency order. Reads the feature plan (`PLAN.md` index + `FEATURES.md` detail), picks the next feature whose dependencies are all complete, builds it, and opens an implementation-review UI. On **Accept and commit** it commits the change with the feature name and marks the feature done. Then it offers the next dependency-ready feature.

## When to use this skill

When the user types `/iterator-implementer`, wants to build the next feature, or wants to work through the feature plan. If `FEATURES.md` doesn't exist, tell the user to run `/iterator-plan-features` first and stop.

If the user's message contains a result payload from a previous session (`accept-commit`, `review-feedback`, or `cancel`), process it (step 5) before continuing.

## Steps

### 1. Load the feature plan and dependency graph

Read `PLAN.md`'s `## Features Index` for the ordered feature list with `Depends on` and `Status`. Load the target feature's block from `FEATURES.md` (description, implementation-notes, files, snippets, depends-on) using the index line numbers.

### 2. Pick the next dependency-ready feature

- Consider only features whose status is pending (`[ ]`).
- A feature is **ready** when every entry in its `depends-on` is already `done` (`[x]`).
- Choose the first ready feature in dependency order. **Never implement a feature before its dependencies are done.**
- **Cycle / stuck check:** if no pending feature is ready but pending features remain, there is a dependency cycle (or a dependency on a non-existent feature). Report it and stop — do not guess an order.

If the user named a specific feature, verify its dependencies are done before implementing it; if not, say which dependency is missing and stop.

### 3. Implement the feature

Implement the selected feature using:
- its `description` and `implementation-notes`
- its relevant code `snippets`
- `ARCHITECTURE.md` (read if present)
- `GUIDELINES.md` **only if it exists** — read it and follow it; if it does not exist, skip it silently

Make the actual code changes in the working tree. Keep the change scoped to this feature's `files` where possible.

### 4. Open the implementation-review UI (no temp file)

Collect the diff you produced and pipe the data straight into the server via a heredoc:

```sh
git diff --stat
node <skill-dir>/server.mjs << 'IMPL_DATA'
{
  "branch": "<branch>",
  "feature": {
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

The UI shows the feature name, description, implementation notes, the diff, and a comment box. Top-right controls: **Cancel**, and a primary button that reads **Accept and commit** when there is no comment and becomes **Send review** once a comment is added. Closing the tab sends `{ "type": "cancel" }`.

### 5. Process the result

The server prints one of:

- `{ "type": "accept-commit", "feature": "<name>" }` → the implementation is accepted:
  1. **Branch safety:** if the current branch is the default (`main`/`master`), create and switch to a working branch first (do not commit directly to the default branch).
  2. Commit the change with a message that includes the feature name, e.g. `feature(<name>): <short summary>`.
  3. Mark the feature **done** in `FEATURES.md` (`## [x]`, add `- **done**: <YYYY-MM-DD>`) and mirror the status in the `PLAN.md` Features Index — include these edits in the same commit.
  4. Report what was committed, then offer to continue with the next dependency-ready feature (loop to step 2).

- `{ "type": "review-feedback", "feature": "<name>", "comment": "..." }` → revise the implementation per the comment, then re-run from step 4 (do not commit yet).

- `{ "type": "cancel" }` → stop without committing; the working-tree changes remain for the user to inspect. Report that implementation was paused.

## Sequential flow

`/iterator-implementer` is the last stage of the guided flow: **plan (`/iterator-plan-features`) → feature creation → implementation**. It runs one feature per round, committing each on Accept, so progress is durable and the dependency order is always respected. Run it again (or accept-and-continue) to build the next feature.

## Relationship to the other skills

- `/iterator-plan-features` produces `PLAN.md` + `FEATURES.md`.
- `/iterator-implementer` builds features in dependency order and owns the `done` state (this skill).
- `/iterator-review` reviews a feature's diff; `/iterator-test-features` generates its tests.
