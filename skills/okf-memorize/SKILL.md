---
name: okf-memorize
description: Use when the user types /okf-memorize or wants to draft reviewed knowledge updates from commits since last_memorized_commit.
---

<!-- markdownlint-disable MD013 -->

# okf-memorize

Draft and review new knowledge entries from commits since
`last_memorized_commit`.

Shared preconditions, review pipeline, React/Finish rules, card schema, and
pi mode: `<skill-dir>/../okf/PROTOCOL.md`. Specific to this flow:
`memory/index.md` must exist — if not, stop and suggest `/okf-init`.

## Determine the commit range

The range and pointer state are computed by script — do **not** run the git
plumbing yourself:

```bash
node <skill-dir>/../iterator/gather.mjs --step range
```

Follow the payload's `advice` string — it tells you whether to stop (nothing
to memorize, missing bundle/pointer), warn (rebased history, merge-base
fallback), or proceed with the commit range. An empty or short range is
expected in repos driven by iterator: `/iterator-implement` advances the
pointer itself, so only commits made outside that flow accumulate here.

Use the payload's `effectiveBase` as `baseCommit` and `head` as `headCommit`
everywhere below.

## Study changes

Use `git log --oneline --stat "$baseCommit..HEAD"`,
`git diff --stat "$baseCommit..HEAD"`, and targeted `git show <commit>` for
relevant changes. Skip pure formatting, generated files, and lockfile churn
unless it changes setup instructions.

## Draft memories

Draft `create`, `update`, or `delete` cards with `sourceCommits`. Focus on
lasting project knowledge: architecture, decisions, patterns, pitfalls, and
setup. Do not memorize every code change.

## Conflict detection

For every draft, compare against existing memories in the same area and
keyword hits from `grep -ril "<keyword>" memory/`. If the draft contradicts
an existing memory, set
`"conflict": { "with": "patterns/existing-memory", "summary": "What contradicts what." }`
and include the contradicted memory as an `action: "keep"` card so both sides
appear in the review.

## Review

Run the PROTOCOL.md review round with `mode: "memorize"`, `baseCommit`,
`headCommit`, and `commitCount`. `headCommit` must be the reviewed head from
the range gather, not `HEAD now` — the writer advances
`last_memorized_commit` to exactly this sha on approval, which avoids racing
commits made during review. React and finish per PROTOCOL.md; additionally
report conflicts resolved or left, and the advanced pointer
(`applied.advancedTo`).
