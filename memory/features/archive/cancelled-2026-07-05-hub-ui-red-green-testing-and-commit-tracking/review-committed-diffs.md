---
type: Feature
title: Review committed features
description: iterator-review builds the diff from recorded commits (or the Feature trailer) when the working tree is clean and the feature is done.
status: done
size: small
lines_estimate: 60
depends_on: [schema-tests-commits]
files: ["skills/iterator-review/SKILL.md"]
timestamp: 2026-07-05T14:30:00Z
done: 2026-07-05
tags: [skill, review]
---

# Implementation notes

`skills/iterator-review/SKILL.md` step 3 (collect git state) currently falls
back to a progress summary when `git diff HEAD` is empty — which is exactly
the state right after `/iterator-implement` commits. Add a committed-feature
path:

- When the tree is clean and the selected feature is `status: done`, resolve the
  feature's commits: prefer the recorded `commits` shas (validate each with
  `git cat-file -e <sha>^{commit}` — recorded shas go stale on rebase/amend);
  fall back to `git log --format=%H --grep '^Feature: <slug>$'`.
- Build the diff via `git show <sha>` per commit (or
  `git diff <oldest>^ <newest>` when they are consecutive), then map hunks to
  features exactly as today (step 4). Exclude the bundle's own `memory/` paths
  from the displayed diff so the review shows code, not bookkeeping.
- Label the UI payload so the header shows what is being reviewed, e.g.
  `commit: "a1b2c3d feature(auth-middleware): …"` — the payload field already
  exists.
- "All pending" selection is unchanged; the committed path applies when a
  specific done feature is picked (dependency order list should now include done
  features, since reviewing them is finally possible).
- Review outcome handling (step 6) is unchanged — notes still go into the
  feature file; `status: done` still untouched.

# Depends on

* [Schema: tests + commits fields](/features/schema-tests-commits.md) — reads the `commits` field and its trailer-fallback rule.

# Blast radius

Wrong commit resolution shows the wrong diff and the user reviews/approves the
wrong code. The fallback ordering (shas first, trailer grep second) must match
the schema doc so all skills agree on lookup semantics.
