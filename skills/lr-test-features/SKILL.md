---
name: lr-test-features
description: Generate tests one chunk at a time from a CHUNKS.md breakdown. Reads a chunk's files, description, and implementation notes, then writes focused tests for it. Opt-in per chunk — you choose which chunk to cover. Use when the user types /lr-test-features, asks to add tests for a planned chunk, or wants chunk-level test coverage.
---

# lr-test-features

Generates tests at the **chunk** level, using the same `CHUNKS.md` breakdown that `/lr-plan-features`, `/lr-review`, and `/lr-implementer` rely on. Instead of asking for tests up front for everything, the user opts in per chunk — pick a chunk, generate focused tests for exactly the files and behavior that chunk covers.

The unit of testing is the chunk, not the file: a chunk's `files`, `description`, and `implementation-notes` tell you what the tests must protect.

## When to use this skill

When the user types `/lr-test-features`, asks to add or generate tests for a planned chunk, or wants chunk-level coverage.

If `CHUNKS.md` does not exist, tell the user: "No CHUNKS.md found. Run `/lr-plan-features` first to create a chunk breakdown." and stop.

## Steps

### 1. Load the chunk list efficiently via the PLAN.md index

If `PLAN.md` has a `## Chunks Index`, read it first and use the line numbers to load only the chunk(s) you need from `CHUNKS.md`. Otherwise read `CHUNKS.md` in full.

Parse each chunk's: name, description, implementation-notes, `files`, `depends-on`, `size`, and status (`[ ]`/`[x]`).

### 2. Choose which chunk(s) to test

If the user named a chunk, use it. Otherwise use `AskUserQuestion` to let them pick — offer the most-foundational chunks first (dependency order), each option labeled with the chunk name and its size (header `Chunk`).

Prefer testing dependency-first: a chunk's dependencies should already be covered (or tested in the same pass) so its tests can rely on them.

### 3. Detect the project's test setup

Before writing anything, figure out how this project tests so generated tests actually run:

```sh
cat package.json 2>/dev/null            # "scripts.test", devDeps: jest/vitest/mocha/node:test
ls *.cfg *.toml pyproject.toml 2>/dev/null   # pytest / other runners
git ls-files | grep -Ei '(\.test\.|\.spec\.|_test\.|/tests?/)' | head
```

Detect the **test runner**, the **existing test location & naming** convention, and the **assertion/mocking style** already in use — and match them exactly. If there is no test setup at all, recommend a runner and ask for confirmation before adding a dev dependency or config.

### 4. Read the chunk's real code

For each file in the chunk's `files` list (expand globs against `git ls-files`), read the current implementation. Understand:
- The public surface the chunk exposes (exported functions, routes, components)
- The behavior described in the chunk's `description` and `implementation-notes`
- The failure modes implied by the chunk's dependencies (bad input from an upstream chunk, boundary values, error propagation) — these are the highest-value cases to cover

### 5. Generate chunk-level tests

Write tests that cover the chunk as a unit:
- **Happy path** for each piece of the chunk's public surface
- **Edge cases and failure modes** implied by the description/notes/dependencies
- **Integration across the chunk's files** where they collaborate — not just isolated units, since a chunk spans multiple files

Rules:
- Place test files following the detected convention (co-located `*.test.*` or a `tests/` dir).
- Reuse existing test helpers/fixtures rather than inventing new ones.
- Keep each chunk's tests in their own file(s) so coverage maps back to the chunk.
- Do **not** weaken assertions to make tests pass — if the implementation looks buggy, note it to the user instead of asserting the buggy behavior.

### 6. Run the tests and report

Run only the new tests if the runner supports targeting a path/pattern; otherwise run the suite:

```sh
<test command> <path-or-pattern>
```

Report to the user:
- Which chunk was covered and the test file(s) created
- Pass/fail results (show real output — do not claim success without running)
- Any cases you intentionally left out and why
- Whether other chunks still lack tests, and offer to continue with the next one

Do **not** mark anything in `CHUNKS.md` — test generation is independent of implementation/review status. `/lr-implementer` owns the `done` state and `/lr-review` owns review notes.

## Relationship to the other skills

- `/lr-plan-features` creates `CHUNKS.md` (the chunk breakdown).
- `/lr-test-features` reads it to generate tests per chunk (this skill).
- `/lr-review` reads it to group the diff for review.
- `/lr-implementer` reads it to build the next dependency-ready chunk.

All four share the same `CHUNKS.md` as the source of truth for what a "chunk" is.
