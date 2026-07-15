---
name: iterator-plan-features
description: Break a plan into small, dependency-aware features for sequential implementation and review. Creates PLAN.md (feature index + dependency graph) and FEATURES.md (per-feature detail with code snippets). Enforces ~200-line features. Opens an interactive browser UI. Use when the user types /iterator-plan-features, wants to plan work, or needs to organize changes into features.
---

# iterator-plan-features

Turns a goal (or an existing `PLAN.md`) into a small, structured plan and a set of **features** — meaningful, connected units of implementation of roughly 200 lines each, in dependency order. The workflow is sequential and guided: **plan → feature creation → implementation**. Accepting the plan starts feature creation immediately; features are then built one at a time by `/iterator-implementer`.

Two files hold the result (keeping context small):
- **`PLAN.md`** — the plan narrative plus a `## Features Index`: the ordered feature list with dependencies (the dependency graph) and status.
- **`FEATURES.md`** — one self-contained block per feature: description, implementation notes, relevant code snippets, `depends-on`, size, and status.

## When to use this skill

When the user types `/iterator-plan-features`, wants to organize work into features, or needs a feature breakdown before implementing.

If the user's message contains structured adjustments (`MOVE:`, `RENAME:`, `DESCRIPTION UPDATE:`) apply them to `FEATURES.md` and regenerate the UI (skip to step 6). If it contains a `split-request` or `merge-request` payload, handle it per step 7.

## Steps

### 1. Check for existing PLAN.md and FEATURES.md

```sh
test -f PLAN.md && echo "plan:exists" || echo "plan:missing"
test -f FEATURES.md && echo "features:exists" || echo "features:missing"
```

**If `PLAN.md` exists**, use `AskUserQuestion`:

```
question: "A PLAN.md already exists. What would you like to do?"
header: "PLAN.md"
options:
  - "Use existing PLAN.md" → read it, skip to Step 4
  - "Create a new plan" → continue to Step 2
```

**If `FEATURES.md` also exists**, add a second `AskUserQuestion` (regenerate from scratch vs. update, preserving `[x]`/done features). Both questions can be asked in one call.

### 2. Ask for the goal

Planning happens **before** code is written. Use `AskUserQuestion` for a single free-text question: *"What are you building and why? (1–3 sentences)"* (header `Goal`).

After the answer, silently read `ARCHITECTURE.md` if present for context. Only raise a follow-up if the goal clearly diverges from documented architecture, or if it implies a new dependency/product-fit question worth confirming.

### 3. Generate plan, show in browser, get approval

Write the plan sections and open the **plan-review UI** via a heredoc pipe (no temp file). Pass dependencies as an array of `"<name> — <why>"` strings (`[]` if none):

```sh
node <skill-dir>/server.mjs << 'PLAN_DATA'
{
  "mode": "plan-review",
  "branch": "<branch>",
  "title": "<plan title>",
  "plan": { "goal": "...", "architecture": "...", "keyDecisions": "...", "productFit": "..." },
  "dependencies": ["<pkg-or-service> — <why>"]
}
PLAN_DATA
```

The UI renders each section as markdown (click to edit, ⌘/Ctrl+Enter to save), a 💬 per-section comment thread, an editable dependencies chips panel, and a global comment box. Top-right controls are **Accept** / **Cancel** / **Send review** (see "Shared UI behavior" below).

Output handling:
- `{ "type": "plan-approved", "sections": {...}, "dependencies": [...] }` → write `PLAN.md` (Goal, Architecture, Dependencies, Key Decisions, Product Fit). **Then immediately continue to Step 4 — feature creation starts automatically.**
- `{ "type": "plan-feedback", "sections": {...}, "dependencies": [...], "comments": [...], "comment": "..." }` → revise the plan using the edited sections/deps as the new base, apply each `comments[]` entry and the global `comment`, and re-run this step.
- `{ "type": "cancel" }` → stop; tell the user the plan flow was cancelled.

### 4. Analyze the plan into features

Using the approved plan (and `ARCHITECTURE.md`), split the whole plan into meaningful, connected **features**:

- Each feature is a logical unit of work with a clear, descriptive name.
- Target ~200 lines of code (soft guideline, estimated from the plan). Flag features likely to exceed it.
- Record **dependencies** between features (which feature must be implemented first). Order features dependency-first and ensure the graph is acyclic.
- For each feature gather **relevant code snippets** — the most useful illustrative parts (interfaces, key functions, call sites), **not** full implementations — enough that an implementer can build it from the description + snippets + `ARCHITECTURE.md`.

If **Use existing PLAN.md** was chosen in Step 1, also collect git state (`git diff HEAD`, falling back to `git diff`) and derive snippets from the real diff; preserve any features already marked done.

### 5. Write FEATURES.md and the PLAN.md Features Index

**`FEATURES.md`** — per-feature detail:

```markdown
# Features

> **Plan:** <title>
> **Branch:** <branch>
> **Created:** <YYYY-MM-DD>
> **Progress:** 0/<N> done

---

## [ ] <feature-name>
- **description**: <one sentence>
- **implementation-notes**: <how to build it>
- **depends-on**: <other-feature-name(s) or none>
- **size**: <small|medium|large> (~<N> lines)
- **files**: `path/to/file.ts`
- **snippets**:
  ```<lang>
  <most relevant illustrative code>
  ```
```

Rules: `## [ ]` = pending, `## [x]` = done (preserve `**done**` date + notes). Flag oversized features with `- **⚠️ oversized**: ~<N> lines`.

**`PLAN.md`** — replace/add a `## Features Index` with the dependency graph and status:

```markdown
## Features Index

<!-- Line references into FEATURES.md; depends-on defines the implementation order -->
| Feature | Line | Status | Size | Depends on |
|---|---|---|---|---|
| config-module | 8 | [ ] pending | small | — |
| auth-middleware | 20 | [ ] pending | small | config-module |
| api-routes | 34 | [ ] pending | medium | auth-middleware |
```

### 6. Open the feature-plan UI

Run the server (default mode) via heredoc pipe. Use the `features` key; each feature carries its dependency and snippet data:

```sh
node <skill-dir>/server.mjs << 'PLAN_DATA'
{
  "branch": "<branch>",
  "plan": "<title>",
  "features": [
    {
      "name": "auth-middleware",
      "description": "JWT-based auth middleware",
      "implementationNotes": "Wrap protected routes; verify token from config secret.",
      "files": ["src/auth.ts"],
      "dependsOn": ["config-module"],
      "linesEstimate": 60,
      "size": "small",
      "status": "pending",
      "snippets": [{ "lang": "ts", "code": "export function requireAuth(req,res,next){ /* ... */ }" }]
    }
  ]
}
PLAN_DATA
```

Include `"status": "done"` for features already completed. The UI shows feature cards with dependency **graph visualization**, code snippets, per-feature comments, drag-to-move files, and LLM-backed **Split**/**Merge** buttons.

### 7. Process the server output

- `{ "type": "plan-adjustments", "moves": [...], "renames": [...], "descUpdates": [...] }` → apply to `FEATURES.md`, update the `PLAN.md` index, re-run from step 6.
- `{ "type": "split-request", "feature": "<name>", "content": "..." }` → **you (the LLM)** split that feature into ~200-line sub-features with clear names and dependencies, write them to `FEATURES.md`, update the index, and re-run from step 6.
- `{ "type": "merge-request", "features": ["a","b"] }` → **you (the LLM)** merge them meaningfully, give the result a clear name, rewire dependencies (drop the merged nodes, redirect references), update `FEATURES.md` + index, re-run from step 6.
- `{ "type": "plan-approved" }` (features accepted) → tell the user the feature breakdown is ready and they can run `/iterator-implementer` to build features in dependency order.
- `{ "type": "cancel" }` → stop.

## Shared UI behavior (all iterator UIs)

- All interaction happens in the browser and is sent back automatically via the local server — no manual copy/paste of JSON.
- Top-right controls: **Accept** (primary when no comment), **Cancel** (always), **Send review** (becomes primary once any comment is added), plus **Accept and commit** in the implementer UI.
- Closing the browser tab sends a `{ "type": "cancel" }` event, so a closed tab never leaves the flow hanging.

## Lifecycle

- **Created by:** `/iterator-plan-features` (PLAN.md + FEATURES.md)
- **Read by:** `/iterator-review` (review a feature), `/iterator-test-features` (test a feature), `/iterator-implementer` (build the next dependency-ready feature)
- **Status** (`[x]`/done) is mirrored between `FEATURES.md` and the `PLAN.md` index and persists across sessions.
