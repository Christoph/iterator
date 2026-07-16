---
name: iterator-review
description: Review one implemented feature from the memory/ bundle — the diff is rebuilt from the feature's feature(<slug>) commits (working tree only as fallback for uncommitted rounds), shown in the review UI in the browser (or reviewed non-interactively with --agent in auto mode); the verdict lands in the feature's Review section, and approval runs the deterministic accept-commit (status flip to done). Use when the user types /iterator-review, clicks Review on the dashboard, or wants to review a specific feature.
---

# iterator-review

The review step of the iterator flow: **plan → feature → implement → review**.
Reviews **one feature per round** — normally the feature that was just flipped
to `implemented` by `/iterator-implement`. Approval runs the deterministic
accept-commit; a needs-work verdict records the notes and sends the feature
back to implementation (its status stays `implemented`).

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-review <slug>`, clicks Review on the dashboard,
or the auto-mode driver dispatches `/skill:iterator-review <slug> --agent`.
If no feature is named, gather the hub payload and pick the `implemented`
feature; if none exists, say there is nothing to review and stop.

## Steps

### 1. Gather the feature-scoped review payload

```sh
node <skill-dir>/../iterator/gather.mjs --step review --feature <slug>
```

Do **not** diff by hand. An `implemented` or `done` feature with commits is
reviewed **from those commits** (`source: "commits"`): the diff is exactly
what `commit-feature` landed, so unrelated working-tree churn can never
pollute or block the review. `uncommittedOverlap` lists reviewed files that
also carry uncommitted tree changes — mention it as a hint; it is **never**
grounds to withhold approval. The working tree is the diff source only for a
feature with no commits yet (legacy round); there the payload maps every
changed file to the feature, split into groups: `declared` (the feature's
files), `tests`, `incidental` (pre-assigned to this feature with a
reassignable default), and `bootstrap` (content already staged before the
round — defaults to its own `chore(bootstrap)` commit).
If `hasChanges` is false, report that there is nothing to review and stop.
On an oversized round `diffTruncated` is true and `diffOmittedFiles` lists
files whose hunks were stripped from the payload — read those with `git show`
(commit mode) or `git diff` (scoped per path) before judging them.

### 2a. Human review (default): open the review UI

Set `"mode": "commit"` on the payload (plus `"tests": {…}` per the feature's
recorded `tests_status` when it has tests) and pipe it into
`node <skill-dir>/../iterator/server.mjs` via a heredoc. Then process the
result exactly like `/iterator-implement` step 5:

- `accept-commit` → pipe into `write.mjs` (`op: accept-commit`, the single
  feature, dispositions verbatim). For an already-committed feature it just
  flips `status: done` and records the verdict (`accepted` in the result);
  a commit-less feature still gets the full staging + `feature(<slug>)`
  commit path. Report `accepted` / `committed`, plus `defaulted` /
  `uncommitted` / `leftovers` / `bootstrapCommit` from the result.
- `review-feedback` → record it:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'REVIEW_WRITE'
  { "op": "record-review", "by": "human",
    "features": [ { "name": "<slug>", "status": "approved|changes|question", "note": "…" } ] }
  REVIEW_WRITE
  ```

  then relay the notes; implementation rework happens via
  `/iterator-implement <slug>`.
- `cancel` / `timeout` → stop without writing anything.

### 2b. Agent review (`--agent`, auto mode)

No UI, no questions. Read the payload's diff hunks and judge the feature the
way a demanding human reviewer would: does the change do what the feature's
description and implementation notes promise, are the tests honest (no
weakened assertions), does it respect the anchored pitfalls and the blast
radius, is anything obviously broken or left half-done? Incidental files are
part of this feature's round — review them too. Judge **only the payload's
diff** (the feature's commits): uncommitted working-tree changes outside it —
formatting churn, other features in flight — are not part of this review and
never a reason to block approval (at most relay `uncommittedOverlap` as a
note).

- **Approve** → run accept-commit yourself (the write shown in 2a's first
  bullet, dispositions defaulted — pass `"uncategorized": []`), then record
  the verdict:

  ```sh
  node <skill-dir>/../iterator/write.mjs << 'REVIEW_WRITE'
  { "op": "record-review", "by": "agent", "model": "<your model id>",
    "features": [ { "name": "<slug>", "status": "approved", "note": "<one-line verdict>" } ] }
  REVIEW_WRITE
  ```

- **Needs work** → record `status: "changes"` with a **specific, actionable**
  note (what is wrong, where, what would make it pass) the same way, and do
  NOT commit. The driver strikes the feature and re-dispatches
  `/iterator-implement <slug> --auto`; your note is what the implementer
  reads.

Report the verdict in one short paragraph and stop — the driver decides what
runs next.
