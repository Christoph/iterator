---
name: iterator-implement
description: Implement chunks in dependency waves from the memory/ bundle. Builds every chunk whose dependencies are all done — using each chunk's tests as the goal when they exist (red/green flow, drive them green before review) — auto-opens the review UI scoped to the wave, and on Accept and commit commits each chunk (chunk(<slug>) with a Chunk trailer), flips its status to done, records the commits, and — when okf-memory shares the bundle — evaluates whether the accepted work should create or update memory concepts. Use when the user types /iterator-implement, wants to build the next chunk(s), or wants to work through the chunk plan.
---

# iterator-implement

The third step of the iterator flow: **plan → chunk → implement → review**.
Implements chunks in **dependency waves**: every pending chunk whose
dependencies are all done is mutually independent by construction, so one
round builds them all, reviews them together, and on accept commits each
chunk separately and marks it done. Chunks unlocked by this wave become the
next wave.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-implement`, wants to build the next chunk(s),
or wants to work through the chunk plan. If `memory/chunks/` has no chunk
files, tell the user to run `/iterator-plan` → `/iterator-chunk` first and
stop. If the user's message contains a result payload from a previous session
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it
(step 5) first.

## Steps

### 1. Pick the dependency-ready wave

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

Do **not** read bundle files yourself. `wave` is every dependency-ready
pending chunk with its full contract, in topological order; the payload's
`advice` string tells you what to do when the wave is empty, only drafts
exist, or pending chunks are `stuck` (cycle / missing dependency — report it
and stop; never guess an order). Follow it.

- Implement the whole `wave`. **Never implement a chunk before its
  dependencies are done.**
- If the user named a specific chunk, it must appear in `ready`; implement
  just that chunk (a one-chunk wave). If not ready, name the missing
  dependency (from `blocked`) and stop.
- A very large wave is still one round: if building it all would be unwieldy
  (more than ~5 chunks), take the first few in order and say which were
  deferred.

### 2. Implement every chunk — tests are the goal when they exist

Implement the wave chunk by chunk, in order, using each contract's
implementation notes, snippets, `ARCHITECTURE.md` (read if present), and
`GUIDELINES.md` only if it exists. Keep each chunk's edits scoped to its
`files` where possible — wave chunks are committed one by one in step 5, so
keep their edits separable.

**Memory first:** before coding a chunk, read the files in its contract's
`relevantMemories` (each carries the absolute `path` of one knowledge concept
anchored to the chunk's files) — and ONLY those; never crawl all of
`memory/`. Treat `pitfalls/*` entries as constraints (a known sharp edge in
exactly the files you are about to change), `architecture/*` and `patterns/*`
as how the surrounding code expects to be extended. An empty list means no
anchored knowledge — proceed normally.

**Design quality:** if any chunk touches frontend/UI surface, follow the
`/iterator-design` skill while building. The payload's `designFile` tells you
the state: non-null → read `memory/design.md` and follow its params (they win
over generic taste); null → run `/iterator-design`'s first-time capture once,
**before** styling the first UI chunk. Run its self-check before opening the
review UI. Skip silently if no chunk has UI surface.

**Green gate (per chunk):** if a chunk has `tests` (written red by
`/iterator-test`), they define done. After implementing it, run exactly that
chunk's test files and loop *implement → run → fix* until they pass —
**before** moving to the next wave chunk. Never weaken or delete a test to
get green; if a test looks wrong, say so. If a chunk's tests are still red
after a few honest attempts, stop and show the user the real failing output,
then let them choose: keep fixing, open the review anyway (the red badge will
be visible), or pause. Chunks without tests skip this gate — not an error.

### 3. Evaluate the memory impact (okf-memory shared bundle)

An accepted chunk is also the moment the knowledge base can silently go
stale — check now, while the diff is in front of you:

```sh
node <skill-dir>/../iterator/gather.mjs --step memorize
```

If `okf` is `false`, skip this step entirely (do not create areas uninvited).
Otherwise decide, for the wave's diff **plus** any `pendingCommits` (commits
since `last_memorized_commit` nobody memorized yet — usually your own
`test(<slug>)` commits): does any of it change **lasting project knowledge**
— architecture, a decision, a pattern/convention, a pitfall, or setup?
Compare against `areas` (the existing concept inventory). Most chunks change
none — an empty proposal list is the normal outcome. Draft a card only when
an existing concept is now wrong/incomplete (`update`), obsolete (`delete`),
or a genuinely new durable fact appeared (`create`):

```json
{ "action": "create|update|delete", "area": "patterns", "slug": "kebab-slug",
  "type": "Pattern", "title": "…", "description": "one line for indexes",
  "reason": "why this chunk changes it", "body": "the concept markdown" }
```

If `extensionsContract` is set, `memory/EXTENSIONS.md` documents the bundle's
write contract — follow it. Do not memorize code minutiae the repo already
records; when `pendingCount` > 20, evaluate only the wave's diff and note
that `/okf-memorize` should handle the backlog.

### 4. Auto-open the review UI (commit mode)

The review payload (diff parsed into hunks, mapped to chunks, stats) is
computed by script; you add only the commit-mode fields:

```sh
node <skill-dir>/../iterator/gather.mjs --step review --chunk <slug>   # one-chunk wave
node <skill-dir>/../iterator/gather.mjs --step review                  # multi-chunk wave
```

Take the printed JSON and set `"mode": "commit"`; for each reviewed chunk
with tests, set its entry's `"tests": { "status": "<red|green>", "total": N,
"passing": N }` from your green-gate runs; when step 3 produced proposals,
add `"memory": { "proposals": [ … ] }` (include `reason` — the UI shows it).
Pipe the result into `node <skill-dir>/../iterator/server.mjs` via a heredoc.
The UI shows test badges and the memory cards as toggleable items exactly
where the commit decision happens.

### 5. Process the result (one JSON line)

- `{ "type": "accept-commit", "chunks": [...], "memory": {...} }` → **the
  entire acceptance is one deterministic write** — branch safety, per-chunk
  staging and `chunk(<slug>)` commits with `Chunk:` trailers, `status: done`
  flips, sha recording, memory-card application, pointer advance, and the
  bookkeeping commit all happen inside the writer:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'ACCEPT_WRITE'
  { "op": "accept-commit",
    "chunks": [ { "slug": "<slug>", "testsStatus": "<red|green>", "summary": "<short summary>" } ],
    "memory": { "proposals": [ <your step-3 cards> ], "accepted": <the UI result's memory.accepted> },
    "advance": true }
  ACCEPT_WRITE
  ```

  Per chunk: `testsStatus` only when it has tests — the color of the last
  real run (keep `red` if the user accepted with red tests); `summary` is
  your one-line commit summary. `memory.proposals` are the full step-3 cards;
  the writer keeps only the ones in `accepted`. Set `"advance": true` **only**
  when step 3's payload had `baseValid: true` and you evaluated all
  `pendingCommits` (pointer rule: never advance past commits nobody looked
  at — if `pendingCount` was > 20, set it `false` and tell the user
  `/okf-memorize` has a backlog). `advance` with no cards is correct —
  "nothing worth memorizing" also means the pointer is up to date.

  The writer is resumable (already-done chunks are skipped). If its result
  lists `uncommitted` files, they matched no accepted chunk — tell the user
  instead of force-committing them. Report what was committed (and which
  memories were written/skipped), then offer the next dependency-ready wave
  (loop to step 1). If this wave finished the plan, offer **plan retirement**
  instead (the `/iterator` hub skill's retire flow).

- `{ "type": "review-feedback", ... }` → revise the implementation per the
  per-chunk notes and line comments, **re-run the affected chunks' tests**
  (the green gate applies to every round), refresh the memory proposals if
  the revision changes what is worth memorizing, then re-run from step 4 with
  the fresh test state. **Do not commit yet.**

- `cancel` / `timeout` → relay the result's `report` and stop without
  committing; the working-tree changes remain for the user to inspect.
