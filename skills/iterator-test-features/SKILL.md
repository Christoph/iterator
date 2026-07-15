---
name: iterator-test-features
description: Generate tests one feature at a time from a FEATURES.md breakdown. Reads a feature's files, description, and implementation notes, then writes focused tests for it. Opt-in per feature — you choose which feature to cover. Use when the user types /iterator-test-features, asks to add tests for a planned feature, or wants feature-level test coverage.
---

# iterator-test-features

Generates tests at the **feature** level, using the same `FEATURES.md` breakdown that `/iterator-plan-features`, `/iterator-review`, and `/iterator-implementer` rely on. Instead of asking for tests up front for everything, the user opts in per feature — pick a feature, generate focused tests for exactly the files and behavior that feature covers.

The unit of testing is the feature, not the file: a feature's `files`, `description`, and `implementation-notes` tell you what the tests must protect.

## When to use this skill

When the user types `/iterator-test-features`, asks to add or generate tests for a planned feature, or wants feature-level coverage.

If `FEATURES.md` does not exist, tell the user: "No FEATURES.md found. Run `/iterator-plan-features` first to create a feature breakdown." and stop.

## Steps

### 1. Load the feature list efficiently via the PLAN.md index

If `PLAN.md` has a `## Features Index`, read it first and use the line numbers to load only the feature(s) you need from `FEATURES.md`. Otherwise read `FEATURES.md` in full.

Parse each feature's: name, description, implementation-notes, `files`, `depends-on`, `size`, and status (`[ ]`/`[x]`).

### 2. Choose which feature(s) to test

If the user named a feature, use it. Otherwise use `AskUserQuestion` to let them pick — offer the most-foundational features first (dependency order), each option labeled with the feature name and its size (header `Feature`).

Prefer testing dependency-first: a feature's dependencies should already be covered (or tested in the same pass) so its tests can rely on them.

### 3. Detect the project's test setup

Before writing anything, figure out how this project tests so generated tests actually run:

```sh
cat package.json 2>/dev/null            # "scripts.test", devDeps: jest/vitest/mocha/node:test
ls *.cfg *.toml pyproject.toml 2>/dev/null   # pytest / other runners
git ls-files | grep -Ei '(\.test\.|\.spec\.|_test\.|/tests?/)' | head
```

Detect the **test runner**, the **existing test location & naming** convention, and the **assertion/mocking style** already in use — and match them exactly. If there is no test setup at all, recommend a runner and ask for confirmation before adding a dev dependency or config.

### 4. Read the feature's real code

For each file in the feature's `files` list (expand globs against `git ls-files`), read the current implementation. Understand:
- The public surface the feature exposes (exported functions, routes, components)
- The behavior described in the feature's `description` and `implementation-notes`
- The failure modes implied by the feature's dependencies (bad input from an upstream feature, boundary values, error propagation) — these are the highest-value cases to cover

### 5. Generate feature-level tests

Write tests that cover the feature as a unit:
- **Happy path** for each piece of the feature's public surface
- **Edge cases and failure modes** implied by the description/notes/dependencies
- **Integration across the feature's files** where they collaborate — not just isolated units, since a feature spans multiple files

Rules:
- Place test files following the detected convention (co-located `*.test.*` or a `tests/` dir).
- Reuse existing test helpers/fixtures rather than inventing new ones.
- Keep each feature's tests in their own file(s) so coverage maps back to the feature.
- Do **not** weaken assertions to make tests pass — if the implementation looks buggy, note it to the user instead of asserting the buggy behavior.

### 6. Run the tests and report

Run only the new tests if the runner supports targeting a path/pattern; otherwise run the suite:

```sh
<test command> <path-or-pattern>
```

Report to the user:
- Which feature was covered and the test file(s) created
- Pass/fail results (show real output — do not claim success without running)
- Any cases you intentionally left out and why
- Whether other features still lack tests, and offer to continue with the next one

Do **not** mark anything in `FEATURES.md` — test generation is independent of implementation/iterator-review status. `/iterator-implementer` owns the `done` state and `/iterator-review` owns review notes.

## Relationship to the other skills

- `/iterator-plan-features` creates `FEATURES.md` (the feature breakdown).
- `/iterator-test-features` reads it to generate tests per feature (this skill).
- `/iterator-review` reads it to group the diff for review.
- `/iterator-implementer` reads it to build the next dependency-ready feature.

All four share the same `FEATURES.md` as the source of truth for what a "feature" is.
