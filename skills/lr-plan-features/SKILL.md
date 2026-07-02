---
name: lr-plan-features
description: Break a plan into small, dependency-aware chunks for sequential implementation and review. Creates PLAN.md (chunk index + dependency graph) and CHUNKS.md (per-chunk detail with code snippets). Enforces ~200-line chunks. Opens an interactive browser UI. Use when the user types /lr-plan-features, wants to plan work, or needs to organize changes into chunks.
---

# lr-plan-features

Turns a goal (or an existing `PLAN.md`) into a small, structured plan and a set of **chunks** — meaningful, connected units of implementation of roughly 200 lines each, in dependency order. The workflow is sequential and guided: **plan → chunk creation → implementation**. Accepting the plan starts chunk creation immediately; chunks are then built one at a time by `/lr-implementer`.

Two files hold the result (keeping context small):
- **`PLAN.md`** — the plan narrative plus a `## Chunks Index`: the ordered chunk list with dependencies (the dependency graph) and status.
- **`CHUNKS.md`** — one self-contained block per chunk: description, implementation notes, relevant code snippets, `depends-on`, size, and status.

## When to use this skill

When the user types `/lr-plan-features`, wants to organize work into chunks, or needs a chunk breakdown before implementing.

If the user's message contains structured adjustments (`MOVE:`, `RENAME:`, `DESCRIPTION UPDATE:`) apply them to `CHUNKS.md` and regenerate the UI (skip to step 6). If it contains a `split-request` or `merge-request` payload, handle it per step 7.

## Steps

### 1. Check for existing PLAN.md and CHUNKS.md

```sh
test -f PLAN.md && echo "plan:exists" || echo "plan:missing"
test -f CHUNKS.md && echo "chunks:exists" || echo "chunks:missing"
```

**If `PLAN.md` exists**, use `AskUserQuestion`:

```
question: "A PLAN.md already exists. What would you like to do?"
header: "PLAN.md"
options:
  - "Use existing PLAN.md" → read it, skip to Step 4
  - "Create a new plan" → continue to Step 2
```

**If `CHUNKS.md` also exists**, add a second `AskUserQuestion` (regenerate from scratch vs. update, preserving `[x]`/done chunks). Both questions can be asked in one call.

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
- `{ "type": "plan-approved", "sections": {...}, "dependencies": [...] }` → write `PLAN.md` (Goal, Architecture, Dependencies, Key Decisions, Product Fit). **Then immediately continue to Step 4 — chunk creation starts automatically.**
- `{ "type": "plan-feedback", "sections": {...}, "dependencies": [...], "comments": [...], "comment": "..." }` → revise the plan using the edited sections/deps as the new base, apply each `comments[]` entry and the global `comment`, and re-run this step.
- `{ "type": "cancel" }` → stop; tell the user the plan flow was cancelled.

### 4. Analyze the plan into chunks

Using the approved plan (and `ARCHITECTURE.md`), split the whole plan into meaningful, connected **chunks**:

- Each chunk is a logical unit of work with a clear, descriptive name.
- Target ~200 lines of code (soft guideline, estimated from the plan). Flag chunks likely to exceed it.
- Record **dependencies** between chunks (which chunk must be implemented first). Order chunks dependency-first and ensure the graph is acyclic.
- For each chunk gather **relevant code snippets** — the most useful illustrative parts (interfaces, key functions, call sites), **not** full implementations — enough that an implementer can build it from the description + snippets + `ARCHITECTURE.md`.

If **Use existing PLAN.md** was chosen in Step 1, also collect git state (`git diff HEAD`, falling back to `git diff`) and derive snippets from the real diff; preserve any chunks already marked done.

### 5. Write CHUNKS.md and the PLAN.md Chunks Index

**`CHUNKS.md`** — per-chunk detail:

```markdown
# Chunks

> **Plan:** <title>
> **Branch:** <branch>
> **Created:** <YYYY-MM-DD>
> **Progress:** 0/<N> done

---

## [ ] <chunk-name>
- **description**: <one sentence>
- **implementation-notes**: <how to build it>
- **depends-on**: <other-chunk-name(s) or none>
- **size**: <small|medium|large> (~<N> lines)
- **files**: `path/to/file.ts`
- **snippets**:
  ```<lang>
  <most relevant illustrative code>
  ```
```

Rules: `## [ ]` = pending, `## [x]` = done (preserve `**done**` date + notes). Flag oversized chunks with `- **⚠️ oversized**: ~<N> lines`.

**`PLAN.md`** — replace/add a `## Chunks Index` with the dependency graph and status:

```markdown
## Chunks Index

<!-- Line references into CHUNKS.md; depends-on defines the implementation order -->
| Chunk | Line | Status | Size | Depends on |
|---|---|---|---|---|
| config-module | 8 | [ ] pending | small | — |
| auth-middleware | 20 | [ ] pending | small | config-module |
| api-routes | 34 | [ ] pending | medium | auth-middleware |
```

### 6. Open the chunk-plan UI

Run the server (default mode) via heredoc pipe. Use the `chunks` key; each chunk carries its dependency and snippet data:

```sh
node <skill-dir>/server.mjs << 'PLAN_DATA'
{
  "branch": "<branch>",
  "plan": "<title>",
  "chunks": [
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

Include `"status": "done"` for chunks already completed. The UI shows chunk cards with dependency **graph visualization**, code snippets, per-chunk comments, drag-to-move files, and LLM-backed **Split**/**Merge** buttons.

### 7. Process the server output

- `{ "type": "plan-adjustments", "moves": [...], "renames": [...], "descUpdates": [...] }` → apply to `CHUNKS.md`, update the `PLAN.md` index, re-run from step 6.
- `{ "type": "split-request", "chunk": "<name>", "content": "..." }` → **you (the LLM)** split that chunk into ~200-line sub-chunks with clear names and dependencies, write them to `CHUNKS.md`, update the index, and re-run from step 6.
- `{ "type": "merge-request", "chunks": ["a","b"] }` → **you (the LLM)** merge them meaningfully, give the result a clear name, rewire dependencies (drop the merged nodes, redirect references), update `CHUNKS.md` + index, re-run from step 6.
- `{ "type": "plan-approved" }` (chunks accepted) → tell the user the chunk breakdown is ready and they can run `/lr-implementer` to build chunks in dependency order.
- `{ "type": "cancel" }` → stop.

## Shared UI behavior (all local-review UIs)

- All interaction happens in the browser and is sent back automatically via the local server — no manual copy/paste of JSON.
- Top-right controls: **Accept** (primary when no comment), **Cancel** (always), **Send review** (becomes primary once any comment is added), plus **Accept and commit** in the implementer UI.
- Closing the browser tab sends a `{ "type": "cancel" }` event, so a closed tab never leaves the flow hanging.

## Lifecycle

- **Created by:** `/lr-plan-features` (PLAN.md + CHUNKS.md)
- **Read by:** `/lr-review` (review a chunk), `/lr-test-features` (test a chunk), `/lr-implementer` (build the next dependency-ready chunk)
- **Status** (`[x]`/done) is mirrored between `CHUNKS.md` and the `PLAN.md` index and persists across sessions.
