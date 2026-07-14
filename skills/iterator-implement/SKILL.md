---
name: iterator-implement
description: Implement features in dependency waves from the memory/ bundle. Builds every feature whose dependencies are all done — using each feature's tests as the goal when they exist (red/green flow, drive them green before review) — auto-opens the review UI scoped to the wave, and on Accept and commit commits each feature (feature(<slug>) with a Feature trailer), flips its status to done, records the commits, and — when okf-memory shares the bundle — evaluates whether the accepted work should create or update memory concepts. Use when the user types /iterator-implement, wants to build the next feature(s), or wants to work through the feature plan.
---

# iterator-implement

The third step of the iterator flow: **plan → feature → implement → review**.
Implements features in **dependency waves**: every pending feature whose
dependencies are all done is mutually independent by construction, so one
round builds them all, reviews them together, and on accept commits each
feature separately and marks it done. Features unlocked by this wave become the
next wave.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-implement`, wants to build the next feature(s),
or wants to work through the feature plan. If `memory/features/` has no feature
files, tell the user to run `/iterator-plan` → `/iterator-feature` first and
stop. If the user's message contains a result payload from a previous session
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it
(step 5) first.

## Steps

### 1. Pick the dependency-ready wave

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

Do **not** read bundle files yourself. `wave` is every dependency-ready
pending feature with its full contract, in topological order; the payload's
`advice` string tells you what to do when the wave is empty, only drafts
exist, or pending features are `stuck` (cycle / missing dependency — report it
and stop; never guess an order). Follow it.

- Implement the whole `wave`. **Never implement a feature before its
  dependencies are done.**
- If the user named a specific feature, it must appear in `ready`; implement
  just that feature (a one-feature wave). If not ready, name the missing
  dependency (from `blocked`) and stop.
- A very large wave is still one round: if building it all would be unwieldy
  (more than ~5 features), take the first few in order and say which were
  deferred.

### 2. Implement every feature — tests are the goal when they exist

Implement the wave feature by feature, in order, using each contract's
implementation notes, snippets, `ARCHITECTURE.md` (read if present), and
`GUIDELINES.md` only if it exists. Keep each feature's edits scoped to its
`files` where possible — wave features are committed one by one in step 5, so
keep their edits separable.

**Memory first:** before coding a feature, read the files in its contract's
`relevantMemories` (the feature's stored `memories:` reading list unioned with
a fresh anchor match; each entry carries the absolute `path` of one knowledge
concept) — and ONLY those; never crawl all of `memory/`. Treat `pitfalls/*`
entries as constraints (a known sharp edge in exactly the files you are about
to change), `architecture/*` and `patterns/*` as how the surrounding code
expects to be extended. An empty list means no anchored knowledge — proceed
normally.

**Decision conflicts:** if a wave feature's contract carries `conflicts`
(recorded decision concepts the feature contradicts), do **not** implement it
silently — surface the conflict to the user first and let them resolve it
(change the feature, or update the decision via `/iterator-knowledge`).

**Design quality:** if any feature touches frontend/UI surface, follow the
`/iterator-design` skill while building. The payload's `designFile` tells you
the state: non-null → read `memory/design.md` and follow its params (they win
over generic taste); null → run `/iterator-design`'s first-time capture once,
**before** styling the first UI feature. Run its self-check before opening the
review UI. Skip silently if no feature has UI surface.

**Green gate (per feature):** if a feature has `tests` (written red by
`/iterator-test`), they define done. After implementing it, run exactly that
feature's test files and loop *implement → run → fix* until they pass —
**before** moving to the next wave feature. Never weaken or delete a test to
get green; if a test looks wrong, say so. If a feature's tests are still red
after a few honest attempts, stop and show the user the real failing output,
then let them choose: keep fixing, open the review anyway (the red badge will
be visible), or pause. Features without tests skip this gate — not an error.

### 3. Evaluate the memory impact (okf-memory shared bundle)

An accepted feature is also the moment the knowledge base can silently go
stale — check now, while the diff is in front of you:

```sh
node <skill-dir>/../iterator/gather.mjs --step memorize
```

If `okf` is `false`, skip this step entirely (do not create areas uninvited).
Otherwise decide, for the wave's diff **plus** any `pendingCommits` (commits
since `last_memorized_commit` nobody memorized yet — usually your own
`test(<slug>)` commits): does any of it change **lasting project knowledge**
— architecture, a decision, a pattern/convention, a pitfall, or setup?
Compare against `areas` (the existing concept inventory). Most features change
none — an empty proposal list is the normal outcome. Draft a card only when
an existing concept is now wrong/incomplete (`update`), obsolete (`delete`),
or a genuinely new durable fact appeared (`create`):

```json
{ "action": "create|update|delete", "area": "patterns", "slug": "kebab-slug",
  "type": "Pattern", "title": "…", "description": "one line for indexes",
  "reason": "why this feature changes it", "body": "the concept markdown" }
```

If `extensionsContract` is set, `memory/EXTENSIONS.md` documents the bundle's
write contract — follow it. Do not memorize code minutiae the repo already
records; when `pendingCount` > 20, evaluate only the wave's diff and note
that `/iterator-memorize` should handle the backlog.

### 4. Auto-open the review UI (commit mode)

The review payload (diff parsed into hunks, mapped to features, stats) is
computed by script; you add only the commit-mode fields:

```sh
node <skill-dir>/../iterator/gather.mjs --step review --feature <slug>   # one-feature wave
node <skill-dir>/../iterator/gather.mjs --step review                  # multi-feature wave
```

Take the printed JSON and set `"mode": "commit"`; for each reviewed feature
with tests, set its entry's `"tests": { "status": "<red|green>", "total": N,
"passing": N }` from your green-gate runs; when step 3 produced proposals,
add `"memory": { "proposals": [ … ] }` (include `reason` — the UI shows it).
Pipe the result into `node <skill-dir>/../iterator/server.mjs` via a heredoc.
The UI shows test badges and the memory cards as toggleable items exactly
where the commit decision happens.

### 5. Process the result (one JSON line)

- `{ "type": "accept-commit", "features": [...], "memory": {...} }` → **the
  entire acceptance is one deterministic write** — branch safety, per-feature
  staging and `feature(<slug>)` commits with `Feature:` trailers, `status: done`
  flips, sha recording, memory-card application, pointer advance, and the
  bookkeeping commit all happen inside the writer:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'ACCEPT_WRITE'
  { "op": "accept-commit",
    "features": [ { "slug": "<slug>", "testsStatus": "<red|green>", "summary": "<short summary>" } ],
    "memory": { "proposals": [ <your step-3 cards> ], "accepted": <the UI result's memory.accepted> },
    "advance": true }
  ACCEPT_WRITE
  ```

  Per feature: `testsStatus` only when it has tests — the color of the last
  real run (keep `red` if the user accepted with red tests); `summary` is
  your one-line commit summary. `memory.proposals` are the full step-3 cards;
  the writer keeps only the ones in `accepted`. Set `"advance": true` **only**
  when step 3's payload had `baseValid: true` and you evaluated all
  `pendingCommits` (pointer rule: never advance past commits nobody looked
  at — if `pendingCount` was > 20, set it `false` and tell the user
  `/iterator-memorize` has a backlog). `advance` with no cards is correct —
  "nothing worth memorizing" also means the pointer is up to date.

  The writer is resumable (already-done features are skipped). The review UI
  collects a disposition for every uncategorized file (`uncategorized:
  [{path, feature|'skip'}]` in its accept result — pipe it through verbatim);
  with `block_commit_on_leftovers` on, the writer **fails before committing**
  if any file is left undisposed — relay its error rather than working around
  it. Its result reports `uncommitted` (explicit skips) and `leftovers` (what
  actually remains dirty after the commits) — tell the user about both, never
  force-commit them. Report what was committed (and which memories were
  written/skipped), then offer the next dependency-ready wave (loop to
  step 1). If this wave finished the plan, offer **plan retirement** instead
  (the `/iterator` hub skill's retire flow).

- `{ "type": "review-feedback", ... }` → revise the implementation per the
  per-feature notes and line comments, **re-run the affected features' tests**
  (the green gate applies to every round), refresh the memory proposals if
  the revision changes what is worth memorizing, then re-run from step 4 with
  the fresh test state. **Do not commit yet.**

- `cancel` / `timeout` → relay the result's `report` and stop without
  committing; the working-tree changes remain for the user to inspect.

## Auto mode (`--auto`)

When invoked as `/iterator-implement <feature> --auto` (dispatched by the
auto-mode driver, never by hand):

- Implement **only the named feature** (not the whole wave). All quality gates
  above apply unchanged — memory first, design quality, and the green gate.
- On a rework round the feature's `# Review` section carries the agent
  reviewer's notes (newest first) — read them via
  `gather.mjs --step review --feature <slug>`'s feature payload or the feature
  contract, and address every point.
- **Do NOT open the review UI and do NOT commit.** Finish the implementation
  (tests green when the feature has tests), then report in one short paragraph
  what changed and stop — the driver dispatches the agent review as the next
  turn. If the feature cannot be finished (tests stuck red, missing
  precondition), say so plainly and stop; the driver counts the failed review
  rounds and escalates to the human.
