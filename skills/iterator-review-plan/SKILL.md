---
name: iterator-review-plan
description: Review the whole finished plan — check every feature's changes and commits against the plan's goal, architecture, and key decisions, report mismatches (unimplemented goals, contradicted decisions, scope drift), and record the report in plan.md. Runs once after all features are implemented/done; no fix loop. Use when the user types /iterator-review-plan, clicks Review plan on the dashboard, or the auto-mode driver dispatches it after the last feature.
---

# iterator-review-plan

The closing step of the iterator flow: after every feature has landed, one
review of the **whole plan** — do the changes and commits, taken together,
actually deliver what the plan promised? This is a report, not a fix loop:
findings are recorded and handed to the user; nothing is implemented or
committed here.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## When to use this skill

When the user types `/iterator-review-plan`, clicks **Review plan** on the
dashboard, or the auto-mode driver dispatches `/skill:iterator-review-plan
--auto` after the last feature. Every feature should be `implemented` or
`done`; if features are still pending, say so and stop.

## Steps

### 1. Gather the whole-plan payload

```sh
node <skill-dir>/../iterator/gather.mjs --step plan-review
```

The payload carries the plan's `goal`, `architecture`, `keyDecisions` and
`dependencies` sections, every feature (status, review history, commits), the
ordered `commits` list, and the whole-plan `diff` (from the union of feature
commits; `diffTruncated` tells you when it was capped — use the commit list
and `git -C <root> show <sha>` for anything cut off). All git commands run
against the payload's `root` (the plan worktree).

### 2. Review the plan as a whole

Judge the finished work against the plan document — not feature by feature
(each feature was already reviewed), but the sum:

- **Goal coverage** — is every stated goal actually delivered by the diff?
  Name anything promised but missing or half-done.
- **Key decisions** — does the implementation respect each recorded decision?
  Name contradictions with the commit/file that violates them.
- **Architecture** — does the code land where the plan said it would?
  Flag structural drift.
- **Scope drift** — changes in the diff that no feature/goal explains.
- **Loose ends** — leftovers, TODO markers introduced by the plan's commits,
  features `implemented` but never accepted.

Be specific: every finding names the plan section it checks against and the
feature/commit/file it found the problem in. A clean result is a short clean
bill, not padding.

### 3. Record the report

```sh
node <skill-dir>/../iterator/write.mjs << 'PLAN_REVIEW_WRITE'
{ "op": "record-plan-review", "by": "human",
  "report": "<your markdown findings — or the clean bill>" }
PLAN_REVIEW_WRITE
```

This appends the report under `# Plan review` in plan.md and sets the
`plan_reviewed` frontmatter date (the hub's Review-plan button turns into
Re-review; the auto driver treats it as done). Then relay the findings to the
user and stop — fixes are their call: new backlog items, a plan revision, or
re-opening a feature via the dashboard.

## Auto mode (`--auto`)

Dispatched by the driver exactly once, after the last feature lands. Same
review, non-interactive: record with `"by": "agent", "model": "<your model
id>"`, then report the findings in one short paragraph and stop. **No fix
loop** — never re-implement anything from here; the user verifies the report
and decides.
