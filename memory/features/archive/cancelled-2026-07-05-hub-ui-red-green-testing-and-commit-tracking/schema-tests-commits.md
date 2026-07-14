---
type: Feature
title: "Schema: tests + commits fields"
description: Add tests, tests_status, and commits frontmatter to the Feature schema and define the test badge in features/index.md.
status: done
size: small
lines_estimate: 70
depends_on: []
files: ["templates/format.md", "skills/iterator-plan/templates/format.md"]
timestamp: 2026-07-05T13:40:00Z
done: 2026-07-05
tags: [schema]
---

# Implementation notes

Extend the Feature document schema in `templates/format.md` (single source of
truth; run `npm run sync` to refresh the bundled copy in
`skills/iterator-plan/templates/`):

- New optional frontmatter fields with rows in the field-semantics table:
  - `tests` — list of test file paths owned by this feature; written by
    `/iterator-test`.
  - `tests_status` — `none | red | green`. `none` (or absent) = no tests yet;
    `red` = tests exist and fail (expected before implementation); `green` =
    tests pass. `/iterator-test` sets `red`/`green`; `/iterator-implement`
    flips `red → green` on Accept-and-commit.
  - `commits` — list of `{ sha, kind, date }` entries, `kind: test | implement`.
    Document explicitly: shas are an optimization that goes stale on
    rebase/amend; the `Feature: <slug>` commit trailer is the resilient lookup
    and consumers must fall back to `git log --grep '^Feature: <slug>'`.
- Note that the implement sha lands in the feature file one bundle-update later
  (a commit cannot contain its own sha).
- Extend the `features/index.md` example with the test badge, e.g.
  `⬜ pending · 🔴 tests red · small · depends: config-module · …`
  (badge omitted when `tests_status` is `none`/absent).
- Update the full example feature at the bottom of format.md.

# Snippets

```yaml
tests: ["test/auth.test.mjs"]
tests_status: red          # none | red | green
commits:
  - sha: a1b2c3d
    kind: test
    date: 2026-07-05
```

# Blast radius

Every later feature reads or writes these fields; if the semantics here are
ambiguous (especially who flips `tests_status` when), the test/implement/review
skills will contradict each other. The bundle stays OKF-conformant — unknown
frontmatter keys are permitted — so existing bundles are unaffected.
