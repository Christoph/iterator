---
name: iterator-feature
description: Break an approved plan into small, dependency-ordered features — one OKF file per feature under memory/features/. Writes the proposal as draft features, then opens an interactive feature-plan UI with a dependency graph, code snippets, drag-to-move files, and LLM-backed Split/Merge; accepting promotes drafts to pending. Use when the user types /iterator-feature, after /iterator-plan approves a plan, or to re-feature/adjust an existing breakdown.
---

# iterator-feature

The second step of the iterator flow: **plan → feature → implement → review**.
Splits the approved plan into meaningful, connected **features** in dependency
order — one OKF file per feature at `memory/features/<slug>.md` (schema in
`memory/format.md`). The feature **slug** is the feature's identity: its concept
ID, its `depends_on` key, and its commit-message name.

The breakdown is **draft-first**: write the proposal to the bundle as
`status: draft` features immediately; the UI renders from disk. You never hold
or re-emit feature bodies — the bundle is the single copy. Accepting the set
promotes every draft to `pending`.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

**Claude Code mode:** Use gather/write directly instead of the Pi dashboard.
Present the proposed feature graph in chat, wait for explicit user approval,
and only then promote drafts with the deterministic writer.

## When to use this skill

When the user types `/iterator-feature`, right after `/iterator-plan` approves
a plan (auto-continued), or to re-feature / adjust an existing breakdown. If
`memory/plan.md` does not exist, tell the user to run `/iterator-plan` first
and stop. If the user's message contains a feature-UI result payload
(`plan-adjustments`, `split-request`, `merge-request`, `plan-approved`,
`cancel`, `timeout`), process it per step 4.

## Steps

### 1. Load the plan and any existing features

```sh
node <skill-dir>/../iterator/gather.mjs --step feature   # existing features, UI-shaped
node <skill-dir>/../iterator/gather.mjs --step plan    # plan sections, when you need the text
```

Do **not** read bundle files yourself. **Preserve any feature with
`status: done`** — the writer refuses to rewrite them; build around them.
The payload's `architecture` list is the project's recorded subsystem seams
(`{ id, title, description, files }` per concept), and its `decisions` list
is the project's recorded decision concepts — every feature must be checked
against them (step 2).

### 2. Analyze the plan into features

Split the whole plan (using `ARCHITECTURE.md` for context):

- **Feature by feature.** Each feature is **one user-visible capability or
  behavior** — a vertical slice that can be implemented, tested, and reviewed
  on its own ("auth middleware", "CSV export", "retry on failure"). The test
  of a good boundary: you can describe it in one sentence without "and", and
  the plan still makes sense if this feature ships and the rest doesn't yet.
  Never feature by layer ("all the models", "all the routes") and never make a
  task-fragment feature that only means something combined with another.
- **A feature contains its own tests.** The reviewer must see the tests next to
  the logic they cover — include the feature's (expected) test file paths in
  its `files`. Never make a separate "write tests for X" feature.
- **Size is a judgment call, not a count.** `small` (one focused change),
  `medium` (a feature touching a few files), `large` (a feature you already
  suspect is really two — prefer splitting it into two real features first).
  When in doubt between two small features and one medium, go bigger: too many
  tiny features is the common failure mode, and each one costs a full
  test/implement/review round. The reviewability backstop is the review UI,
  which warns on the **actual** diff size.
- **Comment and doc changes ride along** with the code they describe (review
  counts only code lines) — never split a feature because of comments/docs.
- Record **dependencies** (`depends_on`, feature slugs). Order
  dependency-first; the graph must be acyclic and every entry must reference
  an existing feature.
- Gather **relevant snippets** per feature — the most useful illustrative parts
  (interfaces, key functions, call sites), **not** full implementations —
  enough that an implementer can build from notes + snippets +
  `ARCHITECTURE.md`.
- Assign the `files` each feature owns (paths or simple globs), including its
  test files — but **only files the implementation will actually create or
  change**. Never list generated or synced copies (a build/sync step owns
  them) and never files that are merely read for context. `files` drives
  review ownership and the memories anchor-match, so padding it degrades
  both; a feature needing more than ~8 files usually means the slice is too
  broad or the list is padded.
- **Cut along the recorded architecture.** When `architecture` is non-empty,
  prefer feature boundaries that follow those subsystem seams (a feature inside
  one concept's territory beats one straddling two), and seed each feature's
  `files` from the matching concept's anchors. Read a concept's file only
  when its one-line description isn't enough.
- **Check every feature against the recorded `decisions`.** When a feature's
  approach contradicts a decision concept (read the concept's file when the
  one-liner is ambiguous), set `"conflicts": [{ "decision": "<area>/<slug>",
  "note": "<what contradicts and why>" }]` on that feature in the write — it
  renders as a red flag on the hub/feature views so the human decides before
  implementation. Never silently override a recorded decision. (The writer
  computes each feature's `memories:` reading list automatically at write
  time — you don't set it.)

### 3. Write the proposal as drafts, then open the UI

Write the breakdown through the writer with `"status": "draft"` on every
new/changed feature (`--schema features` prints the full shape):

```sh
node <skill-dir>/../iterator/write.mjs << 'FEATURES_WRITE'
{ "op": "features",
  "features": [
    { "name": "auth-middleware", "title": "Auth middleware",
      "description": "JWT middleware for protected routes", "status": "draft",
      "implementationNotes": "Verify token from the config secret.",
      "files": ["src/auth.ts"], "dependsOn": ["config-module"], "size": "small",
      "snippets": [{ "lang": "ts", "code": "export function requireAuth(){ /* ... */ }" }],
      "blastRadius": "All routes behind the auth guard." } ],
  "deletes": [] }
FEATURES_WRITE
```

The writer validates before writing (acyclic graph, existing `depends_on`
targets, valid size, done features untouched) and on failure writes **nothing**
— fix the breakdown and re-pipe. Watch the result's warnings:
`warnings.unmatchedGlobs` (a glob matching no files usually means a typo'd
path) and `warnings.broadFiles` (a feature declaring more than 8 files —
tighten the list to what the feature changes, or split the feature).

Then open the UI **from disk** — no hand-authored feature payload, ever:

```sh
echo '{"gather":true,"step":"feature"}' | node <skill-dir>/../iterator/server.mjs
```

### 4. Process the server output (one JSON line)

- `{ "type": "plan-approved" }` → pipe the line **verbatim** into
  `node <skill-dir>/../iterator/write.mjs` — it promotes every draft to
  `pending`. Then tell the user to run `/iterator-implement`.
- `{ "type": "plan-adjustments", ... }` → pipe the line **verbatim** into the
  writer — it applies moves, renames (incl. `depends_on` rewiring), and
  description updates. You only act on `comments[]` (semantic feedback):
  update the affected drafts via another `features` op, then reopen the UI.
- `{ "type": "split-request", "feature": "<slug>", "content": "..." }` → split
  that feature into right-sized sub-features with clear slugs and correct
  `depends_on` (semantic work — yours), write drafts via step 3 with the old
  slug in `deletes`. Reopen the UI.
- `{ "type": "merge-request", "features": ["a","b"] }` → merge them
  meaningfully into one feature; write via step 3 with both old slugs in
  `deletes` and any `depends_on` that pointed at either redirected to the new
  slug. Reopen the UI.
- `cancel` / `timeout` → relay the result's `report` and stop. Drafts stay on
  disk (visible on the hub, not implementable) — a later `/iterator-feature`
  run picks them up.
