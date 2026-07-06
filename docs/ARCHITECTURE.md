# iterator Architecture

**iterator** is a Claude Code plugin that helps developers iterate on code
together with AI by forcing work into small, reviewable **chunks**. Devs still
lean on AI for planning and implementation, but the unit of change stays
human-reviewable (~200 lines), dependency-ordered, and durable across sessions.

## Core idea

Classical diff tools group changes by file. A developer's mental model is
organized around *what changed and why* — a unit of work often touches several
files at once. iterator makes the **chunk** the primary unit: a meaningful,
connected slice of implementation of roughly 200 lines, in dependency order.

Review-effectiveness research (Cisco/SmartBear) shows defect detection degrades
past ~200–400 lines, so ~200 is a conservative, reviewable default.

## Guided flow

```
/iterator            dashboard hub — dispatches the actions below, reopens after each
      ▼
/iterator-plan       create/revise the plan            → memory/plan.md
      │  (accept auto-continues)
      ▼
/iterator-chunk      break the plan into chunks        → memory/chunks/<slug>.md
      │
      ├─ (optional) /iterator-test   RED: failing tests from the chunk contract
      ▼
/iterator-implement  build the next dependency-ready chunk
      │  (green gate: drives the chunk's tests green; auto-starts the review)
      ▼
/iterator-review     chunk-vs-git-diff review          → outcome written into the chunk file

/iterator-test       GREEN: tests for an already-done chunk
```

All step skills share the `iterator-` prefix so they group in autocomplete, and
every step has a browser UI built on **one shared UI shell** (`lib/`, bundled
into each skill folder by `npm run sync`), so all six UIs look and behave the
same.

**The hub is a router, not a replacement.** `/iterator` gathers bundle + git
state, renders the dashboard (cards, badges, dependency graph, per-chunk
Test/Implement/Review buttons with enablement rules), and exits with one
`{ type: "action" }` payload; the skill dispatches into the chosen step flow
and reopens the dashboard when it finishes. The one-shot round-trip model is
kept deliberately — the dashboard closes while an action runs and reopens
after, rather than a long-running server with a progress channel (rejected:
it would break the "server exits on submit" contract every skill relies on).

**Red/green testing.** `tests_status` (`none | red | green`) is independent of
`status` (`pending | done`): `/iterator-test` on a pending chunk writes
contract-derived failing tests (red is the *success* condition — failing on
assertions/missing exports, not test-file bugs); `/iterator-implement` treats
those tests as the definition of done and only normally commits green.
`status` stays binary; an implemented-but-red chunk is representable as
`status: done, tests_status: red` when the user explicitly accepts red.

**Commit tracking.** Test and implement commits carry a `Chunk: <slug>`
trailer and are recorded as `{ sha, kind, date }` in the chunk's `commits`.
Recorded shas are an optimization (they go stale on rebase/amend); the trailer
grep is the resilient lookup. A commit cannot contain its own sha, so shas are
recorded in the next bundle write. This is what lets `/iterator-review`
rebuild the diff of an already-committed chunk.

## Plugin structure

```
iterator/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest (name: iterator; skills auto-discovered)
│   └── marketplace.json         # Local-marketplace manifest for persistent installs
├── lib/
│   ├── server.mjs               # shared local HTTP server: stdin→JSON, /submit + /cancel, timeout
│   └── ui.mjs                    # shared page shell: header, theme, CSS vars, esc/mdToHtml, post()
├── skills/                      # each folder is standalone (carries its own lib/ copy)
│   ├── iterator/                # hub dashboard: cards, badges, graph → dispatches actions
│   ├── iterator-plan/           # plan-review UI; creates/updates the memory/ bundle
│   ├── iterator-chunk/          # chunk-plan UI: graph, cards, split/merge → one file per chunk
│   ├── iterator-implement/      # builds the next ready chunk; green gate; auto-review; Accept and commit
│   ├── iterator-review/         # chunk-grouped diff review; writes outcomes into chunk files
│   └── iterator-test/           # per-chunk test-plan UI; red mode (pending) / green mode (done)
├── templates/
│   └── format.md                # self-describing bundle schema, copied into every bundle
├── scripts/
│   └── sync.mjs                 # copies lib/ + templates/ into the skill folders
├── docs/
│   └── OKF_SPEC.md              # Open Knowledge Format v0.1 spec
├── test/                        # node:test suite (npm test, no dependencies)
├── .github/workflows/ci.yml     # CI: runs the tests on push/PR
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── README.md
```

Skills are discovered automatically from `skills/*/SKILL.md`; the manifest does
not list them.

Every `skills/<name>/` folder is **standalone**: skills with a UI carry a
bundled copy of the shared shell (`skills/<name>/lib/`), and `iterator-plan`
also carries `templates/format.md`. That makes a single skill folder droppable
into any harness that implements the Agent Skills standard (Claude Code,
opencode, Codex CLI, pi) without the rest of the repo. The repo-root `lib/` and
`templates/` remain the source of truth; `npm run sync` refreshes the bundled
copies and `test/sync.test.mjs` fails if they drift.

## The `memory/` bundle (OKF v0.1)

All persistent state lives in a `memory/` directory created by `/iterator-plan`
in the *user's* project root. It is a conformant **OKF v0.1 bundle** — a
directory of markdown files with YAML frontmatter (see `docs/OKF_SPEC.md`). The
full schema is documented in `templates/format.md`, which every bundle carries
as `memory/format.md` so it stays self-describing when copied out of the repo.

```
memory/
├── index.md          # bundle root index; okf_version frontmatter (OKF §11)
├── format.md         # type: Reference — the metadata schema (copied from templates/)
├── plan.md           # type: Plan — the plan concept
├── log.md            # OKF §7 update log; skills append entries
└── chunks/
    ├── index.md      # chunk listing with status, for progressive disclosure
    └── <slug>.md     # type: Chunk — one concept per chunk
```

Key decisions:

- **One file per chunk.** The chunk **slug** (filename without `.md`) is the
  chunk's OKF concept ID, its `depends_on` key, and its commit-message name.
  This replaces the old monolithic file + line-number index (whose references
  broke on any edit above a chunk) and gives per-chunk git history for free.
- **`timestamp`, not `last_updated`.** OKF §4.1 already defines `timestamp` as
  "last meaningful change", so iterator uses the spec field rather than
  inventing a synonym, keeping the bundle interoperable.
- **`format.md` is a first-class concept** (`type: Reference`) inside the
  bundle, not schema prose stuffed into `index.md` (OKF §6 defines `index.md`
  as a *listing*). A bundle handed to any human or agent explains itself.
- **`log.md` audit trail.** Cheap, OKF-native, and answers "what happened since
  I last looked" across sessions.
- **Canonical dependencies live in frontmatter** (`depends_on`); the
  `# Depends on` body section is a human/graph mirror with optional "why" prose.
- **Bundle stays OKF-conformant at every step** (OKF §9): parseable
  frontmatter, non-empty `type`, `index.md`/`log.md` follow §6/§7. Consumers
  tolerate a stale index; skills regenerate indexes after any change.

The env var `ITERATOR_MEMORY_DIR` overrides the `memory/` location; it is always
resolved relative to the git root.

## Shared UI shell (`lib/`)

Every step's `server.mjs` shrinks to: parse the stdin payload → provide a body
renderer + step-specific browser JS → call `serve()`. Each server imports the
shell from its own bundled copy (`./lib/`, kept in sync with the repo-root
source by `npm run sync`). The shell provides the rest:

- **`lib/server.mjs`** — `readPayload()` (stdin→JSON) and `serve({ step, html })`:
  an HTTP server bound to `127.0.0.1` handling `GET /`, `POST /submit`,
  `POST /cancel`, plus a 2-hour timeout and the browser opener. Port comes from
  `ITERATOR_PORT` (default `7777`). Three defects from the old per-skill servers
  are fixed here:
  - **F8** — page data is embedded with `<` escaped (`embed()` in `ui.mjs`), so
    a diff line containing `</script>` can't terminate the script block.
  - **F9** — a busy port no longer crashes: `serve()` retries the next port a
    few times, then falls back to an ephemeral port, and always prints the real
    URL.
  - **F10** — the timeout prints `{ "type": "timeout" }` to stdout instead of
    exiting silently, so the SKILL.md output contract is never violated.

  Two protections on top of the `127.0.0.1` bind:
  - **Per-run token.** The opened URL carries a random token and every request
    must echo it (plus a localhost `Host` header) or get a 403. Without this,
    any web page open in the same browser could POST a forged `/submit` —
    which Claude would read as the user's answer — or `/cancel` the flow, and
    DNS rebinding could reach the server despite the localhost bind.
  - **Reload grace.** A `/cancel` from the `pagehide` beacon is held for a
    short grace period (`ITERATOR_CANCEL_GRACE_MS`, default 2.5s) and dropped
    if a `GET /` follows — so an accidental reload doesn't kill the flow. The
    explicit Cancel button sends `/cancel?now=1` and cancels immediately.

  `ITERATOR_NO_OPEN=1` skips the browser opener (CI); the real URL is always
  printed to stderr. Remote sessions (SSH, Docker/devcontainer — detected via
  `isRemoteSession()`: `ITERATOR_REMOTE` override, then SSH markers, then
  container marker files) bind `0.0.0.0` instead of loopback so a forwarded
  port can reach the server, skip the opener, and print a `127.0.0.1` URL for
  the host browser. `ITERATOR_BIND_HOST` (alias `ITERATOR_HOST`, deprecated)
  overrides the bind address either way — the token stays mandatory; only the
  localhost Host-header check is relaxed when bound beyond loopback.
- **`lib/ui.mjs`** — `renderPage()` builds the full page: the
  `iterator / <step>` header with a branch tag, theme toggle, **Cancel**, and a
  primary button that flips **Accept ↔ Send review** driven by a step-provided
  `hasChanges()` hook (the implement review's no-comment primary is **Accept and
  commit**). It ships the shared CSS variables (dark/light), `esc()`, a
  dependency-free `mdToHtml()` markdown renderer, the cancel-on-unload beacon,
  and the `post()` submit helper. `DIFF_CSS` is the shared diff-table style the
  review step (and via it, implement's commit mode) builds on.

Step-specific browser handlers are wired with `addEventListener` + closures,
never inline `on*` attribute strings built from data — so chunk names
containing quotes or backslashes can't break the markup or inject script.

This is what makes "each step has its own UI with the same base structure and
flow" true by construction rather than by copy-paste discipline.

### Browser round-trip (no temp files)

1. A skill builds a JSON payload and pipes it to `server.mjs` via a heredoc —
   nothing is written to `/tmp`.
2. `server.mjs` serves the page (data embedded inline, safely escaped) and opens
   the browser on `127.0.0.1:<port>`.
3. On submit the browser `POST`s structured JSON to `/submit`; the server prints
   it to stdout and exits. Closing the tab `POST`s `/cancel` (via `sendBeacon`),
   emitting `{ "type": "cancel" }`, so a closed tab never leaves the flow
   hanging.
4. Claude reads stdout, applies changes to the `memory/` bundle, and re-runs the
   server for the next round.

**Why a local server?** A browser page can't write to disk and there is no
skill-drivable in-editor UI channel, so a tiny localhost server closes the loop.
It is dependency-free, binds only to `127.0.0.1`, writes nothing to `/tmp`, and
exits on submit or timeout.

**Why LLM-driven split/merge via round-trip?** The browser can't call an LLM, so
Split/Merge `POST` a request; Claude performs the semantic split/merge, rewrites
the affected chunk files, and re-opens the UI.

## Skills

### `/iterator-plan`
Turns a goal into a plan and creates the `memory/` bundle (`index.md`,
`format.md`, `log.md`, `plan.md`). Offers one-time migration if legacy state
files are present. The plan-review UI renders sections as markdown
(click-to-edit, per-section comments, editable dependency chips). On acceptance
it sets `status: approved` and auto-continues into `/iterator-chunk`.

### `/iterator-chunk`
Splits the approved plan into chunks: one OKF file per chunk, regenerating
`chunks/index.md` and the plan's `# Chunks` section. The chunk-plan UI shows a
dependency-graph visualization, code snippets, per-chunk comments, drag-to-move
files, and **Split**/**Merge** buttons that round-trip to Claude. Split/merge
create/delete chunk files and rewire `depends_on`; cycle detection lives in both
the UI and the skill. Re-runnable to re-chunk, preserving `status: done` chunks.

### `/iterator` (hub)
Reads the bundle + git state, opens the dashboard (plan bar, dependency graph,
chunk cards with status/size/🔴🟢 badges, per-chunk **Test** / **Implement** /
**Review** buttons plus **Revise plan** / **Re-chunk**), and dispatches the
single action payload into the matching step flow, reopening the dashboard
when it finishes. Button enablement encodes the process rules (Implement only
when dependencies are done; Review only when a diff or recorded commits
exist); the step flows still re-validate, since a dashboard can be stale.

### `/iterator-implement`
Picks the next chunk whose `depends_on` are all `done` (topological order;
reports cycles/stuck states), implements it from the chunk file +
`ARCHITECTURE.md` (+ `GUIDELINES.md` if present). **Green gate:** if the chunk
has tests, they define done — implement → run → fix until green before the
review opens (red results are surfaced honestly, never papered over). If the
`impeccable` skill is installed, UI-surface chunks get an audit/polish pass.
Then it auto-opens the `/iterator-review` UI scoped to that chunk — test badge
visible — with **Accept and commit** as the primary. On accept: branch safety
(never commit to `main`/`master`), one commit `chunk(<slug>): <summary>` with
a `Chunk: <slug>` trailer that includes the code, the chunk-file flip
(`status: done`, `done:` date, `tests_status`, `timestamp`), the regenerated
indexes, and a `log.md` entry; the sha is recorded in the chunk's `commits` on
the next bundle write — then it offers the next ready chunk.

### `/iterator-review`
Standalone chunk review: pick a chunk (pending first, dependency order, then
done chunks, plus "All pending"), diff from open git changes (`git diff HEAD`,
with fallbacks) — or, for a done chunk with a clean tree, from the chunk's
recorded `commits` / `Chunk: <slug>` trailer — map hunks to chunks via each
chunk's `files` globs (first match wins, rest → Uncategorized). Outcomes are
written into the chunk file: `reviewed:` date refreshed, notes appended under
`# Review`, indexes and `log.md` regenerated. Review never sets
`status: done` — that stays owned by implement.

### `/iterator-test`
Opt-in per chunk, mode picked from the chunk's `status`: **red** on a pending
chunk (contract-derived failing tests — red is the success condition),
**green** on a done chunk (tests against the real code must pass). Detects the
project's test runner and conventions, proposes a **test plan** (happy path /
edge / integration cases, each with a rationale and a comment box) in the
shared UI — which shows the mode banner — then on accept writes the tests,
runs them, verifies the expected color, commits them (`test(<slug>)` +
trailer), and records `tests`/`tests_status` in the chunk file plus a `log.md`
entry. Never changes chunk `status`.

## Chunk sizing

| Est. lines | Label | Color | Guideline |
|---|---|---|---|
| ≤ 100 | small | green | Ideal — 10-minute review |
| 101–200 | medium | yellow | Acceptable — 30-minute review |
| > 200 | large | red | Should be split |

Size is estimated from the plan before code exists, so it is a soft target.
`/iterator-chunk` flags oversized chunks and offers Split; `/iterator-review`
warns on oversized diffs.
