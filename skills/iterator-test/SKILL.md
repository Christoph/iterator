---
name: iterator-test
description: Generate tests one feature at a time from the memory/ bundle. For a pending feature it runs in red mode — writing intentionally-failing tests from the feature's contract before any implementation exists (red/green flow); for a done feature it writes passing tests against the real code. Proposes a test plan in an interactive browser UI, then on accept writes, runs, and commits the tests and records tests/tests_status in the feature file. Never changes feature status. Use when the user types /iterator-test, asks to add tests for a planned feature, or wants feature-level test coverage.
---

# iterator-test

Generates tests at the **feature** level: pick a feature, review a proposed test
plan in the browser, then write focused tests for exactly the behavior that
feature covers. The mode is decided by the feature's `status`:

- **Red mode** (`pending`) — no implementation exists yet. Tests are written
  from the feature's *contract* (description, implementation notes, snippets,
  the module paths in `files`) and are **expected to fail**. Red tests become
  the goal `/iterator-implement` drives to green.
- **Green mode** (`done`) — tests are written against the real code and must
  pass.

The unit of testing is the feature, not the file. This skill **never** changes
a feature's `status` (it does set `tests`/`tests_status`). Draft features are not
testable — they must be accepted (pending) first.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

**Claude Code mode:** Use gather/write directly instead of the Pi dashboard.
Present the proposed cases in chat and wait for explicit approval before
writing or committing the feature's tests.

## When to use this skill

When the user types `/iterator-test`, asks to add or generate tests for a
planned feature, or wants feature-level coverage. If `memory/features/` has no
feature files, tell the user: "No features found. Run `/iterator-plan` →
`/iterator-feature` first." and stop. If the user's message contains a
test-plan result payload (`test-approved`, `test-feedback`, `cancel`,
`timeout`), process it (steps 3–5) first.

## Steps

### 1. Choose which feature to test

Get the feature list from
`node <skill-dir>/../iterator/gather.mjs --step hub` (do **not** read bundle
files yourself). If the user named a feature, use it. Otherwise ask **via the
browser question view first** (pipe `{ "step": "question", "title": "Feature",
"question": "...", "options": [...] }` into
`node <skill-dir>/../iterator/server.mjs`; pi mode: `iterator_ui` step
`question`), printing "Question waiting in the browser dashboard." in the
terminal; fall back to terminal `AskUserQuestion` only when the server is
unavailable — most-foundational features first (dependency order), labeled
with name and size; a feature's dependencies should already be covered where
possible.

### 2. Gather the contract and derive the test plan

```sh
node <skill-dir>/../iterator/gather.mjs --step test --feature <slug>
```

It prints `mode` (red/green), the feature `contract`, the detected `runner`,
`existingTests` (sample paths showing the project's conventions), and
`suggestedTestPath` (a convention-matching location for the new file). Read
a couple of the `existingTests` files to match the assertion/mocking style
exactly. If `runner` is null there is no test setup — recommend one and
confirm before adding a dev dependency or config.

Derive the cases:

- **Red mode:** use the contract — import from the paths the feature *will*
  own; assert the behavior the notes promise.
- **Green mode:** for each file in the contract's `files` (expand globs
  against `git ls-files`), read the current implementation and its public
  surface.
- In both modes, consider the failure modes implied by the feature's
  `dependsOn`.

Then open the test-plan UI — the server gathers the payload itself; your
drafted `cases` are the only thing you pass (each
`{ "title": ..., "kind": "happy|edge|integration", "rationale": ... }`):

```sh
node <skill-dir>/../iterator/server.mjs << 'TEST_DATA'
{ "gather": true, "step": "test", "feature": "<slug>",
  "extra": { "cases": [ { "title": "...", "kind": "happy", "rationale": "..." } ] } }
TEST_DATA
```

### 3. Process the test-plan output (one JSON line)

- `{ "type": "test-approved", "cases": [...] }` → write tests for exactly the
  included cases (step 4).
- `{ "type": "test-feedback", "cases": [...], "comment": "..." }` → revise
  the plan per the comments and re-run step 2's serve.
- `cancel` / `timeout` → relay the result's `report` and stop; no files
  written.

### 4. Write the tests, run them, and verify the expected color

- Place test files at `suggestedTestPath` (or the detected convention). Reuse
  existing helpers/fixtures rather than inventing new ones.
- Keep each feature's tests in their own file(s) so coverage maps back to the
  feature.
- Do **not** weaken assertions to make tests pass — if the implementation
  looks buggy, tell the user instead of asserting the buggy behavior.

Run only the new tests if the runner can target a path/pattern; otherwise run
the suite. Show real output — never claim a result without running. Then
verify the **expected color**:

- **Red mode:** the tests must fail **on assertions or missing exports** —
  that is the success condition ("N tests red — ready for
  `/iterator-implement`"). A syntax error or unresolvable import *inside the
  test file itself* is a bug in the test — fix it, don't count it as red.
  Never soften a red run into a skip.
- **Green mode:** the tests must pass. A failure means either the test or the
  implementation is wrong — investigate and tell the user; do not adjust
  assertions to match buggy behavior.

### 5. Record and commit — one op

The whole record-and-commit choreography (branch safety, staging the test
files with the bundle updates, the `test(<slug>)` commit with its `Feature:`
trailer, `tests`/`tests_status` frontmatter, sha recording, index/log
regeneration) is one deterministic write:

```sh
node <skill-dir>/../iterator/write.mjs << 'TEST_COMMIT'
{ "op": "commit-tests", "feature": "<slug>",
  "files": ["<test file path>", "..."],
  "testsStatus": "<red|green>", "summary": "<short summary>" }
TEST_COMMIT
```

The recorded `tests` paths make the test files part of the feature's review
scope, so `/iterator-review` shows them next to the logic they cover.

Report which feature was covered, the file(s) created, the verified color (red:
"expected to fail — implement drives these green"), any cases intentionally
left out and why, and whether other features still lack tests (offer to
continue).

## Auto mode (`--auto`)

When invoked as `/iterator-test <feature> --auto` (dispatched by the auto-mode
driver): the run is **unattended — never open `iterator_ui` (any step,
including `question`) and never wait for a browser answer**; a gate would
hang the feature in `testing` forever (the extension refuses gate views in auto
mode as a backstop, but do not rely on it). Derive the red test plan from the
feature contract (step 2), write the failing tests, run them to confirm they
fail for the right reason, and commit via the `commit-tests` op exactly as in
the manual flow. Report the test files and the failing output in one short
paragraph and stop — the driver dispatches the implementation next.
