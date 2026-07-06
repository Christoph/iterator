---
name: okf-memorize
description: Use when the user types /okf-memorize or wants to draft reviewed knowledge updates from commits since last_memorized_commit.
---

<!-- markdownlint-disable MD013 -->

# okf-memorize

Draft and review new knowledge entries from commits since
`last_memorized_commit`.

## Preconditions

1. `memory/index.md` must exist. If it does not, stop and suggest `/okf-init`.
2. The shared scripts must exist at `<skill-dir>/../iterator/gather.mjs`,
   `server.mjs`, and `write.mjs`. If not, stop with: `Install the full
   iterator plugin; okf-memorize uses the iterator hub's scripts.`
3. Do not write `memory/` while the browser review is open.

**pi mode:** if the tools `iterator_gather` / `iterator_ui` / `okf_write` are
available, use `iterator_gather { step: "range" }` for the commit range,
`iterator_ui { step: "memory-review", extra: { mode: "memorize", memories: [...], baseCommit, headCommit, commitCount } }`
for the review round, and
`okf_write { mode: "memorize", headCommit, memories, decisions }` to apply an
approved round. Steps, payloads, and rules are unchanged.

## Determine commit range

The range is computed by script — do **not** run the git plumbing yourself:

```bash
node <skill-dir>/../iterator/gather.mjs --step range
```

It prints `{ head, lastMemorizedCommit, baseValid, mergeBaseFallback, effectiveBase, commitCount, commits, nothingToMemorize }`:

- `nothingToMemorize: true` → report `nothing to memorize` and stop. An empty
  or short range is expected in repos driven by iterator:
  `/iterator-implement` evaluates each accepted chunk wave and advances
  `last_memorized_commit` itself, so only commits made outside that flow
  accumulate here.
- `baseValid: false` with a `mergeBaseFallback` → history was
  rebased/force-pushed; warn the user and continue from `effectiveBase`.
- `baseValid: false` and no fallback → offer a full-history review or abort.

Use `effectiveBase` as `baseCommit` and `head` as `headCommit` everywhere
below.

## Study changes

Use:

- `git log --oneline --stat "$baseCommit..HEAD"`
- `git diff --stat "$baseCommit..HEAD"`
- targeted `git show <commit>` for relevant changes

Skip pure formatting, generated files, and lockfile churn unless it changes
setup instructions.

## Draft memories

Draft `create`, `update`, or `delete` cards with `sourceCommits`. Focus on
lasting project knowledge: architecture, decisions, patterns, pitfalls, and
setup. Do not memorize every code change. Give create/update cards `files:`
anchors pointing at the code they describe.

## Conflict detection

For every draft, compare against existing memories in the same area and
keyword hits from:

```bash
grep -ril "<keyword>" memory/
```

If the draft contradicts an existing memory, set:

```json
"conflict": { "with": "patterns/existing-memory", "summary": "What contradicts what." }
```

Also include the contradicted memory as an `action: "keep"` card so both
sides appear in the review.

## Review

Invoke the shared UI server with `apply: true` so an approval is applied by
the deterministic writer (`write.mjs`, op `apply-review`) before the result
reaches you — never hand-author memory files, indexes, the log, or the
pointer:

```bash
node <skill-dir>/../iterator/server.mjs <<'OKF_PAYLOAD'
{ "step": "memory-review", "mode": "memorize", "apply": true, "project": "<git root>", "round": 1, "baseCommit": "...", "headCommit": "...", "commitCount": 1, "areas": [], "memories": [] }
OKF_PAYLOAD
```

`headCommit` must be the reviewed head from the range gather, not `HEAD now`
— the writer advances `last_memorized_commit` to exactly this sha on
approval, which avoids racing commits made during review.

## React

- `review-feedback`: revise commented drafts plus the general note, increment
  `round`, and invoke the server again. Write nothing mid-loop.
- `cancel` / `timeout`: nothing was written and `last_memorized_commit` did
  **not** advance; explicitly report the cancellation/timeout.
- `review-approved`: the verdicts are **already applied** — the result line
  carries `applied` with the writer's outcome (`written`, `deleted`, `kept`,
  `rejected`, `advancedTo`, `validation`). Verdict semantics, for reference:
  `accept` writes the proposed concept, `reject` discards the proposal,
  `keep` leaves the existing concept, `delete` removes it. The writer also
  regenerated the affected area indexes and root index links (preserving all
  foreign content, including the plan/chunk links), set
  `last_memorized_commit` to the reviewed `headCommit`, appended newest-first
  `memory/log.md` entries, and ran the bundle validator.

## Finish on approval

Read `applied` from the result. If `applied.ok` is false (or
`applied.validation.ok` is false), show the error and fix it through another
review round — do not patch files by hand.

Otherwise report created/updated/deleted/rejected counts, conflicts resolved
or left, and the advanced commit pointer (`applied.advancedTo`).
