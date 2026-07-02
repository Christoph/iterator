# PLAN: Rename Features to Chunks + Sequential Implementer Flow

> **Resolved design decisions** (from review, 2026-07-01):
> 1. **UI model:** keep the existing local-server + browser pattern (see `ARCHITECTURE.md`). "Stays in the UI" means all interaction and feedback happen in the browser and flow back automatically through the local server — no manual copying of JSON prompts, no extra steps. UIs are **not** rendered inside the editor and split/merge are **not** in-browser LLM calls (the browser has no LLM access).
> 2. **File model:** two files — `PLAN.md` (chunk index + dependency graph + status) and `CHUNKS.md` (renamed from `FEATURES.md`; full per-chunk detail).
> 3. **Review skills:** keep both `/review` and the implementer's implementation-review UI. When `/review` runs standalone it first asks which chunk to review against.
> 4. **GUIDELINES.md:** optional — used when it exists, ignored when it does not. Not created by this work.

## Goal

Rename the current concept of **features** to **chunks**. A chunk is a meaningful, connected unit of implementation, roughly **200 lines of code**, produced by the AI from the overall plan. Add a sequential, dependency-aware flow: plan → chunk creation → implementation, with a new `/implementer` skill that builds chunks one at a time in dependency order.

## Core Concepts

### Chunks

- Replace the term **feature** with **chunk** throughout the UI, skills, docs, and data files. `FEATURES.md` is renamed to `CHUNKS.md`.
- The AI splits the whole plan into meaningful, connected chunks — each a logical unit of work, clearly named.
- Dependencies between chunks are recorded and visualized in the UI.
- Target size ~200 lines; this is a soft guideline (estimated from the plan before code exists), not a hard gate.

### Two-file layout (preserves context efficiency)

- **`PLAN.md`** — the plan narrative plus a **Chunks Index**: the ordered list of all chunks with their dependencies (the dependency graph) and status (`pending` / `done`). This is the small file Claude and `/implementer` read first to decide order.
- **`CHUNKS.md`** — one self-contained block per chunk with the detail: description, implementation notes, relevant code snippets, `depends-on`, size, and completion state. Loaded per-chunk via the index line numbers so context stays small.

Status lives in `CHUNKS.md` (checkbox per chunk) and is mirrored in the `PLAN.md` index, exactly like today's `[x]` mirroring.

## Sequential Flow

The workflow is sequential and guided:

1. Start with the plan flow (`/plan-features`).
2. Either create a new plan or use an existing `PLAN.md`.
3. When the user **accepts the plan, chunk creation starts immediately** (no separate invocation).
4. Accepted chunks — names, descriptions, implementation notes, dependencies, snippets — are written to `CHUNKS.md`; the chunk list + dependency graph + status are written to `PLAN.md`.
5. After chunk creation is accepted, implementation proceeds chunk by chunk via `/implementer`.

## AI-Driven Splitting & Merging

Split and merge are **LLM-driven via a round-trip through the local server** (the browser cannot call an LLM directly):

### Split
- The split control POSTs the selected plan/chunk content to the server as a `split-request`.
- The server prints it to stdout; **Claude** splits it into meaningful chunks (~200 LOC each), names each clearly, and returns dependency info.
- Claude re-runs the UI with the new chunk set.

### Merge
- A merge control POSTs a `merge-request` for the selected chunks.
- Claude combines them meaningfully, names the merged chunk, and **updates dependencies** to remove the merged nodes and rewire references.
- Claude re-runs the UI.

Both actions surface a brief "working…" state in the UI while Claude processes, since each is a round-trip rather than an instant browser update.

## Implementer Skill (`/implementer`)

A new skill that implements chunks in dependency order.

The skill:
- Reads `PLAN.md` (chunk index + dependency graph + status), then loads the target chunk's detail from `CHUNKS.md`.
- Picks the **next chunk whose dependencies are all `done`** (topological order). Detects and reports dependency **cycles**; never implements a chunk before its dependencies are complete.
- Implements the selected chunk using: the chunk description, implementation notes, relevant code snippets, `ARCHITECTURE.md`, and `GUIDELINES.md` **if it exists** (otherwise skipped).
- Opens an **implementation-review UI** showing: the chunk name, its description, the implementation diff/summary, and any reviewer notes.
- Continues to the next dependency-ready chunk as each is accepted.

### Accept and Commit

The implementation-review UI includes an **Accept and commit** button. When clicked:
- The implementation is accepted.
- Changes are committed to git with a message that includes the chunk name.
- Commit safety: if on the default branch (`main`), create/switch to a working branch first rather than committing directly to it.
- The chunk is marked **done** in `CHUNKS.md` and mirrored in the `PLAN.md` index (in the same commit).
- `/implementer` then offers the next dependency-ready chunk.

## UI Requirements

### Chunk view
- The former feature view becomes the **chunk view**.
- Allows adding a **comment** to a chunk.
- **Visualizes dependencies** between chunks (nodes + edges), using inline SVG/HTML — no third-party libraries, consistent with the dependency-free constraint.
- Clearly shows chunk names and relationships.
- Shows **relevant code snippets** (the most useful parts for judging/implementing the chunk) — **not** the full implementation. Pre-implementation these are AI-proposed illustrative snippets stored in `CHUNKS.md`.
- Chunk detail must be sufficient for an implementer to build it from the description + snippets + `ARCHITECTURE.md` (+ `GUIDELINES.md` if present).

### Consistent behavior across Plan / Review / Chunk / Implementation-review UIs
All UIs share the existing local-server + browser mechanism and behave consistently:

- All interaction and feedback happen **in the browser UI** and are sent back to Claude automatically via the local server — no manual JSON copy/paste, no prompt files left in the editor.
- **Top-right controls**, matching the current plan/review UIs:
  - **Accept**
  - **Cancel** (always available)
  - **Send review** — shown when applicable
  - **Accept and commit** — implementation-review UI only
- **Primary-action logic:** if no comment was added, the primary action is **Accept**; once a comment is added it becomes **Send review**.
- **Closing behavior:** closing the tab of any UI sends a **cancel** event to Claude (`beforeunload` → `sendBeacon('/cancel')`), so a closed tab never leaves the flow hanging. Applies to Plan, Review, Chunk, and Implementation-review UIs.

### Standalone review
`/review` still exists as its own skill. When run on its own, it first **asks which chunk to review against** (the implementer's per-chunk review covers the sequential flow; standalone `/review` lets the user target any chunk).

## Acceptance Criteria

- The term **feature** is renamed to **chunk** everywhere relevant, including `FEATURES.md` → `CHUNKS.md`.
- The AI can split a full plan into meaningful chunks (~200 LOC each), each a logical unit with a clear name.
- Dependencies between chunks are stored and visualized in the UI.
- The flow is sequential: plan → chunk creation → implementation; accepting a plan starts chunk creation immediately.
- `PLAN.md` holds the chunk list + dependency graph + status; `CHUNKS.md` holds per-chunk detail.
- Split and merge are LLM-driven (via the server round-trip); merge updates dependencies.
- Plan, review, chunk, and implementation-review UIs use the local-server + browser model; all feedback returns automatically with no manual JSON handling.
- Closing any UI tab sends cancel to Claude.
- Top-right primary action is **Accept** with no comment, **Send review** once a comment exists; Cancel always available.
- The chunk view allows commenting and shows relevant (not full) code snippets sufficient to implement the chunk.
- An `/implementer` skill exists, picks the next dependency-ready chunk from `PLAN.md`, detects cycles, and never runs a chunk before its dependencies are done.
- The implementer shows an implementation review with chunk info and an **Accept and commit** button.
- Accept-and-commit creates a git commit whose message includes the chunk name (branching off `main` if needed) and marks the chunk done in `CHUNKS.md` + `PLAN.md`.
- `GUIDELINES.md` is used when present and ignored when absent.
