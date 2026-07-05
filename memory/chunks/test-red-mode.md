---
type: Chunk
title: Red mode for iterator-test
description: iterator-test writes intentionally-failing contract tests for pending chunks, commits them, and records tests/tests_status/commits in the chunk file.
status: done
size: medium
lines_estimate: 120
depends_on: [schema-tests-commits]
files: ["skills/iterator-test/SKILL.md", "skills/iterator-test/server.mjs"]
timestamp: 2026-07-05T14:00:00Z
done: 2026-07-05
tags: [skill, tdd]
---

# Implementation notes

Split `skills/iterator-test/SKILL.md` step 4/6 by the chunk's `status`:

- **`pending` → red mode.** There is no implementation to read. Derive the
  test surface from the chunk's *contract*: `description`,
  `# Implementation notes`, `# Snippets`, and the module paths in `files`.
  Success = the new tests **fail on assertions or missing exports** when run;
  a test-file syntax/import-resolution error in the test itself is a bug to
  fix, not a valid red. Report "N tests red — ready for /iterator-implement"
  as the successful outcome. Never soften a red run into a skip.
- **`done` → green mode.** Today's behavior (read real code, expect pass),
  plus the new recording steps below.
- **Recording (both modes):** update the chunk file — `tests` (file paths),
  `tests_status` (`red` or `green`), `timestamp` — then regenerate
  `chunks/index.md` (with the 🔴/🟢 badge) and prepend the `log.md` entry.
- **Commit:** commit the test files together with the chunk-file/index/log
  updates as `test(<slug>): <summary>` with a `Chunk: <slug>` trailer (same
  branch-safety rule as implement: never commit to `main`/`master`). Append
  `{ sha, kind: test, date }` to the chunk's `commits` — since the chunk file
  is inside this commit, record the sha in the *next* bundle write or as a
  tiny follow-up bundle-only commit (mirror whatever wording
  schema-tests-commits settled on).
- `skills/iterator-test/server.mjs`: accept an optional `"mode": "red" |
  "green"` in the payload and show it in the header/subtitle so the user knows
  the plan is expected-to-fail tests. Keep the existing cases UI unchanged.
- Update the skill's frontmatter `description` to mention writing failing
  tests before implementation.

# Depends on

* [Schema: tests + commits fields](/chunks/schema-tests-commits.md) — writes the `tests`/`tests_status`/`commits` fields defined there.

# Blast radius

implement-green-gate consumes `tests_status: red` as its goal signal; if red
mode records `green` (or nothing) the gate is useless. The commit step must
respect branch safety or users end up with test commits on main.
