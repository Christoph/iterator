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

All step skills share the `iterator-` prefix so they group in autocomplete.

**The UI is the control plane; the skills are the logic.** One server —
`skills/iterator/server.mjs`, shipped with the hub skill — renders every
step's view (`hub`, `plan`, `chunk`, `test`, `review`, selected by the
payload's `step` field) on one fixed port. The step skills never own a server:
they gather state, assemble a payload, pipe it into the hub's server
(`<skill-dir>/../iterator/server.mjs`), and process the single JSON line that
comes back. All views are built on the same shared shell (`lib/ui.mjs` +
`lib/views/`, bundled into the hub skill folder by `npm run sync`), so they
look and behave the same.

**The hub is a router, not a replacement.** `/iterator` gathers bundle + git
state, renders the dashboard (cards, badges, dependency graph, per-chunk
Test/Implement/Review buttons with enablement rules), and exits with one
`{ type: "action" }` payload; the skill dispatches into the chosen step flow
and reopens the dashboard when it finishes. The one-shot round-trip model is
kept deliberately — the server exits on every submit rather than staying
resident with a progress channel — but the **port is a stable singleton**:
each new server run shuts down a lingering predecessor and rebinds the same
port, so the flow feels like one continuously-updating dashboard tab.

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
├── extensions/
│   └── iterator.js              # pi extension: /iterator… commands → /skill:iterator…
├── lib/                         # SOURCE OF TRUTH for every core (synced into the hub skill)
│   ├── app.mjs                  # control plane: view dispatch, one-command gather, onSubmit
│   ├── server.mjs               # shared local HTTP server: stdin→JSON, /submit + /cancel,
│   │                            #   single-instance takeover, timeout, cancel/timeout reports
│   ├── gather.mjs               # deterministic state gathering for every step
│   ├── write.mjs                # deterministic bundle writer (all ops; --schema <op>)
│   ├── git.mjs                  # one git/gitOrFail/hasStaged helper set
│   ├── bundle.mjs               # frontmatter/index/log primitives + validateBundle
│   ├── guardrails.mjs           # bundle-write guardrails for harness hooks
│   ├── pi-tools.mjs             # pure helpers behind the pi extension's tools
│   ├── session-server.mjs       # pi session dashboard (persistent tab)
│   ├── ui.mjs                   # shared page shell + "ink & ember" design tokens
│   └── views/                   # one view module per step (render(data) → html)
│       ├── hub.mjs              #   dashboard: cards, badges, graph → dispatches actions
│       ├── plan.mjs             #   plan review: sections, comments, dependency chips
│       ├── chunk.mjs            #   chunk breakdown: graph, cards, split/merge
│       ├── test.mjs             #   per-chunk test plan; red/green mode banner
│       ├── review.mjs           #   chunk-grouped diff review (+ implement's commit mode)
│       ├── knowledge.mjs        #   okf memory plane dashboard
│       └── memory-review.mjs    #   memory card review (init/consolidate/memorize)
├── skills/
│   ├── iterator/                # hub skill — thin shims (server/gather/write.mjs) + lib/ copy + PI.md
│   ├── iterator-plan/           # logic-only; carries templates/format.md
│   ├── iterator-chunk/          # logic-only
│   ├── iterator-implement/     # logic-only; green gate; auto-review; Accept and commit
│   ├── iterator-design/         # logic-only; design params + UI quality rules
│   ├── iterator-review/         # logic-only
│   ├── iterator-test/           # logic-only
│   └── okf*, okf-init, …        # knowledge plane skills + shared okf/PROTOCOL.md
├── templates/
│   └── format.md                # self-describing bundle schema, copied into every bundle
├── scripts/
│   ├── sync.mjs                 # copies lib/ (+views) into the hub skill, template into iterator-plan
│   └── githooks/pre-commit      # runs sync + drift check (npm run hooks:install)
├── docs/
│   └── OKF_SPEC.md              # Open Knowledge Format v0.1 spec
├── test/                        # node:test suite (npm test, no dependencies)
├── .github/workflows/ci.yml     # CI: runs the tests on push/PR
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── README.md
```

Skills are discovered automatically from `skills/*/SKILL.md`; the manifest does
not list them. The `pi` manifest in `package.json` additionally registers
`extensions/iterator.js`, which adds friendly `/iterator…` commands in pi that
forward to the skills (same pattern as okf-memory).

The **hub skill folder is the UI**: `skills/iterator/` carries thin shims
(`server.mjs`, `gather.mjs`, `write.mjs` — re-export + `runCli` only) plus a
bundled copy of every core and view (`skills/iterator/lib/`). The step skills
are logic-only — they must be installed **alongside** the hub skill, whose
scripts they invoke as `<skill-dir>/../iterator/<name>.mjs`. `iterator-plan`
also carries `templates/format.md`. The repo-root `lib/` and `templates/` are
the source of truth; `npm run sync` refreshes the bundled copies,
`test/sync.test.mjs` fails if they drift, and `npm run hooks:install` sets up
a pre-commit hook that syncs automatically.

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
├── design.md         # optional — type: Design — project design params (/iterator-design)
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

The hub's `server.mjs` is a thin dispatcher: parse the stdin payload → pick
the view module from `payload.step` → `serve()` the rendered page. Each view
module (`lib/views/<step>.mjs`) supplies only a body renderer + step-specific
browser JS; the shell provides the rest:

- **`lib/server.mjs`** — `readPayload()` (stdin→JSON) and `serve({ step, html })`:
  an HTTP server bound to `127.0.0.1` handling `GET /`, `POST /submit`,
  `POST /cancel`, plus a 2-hour timeout and the browser opener. Port comes from
  `ITERATOR_PORT` (default `7777`). Defects fixed here:
  - **F8** — page data is embedded with `<` escaped (`embed()` in `ui.mjs`), so
    a diff line containing `</script>` can't terminate the script block.
  - **F9** — the port is a **stable singleton**. Each server records
    `{ pid, port }` in a per-user registry file (`ITERATOR_REGISTRY`
    overrides the path); the next server verifies the recorded process really
    is a lingering iterator UI via the tokenless read-only
    `GET /__iterator/status` endpoint (so a reused pid is never killed by
    mistake), SIGTERMs it, waits for it to exit, and binds the same fixed
    port. That is what keeps a sandbox's `7777:7777` forward working across
    runs — an orphaned server can no longer push the next run to 7778. Only
    when a *foreign* process holds the port does `serve()` walk up / fall
    back to an ephemeral port, always printing the real URL.
    `ITERATOR_NO_TAKEOVER=1` disables the takeover (used by the tests).
  - **F10** — the timeout prints `{ "type": "timeout" }` to stdout instead of
    exiting silently, so the SKILL.md output contract is never violated.
  - **F11** — SIGTERM/SIGINT/SIGHUP print `{ "type": "cancel" }` before
    exiting, so a superseded or interrupted server still satisfies the
    one-JSON-line contract and never leaves the port occupied.

  Protections on top of the `127.0.0.1` bind:
  - **Host-header check.** Locally, requests with a non-localhost `Host`
    header get a 403, so DNS rebinding can't reach the server. (There is no
    per-run URL token — the dashboard is a local dev tool and the URL stays
    clean, matching okf-memory's server.)
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
  overrides the bind address either way; the localhost Host-header check is
  relaxed when bound beyond loopback, so keep the host-side publish on
  loopback. This is the mode the
  [pi-docker-sandbox-setup](https://github.com/Christoph/pi-docker-sandbox-setup)
  image runs in: it sets `ITERATOR_REMOTE=1` and its `pisbx` script publishes
  `7777:7777` — the one port everything (Work and Knowledge views) runs on
  since the okf-memory absorption — which is why the single-instance fixed
  port matters.
- **`lib/ui.mjs`** — `renderPage()` builds the full page: the
  `iterator / <step>` header with a branch tag, theme toggle, **Cancel**, and a
  primary button that flips **Accept ↔ Send review** driven by a step-provided
  `hasChanges()` hook (the implement review's no-comment primary is **Accept and
  commit**). It ships the **"ink & ember" design system** — `:root` font/type
  scale/spacing/radius tokens plus warm charcoal (dark) / warm paper (light)
  theme blocks with an ember copper accent; both blocks define the identical
  token set and the semantic diff pairs are AA-checked in `test/ui.test.mjs`,
  and the view files may not contain raw hex (regex-tested) — every color
  comes from a token. It also ships `esc()`, a dependency-free `mdToHtml()`
  markdown renderer, the cancel-on-unload beacon, and the `post()` submit
  helper. `DIFF_CSS` is the shared diff-table style the review step (and via
  it, implement's commit mode) builds on.

Step-specific browser handlers are wired with `addEventListener` + closures,
never inline `on*` attribute strings built from data — so chunk names
containing quotes or backslashes can't break the markup or inject script.

This is what makes "each step has its own view with the same base structure
and flow" true by construction rather than by copy-paste discipline.

### Browser round-trip (no temp files)

1. A skill pipes a JSON payload to the hub's `server.mjs` — nothing is written
   to `/tmp`. For most steps this is the **one-command request form**
   `{"gather":true,"step":"<step>","chunk"?,"project"?,"extra"?}`: the server
   gathers the step payload itself (in-process, same `lib/` cores) and merges
   the small agent-authored `extra` on top. A fully-gathered payload with a
   `step` field keeps working (implement's commit review uses it to inject
   per-chunk test state).
2. `server.mjs` replaces any lingering iterator server, serves the page (data
   embedded inline, safely escaped), and opens the browser on
   `127.0.0.1:<port>`.
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
review opens (red results are surfaced honestly, never papered over).
UI-surface chunks go through `/iterator-design`: the gather payload's
`designFile` says whether `memory/design.md` exists, and its params + rules
apply while building. Then it auto-opens the `/iterator-review` UI scoped to
that chunk — test badge
visible — with **Accept and commit** as the primary. On accept: branch safety
(never commit to `main`/`master`), one commit `chunk(<slug>): <summary>` with
a `Chunk: <slug>` trailer that includes the code, the chunk-file flip
(`status: done`, `done:` date, `tests_status`, `timestamp`), the regenerated
indexes, and a `log.md` entry; the sha is recorded in the chunk's `commits` on
the next bundle write — then it offers the next ready chunk.

### `/iterator-design`
The project's design parameters, captured once and reused. On the first chunk
with UI surface (or a manual `/iterator-design`) it derives a proposal from
the plan (`# Goal` / `# Product fit`) and the codebase (existing Tailwind
config, CSS custom properties, fonts), confirms it with the user in one round,
and persists it via the writer's `design` op → `memory/design.md`
(`type: Design`: direction, typography, color, spacing, responsive,
signature). Every later UI chunk reads the same file, so the project's UIs
stay consistent across chunks and sessions. The skill also carries the
condensed built-in design rules (typography scale, 60-30-10 color + WCAG
contrast, 4pt spatial rhythm, mobile-first responsive) that fill whatever the
params don't pin down. Invoked manually it also runs an audit → fix pass over
existing UI (off-scale values, stray accents, contrast, nested cards) against
the saved params. Logic-only, no browser UI — confirmation happens in chat.
Re-running it revises the params (`created` is preserved, `timestamp`
refreshed, `log.md` gets an entry).

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

## Chunking

Chunks are cut **by feature**: one user-visible capability per chunk — a
vertical slice including its own tests — implementable, testable, and
reviewable on its own. `size` (`small | medium | large`) is a judgment call
on how big the feature feels, not a line estimate; `large` means "probably
two features" and is flagged in the UIs with Split on offer. Predicted line
counts proved unreliable, so reviewability is enforced against the **actual**
diff instead: `/iterator-review` computes real code-line stats per chunk and
warns above ~200 changed code lines (comments/docs excluded).
