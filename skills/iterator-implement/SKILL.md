---
name: iterator-implement
description: Implement chunks in dependency waves from the memory/ bundle. Builds every chunk whose dependencies are all done — using each chunk's tests as the goal when they exist (red/green flow, drive them green before review) — auto-opens the review UI scoped to the wave, and on Accept and commit commits each chunk (chunk(<slug>) with a Chunk trailer), flips its status to done, records the commits, and — when okf-memory shares the bundle — evaluates whether the accepted work should create or update memory concepts. Use when the user types /iterator-implement, wants to build the next chunk(s), or wants to work through the chunk plan.
---

# iterator-implement

The third step of the iterator flow: **plan → chunk → implement → review**.
Implements **chunks** in dependency waves from the `memory/` bundle. A wave is
every pending chunk whose dependencies are all done — they are mutually
independent by construction, so one round builds them all, then reviews them
together. On accept each chunk gets its own commit and is marked done; when the
bundle is shared with **okf-memory**, the accepted work is evaluated for
durable knowledge and the memory areas are updated in the same round. Then it
offers the next wave.

## When to use this skill

When the user types `/iterator-implement`, wants to build the next chunk(s), or
wants to work through the chunk plan. If `memory/chunks/` has no chunk files,
tell the user to run `/iterator-plan` → `/iterator-chunk` first and stop.

If the user's message contains a result payload from a previous session
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it (step 5)
before continuing.

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below.
`iterator_gather { step: "implement" }` replaces the gather pipe;
`iterator_gather { step: "memorize" }` replaces the memorize gather;
`iterator_ui { step: "review", extra: { mode: "commit", memory: {...} } }`
(plus `chunk: "<slug>"` for a single-chunk wave and per-chunk `tests`) opens
the commit-review — it gathers the diff itself, your `extra` carries only the
test summary and memory proposals; `iterator_write` replaces the write.mjs
heredocs. Steps, payloads, and rules are unchanged. In pi, `/iterator-next`
implements the next ready wave directly, and a bare `/iterator-implement`
offers a terminal chunk picker.

## Steps

### 1. Pick the dependency-ready wave

Selection is scripted — do **not** read bundle files yourself:

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

It prints `{ next, wave, ready, drafts, blocked, stuck, designFile, progress }`:
`wave` is **every** dependency-ready **pending** chunk **with its full
contract** (implementation notes, snippets, files, blast radius, tests + test
status, and `relevantMemories` — the knowledge concepts whose `files:`
anchors intersect the chunk's files), in index (topological) order; `next`
repeats the first for older flows; `blocked` lists what each remaining chunk
is waiting on; `designFile` is the path of `memory/design.md` when the
project's design params have been captured (`null` before the first UI
chunk). Chunks with
`status: draft` are an unaccepted proposal — they never appear in
`wave`/`ready`; if only drafts exist, tell the user to accept the chunk set
first (`/iterator-chunk`) and stop.

- Implement the whole `wave`. **Never implement a chunk before its
  dependencies are done.**
- If `stuck` is true (pending chunks remain but none is ready), there is a
  dependency cycle or a dependency on a non-existent chunk. Report it and stop
  — do not guess an order.
- If the user named a specific chunk, it must appear in `ready`; implement
  just that chunk (a one-chunk wave). If it is not ready, name the missing
  dependency (from `blocked`) and stop.
- A very large wave is still one round: if building it all would be unwieldy
  (say more than ~5 chunks), take the first few in order and say which ones
  were deferred to the next round.

### 2. Implement every chunk in the wave — tests are the goal when they exist

Implement the wave chunk by chunk, in the given order, using each contract's
implementation notes, snippets, `ARCHITECTURE.md` (read if present), and
`GUIDELINES.md` **only if it exists** (read and follow it; skip silently if
absent). Make the actual code changes in the working tree, scoped to each
chunk's `files` where possible — wave chunks are independent, so keep their
edits separable (they are committed one by one in step 5).

**Memory first:** before coding a chunk, read the files listed in its
contract's `relevantMemories` (each entry carries the absolute `path` of one
knowledge concept anchored to the chunk's files) — and ONLY those; never
crawl all of `memory/`. Treat `pitfalls/*` entries as constraints (a known
sharp edge in exactly the files you are about to change), `architecture/*`
and `patterns/*` as how the surrounding code expects to be extended. An empty
list means no anchored knowledge exists — proceed normally.

**Design quality:** if any chunk touches frontend/UI surface (markup, styles,
client-side components), follow the `/iterator-design` skill while building.
The gather payload's `designFile` tells you the state: non-null → read
`memory/design.md` and follow its params (they win over generic taste);
null → run `/iterator-design`'s first-time capture (derive → one confirm →
persist) **once, before** styling the first UI chunk, so every UI chunk in
this and every later session shares the same direction, typography, color,
spacing, and responsive rules. Run its self-check before opening the review
UI. Skip silently if no chunk has UI surface.

**Green gate (per chunk):** if a chunk has `tests` (written red by
`/iterator-test`), they define done for that chunk. After implementing it, run
exactly that chunk's test files and loop *implement → run → fix* until they
pass — **before** moving to the next wave chunk. Never weaken or delete a test
to get green; if a test looks wrong, say so. If a chunk's tests are still red
after a few honest attempts, stop and show the user the real failing output,
then let them choose: keep fixing, open the review anyway (the red badge will
be visible), or pause. Chunks without tests skip this gate — it is not an
error.

### 3. Evaluate the memory impact (okf-memory shared bundle)

iterator and okf-memory share the same `memory/` bundle: iterator owns
`plan.md`/`chunks/`/`design.md`, okf-memory owns the knowledge areas
(`architecture/`, `decisions/`, `patterns/`, `pitfalls/`, `setup/`) and the
`last_memorized_commit` pointer in the root index. So an accepted chunk is
also the moment the knowledge base can silently go stale — check it now,
while the diff is in front of you:

```sh
node <skill-dir>/../iterator/gather.mjs --step memorize
```

It prints `{ okf, areas, lastMemorizedCommit, baseValid, pendingCount,
pendingCommits, head, extensionsContract }`. If `okf` is `false`, skip this
step entirely — the project does not use okf-memory (do not create areas
uninvited).

Otherwise decide, for the wave's diff **plus** any `pendingCommits` (commits
since `last_memorized_commit` that nobody memorized yet — usually just your
own `test(<slug>)` commits): does any of it change **lasting project
knowledge** — architecture, a decision, a pattern/convention, a pitfall, or
setup? Compare against `areas` (the existing concept inventory: id, title,
description). Most chunks change none — an empty proposal list is the normal
outcome, not a failure. Draft a proposal card only when an existing concept
is now wrong/incomplete (`update`), obsolete (`delete`), or a genuinely new
durable fact appeared (`create`):

```json
{ "action": "create|update|delete", "area": "patterns", "slug": "kebab-slug",
  "type": "Pattern", "title": "…", "description": "one line for indexes",
  "reason": "why this chunk changes it", "body": "the concept markdown" }
```

If `extensionsContract` is set, `memory/EXTENSIONS.md` documents the bundle's
write contract — follow it. Do not memorize code minutiae the repo already
records; when `pendingCount` is large (> 20), evaluate only the wave's diff
and note that `/okf-memorize` should handle the backlog.

### 4. Auto-open the review UI (commit mode)

The review payload (diff parsed into hunks, mapped to chunks, stats) is
computed by script; you only add the commit-mode fields. Gather it, then pipe
the augmented payload into the **shared UI server** (both ship with the
`/iterator` hub skill):

```sh
node <skill-dir>/../iterator/gather.mjs --step review --chunk <slug>   # one-chunk wave
node <skill-dir>/../iterator/gather.mjs --step review                  # multi-chunk wave
```

Take the printed JSON and set `"mode": "commit"`; for each reviewed chunk
that has tests, set its entry's `"tests": { "status": "<red|green>",
"total": N, "passing": N }` from your green-gate runs (omit otherwise); and
when step 3 produced proposals, add
`"memory": { "proposals": [ … ] }` (the cards above — include `reason`, the
UI shows it). Pipe the result into `node <skill-dir>/../iterator/server.mjs`
via a heredoc. The UI shows a 🔴/🟢 badge next to each chunk and the memory
cards as toggleable items (default: apply), so both the test state and the
knowledge-base write are visible exactly where the commit decision happens.

The UI shows the wave's chunks, their diffs grouped by file, per-line
comments, and the **Accept and commit** / **Send review** primary. Closing
the tab sends `{ "type": "cancel" }`; a 2h idle sends `{ "type": "timeout" }`.

### 5. Process the result

- `{ "type": "accept-commit", "chunks": [...], "memory": {...} }` → the wave
  is accepted (older UIs send only `"chunk"` — the writer treats it as a
  one-chunk list). **The entire acceptance is one deterministic write** —
  branch safety, per-chunk staging and `chunk(<slug>)` commits with `Chunk:`
  trailers, `status: done` flips, commit-sha recording, memory-card
  application, pointer advance, and the bookkeeping commit all happen inside
  the writer. Pipe the UI result in, augmented with three fields you own:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'ACCEPT_WRITE'
  {
    "op": "accept-commit",
    "chunks": [
      { "slug": "<slug>", "testsStatus": "<red|green>", "summary": "<short summary>" }
    ],
    "memory": { "proposals": [ <your step-3 cards> ], "accepted": <the UI result's memory.accepted> },
    "advance": true
  }
  ACCEPT_WRITE
  ```

  Per chunk: `testsStatus` only when it has tests — the color of the last
  real run (normally `red → green`; keep `red` if the user accepted with red
  tests); `summary` is your one-line commit summary (defaults to the chunk
  title). `memory.proposals` are the full cards from step 3; the writer keeps
  only the ones in `accepted` and drops the toggled-off rest. Set
  `"advance": true` **only** when step 3's payload had `baseValid: true` and
  you evaluated all `pendingCommits` (pointer rule: never advance past
  commits nobody looked at — if `pendingCount` was > 20, set it `false` and
  tell the user `/okf-memorize` has a backlog). `advance` with no cards is
  correct — "nothing worth memorizing" also means the pointer is up to date.

  The writer is resumable (already-done chunks are skipped) and returns
  `{ branch, committed: [{chunk, sha}], skipped, uncommitted, memorize }` —
  if `uncommitted` lists files, they matched no accepted chunk; tell the user
  instead of force-committing them. Report what was committed (and which
  memories were written/skipped), then offer to continue with the next
  dependency-ready wave (loop to step 1). If this wave finished the plan
  (progress shows every chunk done), offer **plan retirement** instead: the
  `/iterator` hub skill's retire flow condenses the plan + chunks into a
  `decisions/` concept and archives the chunk files (`write.mjs`
  op `retire-plan`).

- `{ "type": "review-feedback", "features": [...], "lineComments": [...] }` →
  revise the implementation per the feedback (per-chunk notes/status and line
  comments), **re-run the affected chunks' tests** (the green gate applies to
  every round, not just the first), refresh the memory proposals if the
  revision changes what is worth memorizing, then re-run from step 4 with the
  fresh test state. **Do not commit yet.**

- `{ "type": "cancel" }` or `{ "type": "timeout" }` → stop without committing; the
  working-tree changes remain for the user to inspect. Report that
  implementation was paused.

## Wave flow

`/iterator-implement` runs one dependency wave per round: every ready chunk is
built, the wave is reviewed once, and each chunk is committed separately on
Accept, so progress is durable, commits stay chunk-scoped, and the dependency
order is always respected. Run it again (or accept-and-continue) to build the
next wave — chunks unlocked by this wave's `done` flips become the next
`wave`. `/iterator-review` owns review notes; this skill owns the `done`
state and the okf-memory bridge.

## Relationship to the other skills

- `/iterator-plan` + `/iterator-chunk` produce the `memory/` bundle and chunk
  files.
- `/iterator-implement` builds chunks in dependency waves and owns `done`
  (this skill).
- `/iterator-review` reviews a chunk's diff (this skill reuses its UI in commit
  mode); `/iterator-test` generates a chunk's tests — written red before
  implementation, they are this skill's definition of done.
- `/iterator-design` owns the project's design params (`memory/design.md`);
  this skill applies them on every chunk with UI surface.
- **okf-memory** (`/okf`, `/okf-init`, `/okf-memorize`, `/okf-consolidate`)
  shares the same bundle: this skill keeps its knowledge areas and
  `last_memorized_commit` current as chunks land (step 3/5); the okf skills
  own bulk memorization and consolidation.
