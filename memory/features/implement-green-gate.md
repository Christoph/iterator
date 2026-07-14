---
type: Feature
title: Green gate for iterator-implement
description: iterator-implement runs a feature's tests as its goal, only offers Accept-and-commit when green, shows a test badge in the commit-mode UI, and records the implement commit.
status: done
size: medium
lines_estimate: 150
depends_on: [schema-tests-commits]
files: ["skills/iterator-implement/SKILL.md", "skills/iterator-review/server.mjs"]
timestamp: 2026-07-05T14:20:00Z
done: 2026-07-05
tags: [skill, tdd]
---

# Implementation notes

`skills/iterator-implement/SKILL.md`:

- **Step 3 (implement):** after loading the feature, check `tests` /
  `tests_status`. If tests exist, they are the definition of done: implement,
  run exactly the feature's test files, and loop implement → run → fix until
  green **before** opening the review UI. If still red after a few honest
  attempts, stop and report the failing output to the user (offer: continue
  fixing / open review anyway with the red status visible / pause) — never
  silently weaken a test to get green (same rule iterator-test already states).
- **Step 4 (review UI payload):** add per-feature
  `"tests": { "status": "red|green|none", "total": N, "passing": N }` and pass
  it through. In `skills/iterator-review/server.mjs` render a 🔴/🟢 badge next
  to the feature header in commit mode (and in standalone mode when present).
  Badge only — no new interactions.
- **Step 5 (accept-commit):** flip `tests_status: red → green` in the feature
  file together with the existing `status: done` flip. After committing,
  append `{ sha, kind: implement, date }` to `commits` per the recording rule
  from schema-tests-commits. If tests are red at accept time (user chose to
  proceed), keep `tests_status: red` — `status` and `tests_status` are
  independent by design.
- **Feedback loop (`review-feedback`):** after revising, re-run the feature's
  tests before re-opening the UI — the green gate applies to every round, not
  just the first.
- Frontmatter `description`: mention tests-as-goal.
- Step 3 also gains an optional design-quality hook: when the `impeccable`
  skill is available in the harness and the feature touches UI surface, run
  `/impeccable audit` + `/impeccable polish` before opening the review UI
  (skip silently otherwise — same conditional pattern as GUIDELINES.md).

# Depends on

* [Schema: tests + commits fields](/features/schema-tests-commits.md) — reads `tests`/`tests_status`, writes `tests_status` and `commits`.

# Blast radius

This is the core of the red→green loop; a wrong gate either blocks all commits
(gate fires with no tests present) or silently commits red (gate skipped).
Touching `skills/iterator-review/server.mjs` affects the standalone review UI
too — the badge must degrade to nothing when the `tests` field is absent so
old payloads keep rendering.
