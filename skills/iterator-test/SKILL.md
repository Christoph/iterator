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
`test-feedback`, `cancel`, `timeout`), process it (steps 4–6).

**pi mode:** if the tools `iterator_gather` / `iterator_write` / `iterator_ui`
are available, use them instead of the shell pipelines below.
`iterator_ui { step: "test", chunk: "<slug>", extra: { cases: [...] } }`
gathers the chunk contract/runner itself — your drafted `cases` are the only
thing you pass; `iterator_write` replaces the write.mjs heredocs. Steps,
payloads, and rules are unchanged. Draft chunks are not testable — they must
be accepted (pending) first.

## Steps

### 1. Choose which chunk to test

Get the chunk list from `node <skill-dir>/../iterator/gather.mjs --step hub`
(names, sizes, statuses, test badges — do **not** read bundle files yourself).
If the user named a chunk, use it. Otherwise use `AskUserQuestion` (header
`Chunk`) — offer the most-foundational chunks first (dependency order), each
labeled with the chunk name and size. Prefer testing dependency-first so a
chunk's dependencies are already covered.

### 2. Gather the chunk contract, mode, and test setup

One scripted call collects everything mechanical:

```sh
node <skill-dir>/../iterator/gather.mjs --step test --chunk <slug>
```

It prints the payload skeleton: `mode` (red/green from the chunk's `status`),
the chunk `contract` (implementation notes, snippets, files, dependsOn), the
detected `runner` (package.json scripts/deps, pytest config), and
`existingTests` (sample paths showing the project's location/naming
convention). Read a couple of the `existingTests` files to match the
assertion/mocking style exactly. If `runner` is null there is no test setup —
recommend one and confirm before adding a dev dependency or config.

### 3. Propose a test plan in the browser

Derive the cases from the gathered contract:

- **Red mode (`pending`):** there is no implementation to read. Use the
  contract — `description`, implementation notes, snippets (exported names,
  signatures), and the module paths in `files`. Import from the paths the
  chunk *will* own; assert the behavior the notes promise.
- **Green mode (`done`):** for each file in the contract's `files` (expand
  globs against `git ls-files`), read the current implementation and its
  public surface.

In both modes, consider the failure modes implied by the chunk's `dependsOn`.
Then fill the gathered skeleton's `cases` and pipe it into the UI server —
each case `{ "title": ..., "kind": "happy|edge|integration", "rationale": ... }`:

```sh
node <skill-dir>/../iterator/server.mjs << 'TEST_DATA'
<the gathered payload with cases filled in>
TEST_DATA
```

Each case has a kind (`happy` / `edge` / `integration`), a one-line rationale, an
include checkbox, and a per-case comment box, plus an overall comment. Header
controls: **Accept** / **Cancel** / **Send review**.

### 4. Process the test-plan output

- `{ "type": "test-approved", "cases": [...] }` → write tests for exactly the
  included cases (step 5).
- `{ "type": "test-feedback", "cases": [...], "comment": "..." }` → revise the plan
  per the per-case and overall comments (add/remove/reword cases) and re-run
  step 3.
- `{ "type": "cancel" }` / `{ "type": "timeout" }` → stop; no files written.

### 5. Write the tests, run them, and verify the expected color

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

### 6. Record, commit, and report

Record through the bundle writer — it sets the frontmatter, updates the
`timestamp`, regenerates the index (🔴/🟢 badge), and prepends the log entry.
The recorded `tests` paths make the test files part of the chunk's review
scope: `/iterator-review` groups their diff with the chunk, so the tests are
always reviewed next to the logic they cover:

```sh
node <skill-dir>/../iterator/write.mjs << 'TEST_WRITE'
{
  "op": "update-chunk",
  "chunk": "<slug>",
  "set": { "tests": ["<test file path>", "..."], "tests_status": "<red|green>" },
  "log": "**Tests**: Added <N> <red|green> test(s) for [<Title>](/chunks/<slug>.md) (<runner>)."
}
TEST_WRITE
```

Commit the test files **together with** the bundle updates (branch safety: if
on `main`/`master`, create and switch to a working branch first — same rule as
`/iterator-implement`):

```
test(<slug>): <short summary>

Chunk: <slug>
```

Then record the sha in the *next* bundle write by piping
`{ "op": "update-chunk", "chunk": "<slug>", "appendCommit": { "sha": "<sha>", "kind": "test" } }`
into the writer (a commit cannot contain its own sha; per `memory/format.md`
the `Chunk: <slug>` trailer is the resilient lookup, so a briefly missing sha
is harmless).

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
