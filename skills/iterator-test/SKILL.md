---
name: iterator-test
description: Generate tests one chunk at a time from the memory/ bundle. For a pending chunk it runs in red mode — writing intentionally-failing tests from the chunk's contract before any implementation exists (red/green flow); for a done chunk it writes passing tests against the real code. Proposes a test plan in an interactive browser UI, then on accept writes, runs, and commits the tests and records tests/tests_status in the chunk file. Never changes chunk status. Use when the user types /iterator-test, asks to add tests for a planned chunk, or wants chunk-level test coverage.
---

# iterator-test

Generates tests at the **chunk** level, using the same `memory/` bundle the other
iterator skills rely on. Instead of asking for tests up front for everything, the
user opts in per chunk — pick a chunk, review a proposed **test plan** in the
browser, then write focused tests for exactly the files and behavior that chunk
covers.

The skill runs in one of two modes, decided by the chunk's `status`:

- **Red mode** (`status: pending`) — the chunk is not implemented yet. Tests are
  written from the chunk's *contract* (its `description`,
  `# Implementation notes`, `# Snippets`, and the module paths in `files`) and
  are **expected to fail**. Red tests become the goal `/iterator-implement`
  drives to green.
- **Green mode** (`status: done`) — the chunk is implemented. Tests are written
  against the real code and must pass.

The unit of testing is the chunk, not the file: a chunk's `files`,
`description`, and `# Implementation notes` tell you what the tests must protect.
Tests are independent of implementation/review status — this skill **never**
changes a chunk's `status` (it does set `tests`/`tests_status`).

## When to use this skill

When the user types `/iterator-test`, asks to add or generate tests for a planned
chunk, or wants chunk-level coverage.

If `memory/chunks/` has no chunk files, tell the user: "No chunks found. Run
`/iterator-plan` → `/iterator-chunk` first." and stop.

If the user's message contains a test-plan result payload (`test-approved`,
`test-feedback`, `cancel`, `timeout`), process it (steps 5–7).

## Steps

### 1. Load the chunk list via the index

Read `memory/chunks/index.md`, then open only the chunk file(s) you need. Parse
each chunk's `title`, `description`, `# Implementation notes`, `files`,
`depends_on`, `size`, and `status`.

### 2. Choose which chunk to test

If the user named a chunk, use it. Otherwise use `AskUserQuestion` (header
`Chunk`) — offer the most-foundational chunks first (dependency order), each
labeled with the chunk name and size. Prefer testing dependency-first so a
chunk's dependencies are already covered.

### 3. Detect the project's test setup

Before writing anything, figure out how this project tests so generated tests
actually run:

```sh
cat package.json 2>/dev/null            # "scripts.test", devDeps: jest/vitest/mocha/node:test
ls *.cfg *.toml pyproject.toml 2>/dev/null   # pytest / other runners
git ls-files | grep -Ei '(\.test\.|\.spec\.|_test\.|/tests?/)' | head
```

Detect the **test runner**, the **existing test location & naming** convention,
and the **assertion/mocking style** already in use — match them exactly. If there
is no test setup at all, recommend a runner and confirm before adding a dev
dependency or config.

### 4. Understand the chunk and propose a test plan in the browser

Pick the mode from the chunk's `status`:

- **Red mode (`pending`):** there is no implementation to read. Derive the test
  surface from the chunk's contract: `description`, `# Implementation notes`,
  `# Snippets` (exported names, signatures), and the module paths in `files`.
  Import from the paths the chunk *will* own; assert the behavior the notes
  promise.
- **Green mode (`done`):** for each file in the chunk's `files` (expand globs
  against `git ls-files`), read the current implementation and its public
  surface.

In both modes, consider the failure modes implied by the chunk's `depends_on`.
Then propose a **test plan** and open it in the UI (include `"mode"` so the
user sees whether these tests are expected to fail):

```sh
node <skill-dir>/../iterator/server.mjs << 'TEST_DATA'
{
  "step": "test",
  "branch": "<branch>",
  "mode": "red",
  "chunk": { "name": "auth-middleware", "description": "JWT middleware for protected routes." },
  "runner": "vitest",
  "cases": [
    { "title": "requireAuth passes a valid token", "kind": "happy", "rationale": "Core behavior of the middleware." },
    { "title": "requireAuth rejects a missing token", "kind": "edge", "rationale": "Unauthenticated requests must 401." },
    { "title": "protected route + middleware end-to-end", "kind": "integration", "rationale": "The chunk spans router + middleware." }
  ]
}
TEST_DATA
```

Each case has a kind (`happy` / `edge` / `integration`), a one-line rationale, an
include checkbox, and a per-case comment box, plus an overall comment. Header
controls: **Accept** / **Cancel** / **Send review**.

### 5. Process the test-plan output

- `{ "type": "test-approved", "cases": [...] }` → write tests for exactly the
  included cases (step 6).
- `{ "type": "test-feedback", "cases": [...], "comment": "..." }` → revise the plan
  per the per-case and overall comments (add/remove/reword cases) and re-run
  step 4.
- `{ "type": "cancel" }` / `{ "type": "timeout" }` → stop; no files written.

### 6. Write the tests, run them, and verify the expected color

Write tests covering the approved cases:

- Place test files following the detected convention (co-located `*.test.*` or a
  `tests/` dir). Reuse existing helpers/fixtures rather than inventing new ones.
- Keep each chunk's tests in their own file(s) so coverage maps back to the
  chunk.
- Do **not** weaken assertions to make tests pass — if the implementation looks
  buggy, tell the user instead of asserting the buggy behavior.

Run only the new tests if the runner can target a path/pattern; otherwise run the
suite. Show real output — never claim a result without running. Then verify the
**expected color**:

- **Red mode:** the tests must fail **on assertions or missing exports** — that
  is the success condition ("N tests red — ready for `/iterator-implement`").
  A syntax error or unresolvable import *inside the test file itself* is a bug
  in the test — fix it, don't count it as red. Never soften a red run into a
  skip.
- **Green mode:** the tests must pass. A failure means either the test or the
  implementation is wrong — investigate and tell the user; do not adjust
  assertions to match buggy behavior.

### 7. Record, commit, and report

Update the chunk file: set `tests` (the test file paths), `tests_status`
(`red` or `green` as verified above), and `timestamp`. Regenerate
`memory/chunks/index.md` (the 🔴/🟢 badge — see `memory/format.md`) and prepend
a `memory/log.md` entry:
`* **Tests**: Added <N> <red|green> test(s) for [<Title>](/chunks/<slug>.md) (<runner>).`

Commit the test files **together with** the chunk-file/index/log updates
(branch safety: if on `main`/`master`, create and switch to a working branch
first — same rule as `/iterator-implement`):

```
test(<slug>): <short summary>

Chunk: <slug>
```

Then append `{ sha, kind: test, date }` to the chunk's `commits` list — in the
*next* bundle write (a commit cannot contain its own sha; per
`memory/format.md` the `Chunk: <slug>` trailer is the resilient lookup, so a
briefly missing sha is harmless).

Report which chunk was covered, the file(s) created, the verified color (red:
"expected to fail — implement drives these green"), any cases intentionally
left out and why, and whether other chunks still lack tests (offer to
continue). Do **not** change any chunk's `status` — `/iterator-implement`
owns `done` and `/iterator-review` owns review notes.

## Relationship to the other skills

- `/iterator-plan` + `/iterator-chunk` create the chunk files.
- `/iterator-test` reads them to generate tests per chunk (this skill); red
  tests written before implementation become the goal of `/iterator-implement`.
- `/iterator-implement` builds chunks, drives red tests green, and flips
  `tests_status` on Accept-and-commit; `/iterator-review` reviews their diffs.
