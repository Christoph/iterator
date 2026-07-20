---
name: iterator-implement
description: Implement the next feature from the memory/ bundle — exactly one feature per round. Builds the dependency-ready feature using its tests as the goal when they exist (red/green flow, drive them green before review), commits it (feature(<slug>) with a Feature trailer, status implemented) via the commit-feature op, auto-opens the review UI scoped to those commits, and on Accept flips its status to done — and, when okf-memory shares the bundle, evaluates whether the accepted work should create or update memory concepts. Use when the user types /iterator-implement, wants to build the next feature, or wants to work through the feature plan.
---

# iterator-implement

The third step of the iterator flow: **plan → feature → implement → review**.
Implements **exactly one feature per round**: the next dependency-ready
feature is built, **committed** (`feature(<slug>)` with the `Feature:`
trailer, status `implemented`), reviewed from those commits, and on accept
marked done — then the loop moves to the next feature. Because each feature
commits its own files, unrelated working-tree churn never pollutes a review,
and several independent features can be implemented back to back and reviewed
afterwards.

**pi mode:** see `<skill-dir>/../iterator/PI.md`. The friendly
`/iterator-implement` and `/iterator-next` commands create a replacement Pi
session before running the feature skill. That session receives only the named
implementation command and rebuilds its context from the deterministic
implement gather contract. Dashboard and auto-mode implementation dispatches
use the same command. A direct `/skill:iterator-implement` invocation remains
available for harnesses that already started the dedicated session.

**Claude Code mode:** Use gather/write directly instead of the Pi dashboard.
Implement only `next`, commit it through `commit-feature`, and report it as
`implemented`; never call `accept-commit` without an explicit user-approved
review.

## When to use this skill

When the user types `/iterator-implement`, wants to build the next feature,
or wants to work through the feature plan. If `memory/features/` has no feature
files, tell the user to run `/iterator-plan` → `/iterator-feature` first and
stop. If the user's message contains a result payload from a previous session
(`accept-commit`, `review-feedback`, `cancel`, `timeout`), process it
(step 5) first.

## Steps

### 1. Pick the next feature

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

Do **not** read bundle files yourself. `next` is the next dependency-ready
pending feature with its full contract; the payload's `advice` string tells
you what to do when nothing is ready — only drafts exist, features are
awaiting review (`implemented`), or pending features are `stuck` (cycle /
missing dependency — report it and stop; never guess an order). Follow it.

- Implement **only `next`**. **Never implement a feature before its
  dependencies are satisfied** (done — or implemented, when the
  `review_required` setting is off).
- If the user named a specific feature, it must appear in `ready`; implement
  that one instead. If not ready, name the missing dependency (from `blocked`)
  and stop.

**Treat the gather payload as your entire context.** `finishedFeatures` tells
you what this plan already changed (each finished feature's files and
commits) — do not assume conversation memory from earlier rounds; every round
must be executable from a fresh context.

**Work in the payload's `root`.** All iterator work happens in the plan's
worktree when one exists — gather/write re-root themselves automatically, but
your **file edits and test runs must target paths under the payload's `root`**
(it may differ from your session's cwd). Never edit the main checkout while a
plan worktree is active.

### 2. Implement the feature — tests are the goal when they exist

Implement the feature using its contract's implementation notes, snippets,
`ARCHITECTURE.md` (read if present), and `GUIDELINES.md` only if it exists.
Prefer keeping edits inside the feature's `files`; when the work genuinely
requires touching other paths, that is fine — the review will show them as
this feature's incidental changes.

**Memory first:** before coding, read the contract's `relevantMemories` (the
feature's stored `memories:` reading list unioned with a fresh anchor match).
Each entry inlines the concept's `body` with the frontmatter already stripped
— read the bodies straight from the contract; open the file at `path` only
when a body is marked truncated. Never crawl all of `memory/`. Treat `pitfalls/*`
entries as constraints (a known sharp edge in exactly the files you are about
to change), `architecture/*` and `patterns/*` as how the surrounding code
expects to be extended. An empty list means no anchored knowledge — proceed
normally.

**Decision conflicts:** if the feature's contract carries `conflicts`
(recorded decision concepts the feature contradicts), do **not** implement it
silently — surface the conflict to the user first and let them resolve it
(change the feature, or update the decision via `/iterator-knowledge`).

**Design quality:** if the feature touches frontend/UI surface, follow the
`/iterator-design` skill while building. The payload's `designFile` tells you
the state: non-null → read `memory/design.md` and follow its params (they win
over generic taste); null → run `/iterator-design`'s first-time capture once,
**before** styling the first UI feature. Run its self-check before opening the
review UI. Skip silently if the feature has no UI surface.

**Green gate:** if the feature has `tests` (written red by `/iterator-test`),
they define done. After implementing, run exactly that feature's test files
and loop *implement → run → fix* until they pass. Never weaken or delete a
test to get green; if a test looks wrong, say so. If the tests are still red
after a few honest attempts, stop and show the user the real failing output,
then let them choose: keep fixing, open the review anyway (the red badge will
be visible), or pause. Features without tests skip this gate — not an error.

**Commit the feature:** when the implementation is complete (tests green when
they exist), commit it — one deterministic write does the branch safety, the
staging (your listed files unioned with the feature's `files:`/`tests:`
matches — nothing else), the `feature(<slug>)` commit with its `Feature:`
trailer, the `implemented` status flip, and the sha recording:

```sh
node <skill-dir>/../iterator/write.mjs << 'COMMIT_WRITE'
{ "op": "commit-feature", "feature": "<slug>",
  "files": [ "<every path you changed for this feature>" ],
  "summary": "<one-line commit summary>", "testsStatus": "<red|green, only when the feature has tests>" }
COMMIT_WRITE
```

Review reads the diff from these commits, so unrelated dirty files in the
tree can never leak into it. The result's `leftovers` lists what stayed
uncommitted — report it to the user, never sweep it into the commit. This is
what enables the Review button on the dashboard (and disables Implement);
`status: done` is still set only by the accept flow in step 5.

### 3. Evaluate the memory impact (okf-memory shared bundle)

An accepted feature is also the moment the knowledge base can silently go
stale — check now, while the diff is in front of you:

```sh
node <skill-dir>/../iterator/gather.mjs --step memorize
```

If `okf` is `false`, skip this step entirely (do not create areas uninvited).
Otherwise decide, for the feature's diff **plus** any `pendingCommits` (commits
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
records; when `pendingCount` > 20, evaluate only the feature's diff and note
that `/iterator-memorize` should handle the backlog.

### 4. Auto-open the review UI (commit mode)

The review payload (diff parsed into hunks, mapped to features, stats) is
computed by script; you add only the commit-mode fields:

```sh
node <skill-dir>/../iterator/gather.mjs --step review --feature <slug>
```

Take the printed JSON and set `"mode": "commit"`; when the feature has tests,
set its entry's `"tests": { "status": "<red|green>", "total": N,
"passing": N }` from your green-gate runs; when step 3 produced proposals,
add `"memory": { "proposals": [ … ] }` (include `reason` — the UI shows it).
Pipe the result into `node <skill-dir>/../iterator/server.mjs` via a heredoc.
The diff is rebuilt from the feature's commits (`source: "commits"`) — what
you committed is exactly what gets reviewed; `uncommittedOverlap` lists
reviewed files that have drifted in the tree since (shown as a hint, never a
blocker). The UI shows the diff split into Declared / Tests / Incidental
groups, plus test badges and the memory cards as toggleable items exactly
where the accept decision happens.

### 5. Process the result (one JSON line)

- `{ "type": "accept-commit", "features": [...], "memory": {...} }` → **the
  entire acceptance is one deterministic write**. The work is already
  committed (step 2), so the writer normally just flips `status: done`,
  records the verdict (`accepted` in the result), applies the memory cards,
  advances the pointer, and makes the bookkeeping commit; features without
  commits (legacy working-tree rounds) still get the full staging +
  `feature(<slug>)` commit path (`committed` in the result):

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'ACCEPT_WRITE'
  { "op": "accept-commit",
    "features": [ { "slug": "<slug>", "testsStatus": "<red|green>", "summary": "<short summary>" } ],
    "memory": { "proposals": [ <your step-3 cards> ], "accepted": <the UI result's memory.accepted> },
    "advance": true }
  ACCEPT_WRITE
  ```

  `testsStatus` only when the feature has tests — the color of the last real
  run (keep `red` if the user accepted with red tests); `summary` is your
  one-line commit summary. `memory.proposals` are the full step-3 cards; the
  writer keeps only the ones in `accepted`. Set `"advance": true` **only**
  when step 3's payload had `baseValid: true` and you evaluated all
  `pendingCommits` (pointer rule: never advance past commits nobody looked
  at — if `pendingCount` was > 20, set it `false` and tell the user
  `/iterator-memorize` has a backlog). `advance` with no cards is correct —
  "nothing worth memorizing" also means the pointer is up to date.

  The writer is resumable (already-done features are skipped). On the legacy
  working-tree path it **never dead-ends on unattributed files**: pipe the UI
  result's `uncategorized: [{path, feature|'skip'|'bootstrap'}]` dispositions
  through verbatim; anything without an explicit disposition follows its
  default (absorbed into this feature's commit — or left uncommitted when
  `block_commit_on_leftovers` is off), and content that was already staged
  before the round lands as a separate `chore(bootstrap)` commit (the result's
  `bootstrapCommit`). The result reports `accepted` (already-committed
  features flipped done), `committed`, `defaulted` (absorbed files),
  `uncommitted` (explicit skips) and `leftovers` (what actually remains dirty
  after the commits) — tell the user about all of them, never force-commit
  leftovers. Report what was accepted (and which memories were
  written/skipped), then offer the next ready feature (loop to step 1). If
  this feature finished the plan, offer the **whole-plan review**
  (`/iterator-review-plan`) and then plan retirement (the `/iterator` hub
  skill's retire flow).

- `{ "type": "review-feedback", ... }` → revise the implementation per the
  notes and line comments, **re-run the feature's tests** (the green gate
  applies to every round), refresh the memory proposals if the revision
  changes what is worth memorizing, **commit the rework via `commit-feature`
  again** (the same trailer — review rebuilds the diff from all of the
  feature's commits), then re-run from step 4 with the fresh test state. The
  feature stays `implemented` during rework.

- `cancel` / `timeout` → relay the result's `report` and stop; the feature's
  commits (and any uncommitted rework) remain for the user to inspect —
  `status: done` is never set without an accept.

## Ready-wave dashboard action

The Work dashboard's **Implement next wave** action snapshots every pending
feature reported dependency-ready by gather at click time, then dispatches one
`/skill:iterator-implement <feature> --auto` turn for each snapshot member.
Each turn still implements and commits exactly one named feature under this
skill's normal quality gates. Features unblocked later do not join the running
wave. Failed rounds are reported per feature and do not prevent the remaining
snapshot members from running. Pausing requeues the interrupted feature;
Continue waits for the aborted turn's lifecycle to finish, then retries it
before advancing the snapshot. The wave stops with
successful features at `implemented`; it never opens, accepts, or substitutes
for review.

This is distinct from **Implement all (auto)**, whose driver performs the full
test → implement → agent-review loop across the plan.

## Auto mode (`--auto`)

When invoked as `/skill:iterator-implement <feature> --auto` (dispatched by
the auto-mode driver, never by hand):

- Implement **only the named feature**. All quality gates above apply
  unchanged — memory first, design quality, and the green gate. The feature
  may already be `implemented` (a rework round) — that is expected.
- On a rework round the feature's `# Review` section carries the agent
  reviewer's notes (newest first) — read them via
  `gather.mjs --step review --feature <slug>`'s feature payload or the feature
  contract, and address every point. If the dispatch carries user guidance
  (after an escalation), it overrides everything else — follow it.
- When the implementation is complete, commit it (step 2's `commit-feature`
  write — commits the work and flips the status to `implemented`) — this is
  how the driver knows review is next.
- **Do NOT open the review UI.** Report in one short paragraph what changed
  and stop — the driver dispatches the agent review as the next turn. If the
  feature cannot be finished (tests stuck red, missing precondition), say so
  plainly, do NOT commit, and stop; the driver counts the failed rounds and
  escalates to the human.
