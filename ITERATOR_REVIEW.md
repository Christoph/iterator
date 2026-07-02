# Iterator — Project Review & Restructuring Spec

> **Status:** approved direction, ready to implement
> **Date:** 2026-07-02
> **Implements for:** Opus (or any implementing agent). Work through §5 in dependency
> order, one work item at a time. Everything an item needs is specified in §3–§4;
> do not invent new file formats or field names beyond what is defined here.

---

## 1. What this project is (target state)

**iterator** is a Claude Code plugin that helps developers iterate on code together
with AI by forcing work into small, reviewable **chunks**. The guided flow is:

```
/iterator-plan       create/revise the plan            → memory/plan.md
      │  (accept auto-continues)
      ▼
/iterator-chunk      break the plan into chunks        → memory/chunks/<slug>.md
      │
      ▼
/iterator-implement  build the next dependency-ready chunk
      │  (auto-starts the review at the end)
      ▼
/iterator-review     chunk-vs-git-diff review          → outcome written into the chunk file
      
/iterator-test       (optional, any time after chunking) write tests for a chunk
```

All persistent state lives in a `memory/` directory that is a conformant
**OKF v0.1 bundle** (see `OKF_SPEC.md`): the plan is one concept document, every
chunk is its own concept document under `memory/chunks/`. Every step has a browser
UI built on one shared UI shell so all five steps look and behave the same.

The value proposition: devs still leverage AI for planning and implementation, but
the unit of change stays human-reviewable (~200 lines), dependency-ordered, and
durable across sessions.

---

## 2. Review findings (current state)

The repo is currently named `local-review` with `lr-`-prefixed skills. It is
mid-migration from an older "features" model and has real defects:

### Blocking
- **F1 — Plugin is not installable.** There is no `.claude-plugin/plugin.json`,
  yet README, ARCHITECTURE and CONTRIBUTING all instruct `claude plugins install .`
  and claim skills are auto-discovered from the manifest's presence.
- **F2 — README documents a product that no longer exists.** It describes
  `/plan-features` + `/review`, a `FEATURES.md`/`PLAN.md` two-file design, and a
  repo layout (`skills/review/`, `skills/plan-features/`) that doesn't match the
  actual `skills/lr-*` directories.
- **F3 — `package.json` scripts are broken.** `test:review-server` and
  `test:plan-server` point at `skills/review/server.mjs` and
  `skills/plan-features/server.mjs`; the real paths are `skills/lr-review/` and
  `skills/lr-plan-features/`.

### Structural
- **F4 — ~500 lines of scaffolding duplicated across three `server.mjs` files**
  (stdin→JSON, HTTP server with `/submit` + `/cancel`, 2h timeout, `doneHtml`,
  theme CSS variables, header controls, `esc()`, cancel-on-unload; the markdown
  renderer exists only in one). The user requirement "every step has its own UI
  with the same base structure" makes extraction mandatory, not just nice.
- **F5 — Monolithic `CHUNKS.md` + line-number index is fragile.** The
  `PLAN.md` Chunks Index stores *line numbers* into `CHUNKS.md`; any edit above a
  chunk silently invalidates every reference below it. One-file-per-chunk (OKF)
  removes the whole failure class and gives per-chunk git history for free.
- **F6 — `/lr-test-features` has no UI**, breaking the "all steps feel the same"
  goal.
- **F7 — Repo root is littered with stale dogfood artifacts**: `PLAN.md` and
  `CHUNKS.md` describe *building this plugin* and still reference `FEATURES.md`;
  `PLAN-features.md` is a completed design doc; `test.md` contains the single line
  "this is a test". `skills/*/templates/feature-*.md` still use the old "feature"
  naming.

### Defects in the servers (fix while extracting the shared lib)
- **F8 — `</script>` injection breaks the page.** Payload data is embedded via
  `JSON.stringify(data)` directly into a `<script>` block. A diff line containing
  `</script>` (plausible — this tool reviews code) terminates the script tag.
  Escape with `.replace(/</g, '\\u003c')` when embedding.
- **F9 — Port collision crashes the server.** `server.listen(8888)` has no
  `error` handler; a second concurrent run (or anything on 8888) throws
  `EADDRINUSE` and the skill flow dies with no JSON output. Retry on the next
  port (or fall back to an ephemeral port) and print the actual URL.
- **F10 — Timeout emits nothing.** After 2h the server logs to stderr and exits 0
  without printing a JSON event, so the SKILL.md output contract
  (`plan-approved` | `…-feedback` | `cancel`) is silently violated. Emit
  `{ "type": "timeout" }` to stdout.

---

## 3. Target design

### 3.1 Naming (rename everything)

| Old | New |
|---|---|
| plugin / repo name `local-review` | `iterator` |
| `skills/lr-plan-features/` | split into `skills/iterator-plan/` + `skills/iterator-chunk/` |
| `skills/lr-implementer/` | `skills/iterator-implement/` |
| `skills/lr-review/` | `skills/iterator-review/` |
| `skills/lr-test-features/` | `skills/iterator-test/` |
| env var `LOCAL_REVIEW_PORT` | `ITERATOR_PORT` (default stays `8888`) |
| UI header logo `local-review` | `iterator` (subtitle = step name: `/ plan`, `/ chunks`, `/ implement`, `/ review`, `/ test`) |
| `PLAN.md` + `CHUNKS.md` state files | `memory/` OKF bundle (§3.2) |

Skill frontmatter `name:` fields, all SKILL.md prose, server stderr messages,
page `<title>`s, commit-message conventions and docs must use the new names.
No occurrence of `local-review`, `lr-`, `FEATURES.md`, or the old file model may
remain (except in `ITERATOR_REVIEW.md` itself and git history).

### 3.2 The `memory/` bundle (OKF v0.1)

Created in the *user's* project root by `/iterator-plan`. Layout:

```
memory/
├── index.md          # bundle root index; carries okf_version frontmatter (OKF §11)
├── format.md         # type: Reference — self-describing metadata schema (§3.4)
├── plan.md           # type: Plan — the plan concept (§3.5)
├── log.md            # OKF §7 update log; skills append entries (§3.7)
└── chunks/
    ├── index.md      # chunk listing with status, for progressive disclosure (§3.6)
    └── <slug>.md     # type: Chunk — one concept per chunk (§3.3)
```

Rules:
- The directory name is `memory/` at the project root. Honor
  `ITERATOR_MEMORY_DIR` (env) as an override; always resolve relative to the git
  root.
- The bundle MUST stay OKF v0.1 conformant (OKF §9): every non-reserved `.md`
  file has parseable YAML frontmatter with a non-empty `type`; `index.md` and
  `log.md` follow OKF §6/§7.
- Cross-references between documents use bundle-absolute links
  (`/chunks/auth-middleware.md`) per OKF §5.1.
- Skills regenerate `index.md` files after any change; consumers must tolerate a
  stale index (OKF permissive-consumption model).

### 3.3 Chunk document format (the core schema)

Path: `memory/chunks/<slug>.md`. The **slug** (kebab-case filename without
`.md`) is the chunk's identity — it is the OKF concept ID (`chunks/<slug>`), the
value used in `depends_on`, and the name used in commit messages. Renaming a
chunk = renaming the file + rewriting all `depends_on` references.

```markdown
---
type: Chunk                             # REQUIRED (OKF §4.1)
title: Auth middleware                  # display name
description: JWT-based auth middleware for all protected routes.  # one line
status: pending                         # pending | done
size: small                             # small (≤100 est. lines) | medium (≤200) | large (>200)
lines_estimate: 60                      # integer, estimated from the plan
depends_on: [config-module]             # chunk slugs; [] if none
files: ["src/auth.ts", "src/middleware/*.ts"]   # paths/globs this chunk owns
timestamp: 2026-07-02T10:00:00Z         # OKF "timestamp": last meaningful change
done: 2026-07-02                        # present only once implemented & committed
reviewed: 2026-07-02                    # present only after a review pass
tags: []                                # optional
---

# Implementation notes

How to build it: approach, constraints, gotchas. Written by /iterator-chunk,
consumed by /iterator-implement.

# Snippets

Illustrative code (interfaces, key functions, call sites) — never full
implementations.

```ts
export function requireAuth(req, res, next) { /* … */ }
```

# Depends on

* [Config module](/chunks/config-module.md) — needs the JWT secret from config.

# Blast radius

What breaks if this chunk is wrong; which other chunks/files feel it.

# Review

## 2026-07-02
* **Approved** — after 1 feedback round: renamed `verify()` to `verifyToken()`.
```

Field semantics (this is also the content of `format.md`, §3.4):

| Field | Required | Meaning / rules |
|---|---|---|
| `type` | yes | Always `Chunk`. OKF consumers route on this. |
| `title` | yes | Human display name. |
| `description` | yes | One sentence; copied into `chunks/index.md` entries. |
| `status` | yes | `pending` or `done`. Only `/iterator-implement` sets `done` (on Accept-and-commit). |
| `size` / `lines_estimate` | yes | Soft ~200-line guideline. `large` chunks get a ⚠️ in UIs and should be split. |
| `depends_on` | yes (may be `[]`) | Chunk slugs that must be `done` before this chunk is implemented. Must be acyclic; must reference existing files. This is the **canonical** dependency data — the `# Depends on` body section is a human/OKF-graph mirror of it with optional "why" prose. |
| `files` | yes | Paths or simple globs the chunk owns. Used by `/iterator-review` to map diff hunks to the chunk. First matching chunk wins. |
| `timestamp` | yes | ISO 8601. This is the user-requested `last_updated` field: OKF §4.1 already defines `timestamp` as "last meaningful change", so iterator uses the spec's field name instead of inventing `last_updated`. Every skill that edits the file updates it. |
| `done`, `reviewed` | when applicable | ISO dates. `reviewed` is set/refreshed by `/iterator-review`; review outcomes and notes are appended to the `# Review` body section (newest first, OKF log style). |

Body sections `# Implementation notes`, `# Snippets`, `# Depends on`,
`# Blast radius` are written at chunk-creation time; `# Review` is appended by
review passes. All are optional except `# Implementation notes`.

### 3.4 `format.md` — where the metadata format is explained

Decision on the user's open question ("index.md or the root?"): the schema is
documented **inside the bundle** as a first-class concept `memory/format.md`
(`type: Reference`), because:
- OKF §6 defines `index.md` as a *listing* (and permits frontmatter only for
  `okf_version` at the root), so a schema explanation does not belong there;
- a self-describing bundle survives being copied out of the repo — any human or
  agent that receives `memory/` alone can understand it.

`format.md` content = the field tables from §3.3 and §3.5 plus one full example
chunk. The plugin ships it as `templates/format.md`; `/iterator-plan` copies it
into every new bundle verbatim. `memory/index.md` links to it. The plugin's
`ARCHITECTURE.md` documents the same schema for contributors.

### 3.5 Plan document format

Path: `memory/plan.md`.

```markdown
---
type: Plan
title: Add JWT authentication
description: JWT-based auth for all protected API routes.
status: draft                           # draft | approved
branch: feature/auth
created: 2026-07-02
timestamp: 2026-07-02T10:00:00Z
---

# Goal
…

# Architecture
…

# Dependencies
* `jsonwebtoken` — token signing/verification

# Key decisions
…

# Product fit
…

# Chunks

* [Config module](/chunks/config-module.md) - Centralize env/config access
* [Auth middleware](/chunks/auth-middleware.md) - JWT middleware for protected routes
```

`status: approved` is set when the user accepts the plan in the UI. The
`# Chunks` section is (re)generated by `/iterator-chunk` and links every chunk
(OKF cross-links, so graph consumers see plan → chunk edges).

### 3.6 Index files

`memory/index.md` (root — the only index allowed frontmatter, OKF §11):

```markdown
---
okf_version: "0.1"
---

# Iterator memory

* [Plan](plan.md) - JWT-based auth for all protected API routes.
* [Format](format.md) - Metadata schema for this bundle.
* [Chunks](chunks/) - One document per implementation chunk.
* [Log](log.md) - Chronological history of plan/chunk/implement/review events.
```

`memory/chunks/index.md` (no frontmatter; status folded into the description
text, which OKF permits):

```markdown
# Chunks

* [Config module](config-module.md) - ✅ done · small · Centralize env/config access
* [Auth middleware](auth-middleware.md) - ⬜ pending · small · depends: config-module · JWT middleware
* [API routes](api-routes.md) - ⬜ pending · medium · depends: auth-middleware · REST routes
```

Ordering: dependency order (topological, ties by creation order). Every skill
that changes chunk status/metadata regenerates this file. This index replaces
the old line-number Chunks Index entirely (fixes F5); skills achieve context
efficiency by reading `chunks/index.md` first, then opening only the chunk
file(s) they need.

### 3.7 `log.md`

OKF §7 format, newest first. Each skill appends one entry per meaningful event:

```markdown
# Iterator update log

## 2026-07-02
* **Review**: Approved [Auth middleware](/chunks/auth-middleware.md) after 1 feedback round.
* **Implementation**: Committed chunk(auth-middleware) on branch feature/auth.
* **Creation**: Plan approved; created 3 chunks.
```

This is the cross-session audit trail ("what did the AI do while I was gone").

### 3.8 Shared UI shell (`lib/`)

New plugin-root directory imported by every skill's `server.mjs` via relative
path (`import { serve } from '../../lib/server.mjs'`):

- **`lib/server.mjs`** — `serve({ step, data, buildContent })`: stdin→JSON,
  HTTP server (`GET /` , `POST /submit`, `POST /cancel`), browser opener,
  2h timeout. Incorporates the fixes: `<`-escaped JSON embedding (F8),
  EADDRINUSE retry on next port + print actual URL (F9), `{ "type": "timeout" }`
  on timeout (F10). Port from `ITERATOR_PORT`, default 8888, bind `127.0.0.1`.
- **`lib/ui.mjs`** — the shared page shell every step renders inside:
  - header: `iterator / <step>` logo + branch tag, theme toggle, **Cancel**,
    primary button (**Accept** ↔ **Send review** flip driven by a shared
    `hasChanges()` hook; `/iterator-implement`'s review adds **Accept and
    commit** as the no-comment primary);
  - shared CSS variables (existing dark/light palettes), `esc()`, `mdToHtml()`
    markdown renderer, cancel-on-unload beacon, `post()` submit helper,
    done-page.
  - Each step's `server.mjs` shrinks to: parse payload → provide a
    `buildContent(data)` body renderer + step-specific JS → call `serve()`.

This is what makes "each step has its own UI with the same base structure and
flow" true by construction rather than by copy-paste discipline.

### 3.9 Skill flows (deltas from current behavior)

- **`/iterator-plan`** — current lr-plan-features steps 1–3, but: writes
  `memory/plan.md` (+ `index.md`, `format.md`, `log.md` on first run) instead of
  `PLAN.md`. If legacy `PLAN.md`/`CHUNKS.md` exist, offer one-time migration into
  the bundle (AskUserQuestion). On plan acceptance, **auto-continue into
  `/iterator-chunk`** (same session, no re-invocation needed).
- **`/iterator-chunk`** — current steps 4–7: chunk analysis, chunk-plan UI
  (dependency graph SVG, snippets, drag files, Split/Merge round-trips), but
  writes one OKF file per chunk + regenerates `chunks/index.md` and the plan's
  `# Chunks` section. Also runnable standalone to re-chunk/adjust (preserve
  `status: done` chunks). Cycle detection stays in both UI and skill.
- **`/iterator-implement`** — current lr-implementer, with two changes:
  reads/writes the bundle instead of CHUNKS.md, and **the post-implementation
  review is the `/iterator-review` UI** (same renderer, scoped to the just-built
  chunk, primary button **Accept and commit**) instead of a separate bespoke
  implementation-review page. On accept: branch-safety (never commit to
  main/master), commit `chunk(<slug>): <summary>` including the chunk-file
  status flip (`status: done`, `done:` date, `timestamp`), regenerated indexes,
  and a `log.md` entry — then offer the next dependency-ready chunk.
- **`/iterator-review`** — standalone: AskUserQuestion to pick a chunk (pending
  first, dependency order, plus "All pending"), diff = open git changes
  (`git diff HEAD`, fallbacks as today), map hunks via `files` globs, UI shows
  chunk-grouped diff with per-chunk status + line comments. Outcomes are written
  into the chunk file: `reviewed:` date refreshed, notes appended under
  `# Review`, index + log regenerated. Review never sets `status: done` (that
  stays owned by implement).
- **`/iterator-test`** — gains a UI (fixes F6): after picking a chunk and
  detecting the test setup (current steps 1–3), it proposes a **test plan** in
  the shared UI (list of cases: happy path / edge / integration, each with a
  one-line rationale, per-case comment boxes). Accept → write test files, run
  them, and report results in the terminal as today. Send review → revise the
  test plan and re-open. Tests never change chunk status.

---

## 4. Suggestions adopted / for the user to veto

These are included in the work items below unless vetoed:

1. **`timestamp` instead of `last_updated`** — OKF already defines the field;
   inventing a synonym would make the bundle less interoperable (§3.3).
2. **`format.md` in the bundle** rather than schema prose in `index.md` (§3.4).
3. **`log.md` audit trail** — cheap, OKF-native, and answers "what happened
   since I last looked" across sessions (§3.7).
4. **Commit trailer `Chunk: <slug>`** on implement commits, in addition to the
   `chunk(<slug>):` subject — lets future tooling (and `/iterator-review`) find
   all commits for a chunk mechanically.
5. **Review history kept in the chunk file** (`# Review` section) instead of
   overwriting a single notes field — feedback rounds stay visible.

Ideas deliberately **not** in scope (flagged for a future iteration):
- A `/iterator` dispatcher skill that inspects the bundle and suggests the next
  step (no plan → plan; plan w/o chunks → chunk; ready chunk → implement; …).
- `ITERATOR_MEMORY_DIR` is specced (§3.2) but consider defaulting to
  `.iterator/memory/` later if `memory/` collides with real projects.
- Chunk-scoped `git diff` via the `Chunk:` trailer (diff since chunk started,
  not just uncommitted changes).

---

## 5. Work items (implement in this order)

Each item is sized to be one reviewable change. Dependencies are strict.

### W1 — `rename-and-manifest`
- **depends_on:** none
- **files:** `.claude-plugin/plugin.json` (new), `package.json`, `skills/*` (rename dirs), `.gitignore` (new)
- Rename skill dirs per §3.1 (`iterator-plan`, `iterator-chunk` split comes in W4/W5 — for now rename `lr-plan-features` → `iterator-plan`, `lr-implementer` → `iterator-implement`, `lr-review` → `iterator-review`, `lr-test-features` → `iterator-test`), update each SKILL.md `name:` + all `lr-` cross-references, `LOCAL_REVIEW_PORT` → `ITERATOR_PORT`, all `local-review` strings in servers.
- Add `.claude-plugin/plugin.json` manifest (name `iterator`, version, description; skills auto-discovered — F1). Fix `package.json` (name `iterator`, correct script paths — F3). Add `.gitignore` (`node_modules/`, `.DS_Store`).
- Delete stale artifacts: `test.md`, `PLAN-features.md`, root `PLAN.md`, root `CHUNKS.md`, `skills/*/templates/feature-*.md` (F7).
- **accept:** `grep -ri "local-review\|lr-\|LOCAL_REVIEW" --exclude=ITERATOR_REVIEW.md` returns nothing; `claude plugins install .` succeeds; npm scripts run.

### W2 — `shared-ui-lib`
- **depends_on:** W1
- **files:** `lib/server.mjs` (new), `lib/ui.mjs` (new), all `skills/*/server.mjs`
- Extract the shell per §3.8 with fixes F8/F9/F10 baked in. Port all three
  existing servers onto it; behavior parity otherwise (same payloads in/out).
- **accept:** each `skills/*/server.mjs` contains only step-specific rendering;
  piping the `package.json` sample payloads opens working UIs; a payload
  containing `</script>` renders; starting two servers concurrently works (second
  picks next port and prints its URL); killing neither emits malformed output.

### W3 — `okf-memory-format`
- **depends_on:** W1
- **files:** `templates/format.md` (new, plugin root), `ARCHITECTURE.md` (rewrite)
- Author `format.md` from §3.3–§3.7 (field tables + one full example chunk +
  plan/index/log formats). Rewrite `ARCHITECTURE.md`: iterator naming, five-skill
  flow, `memory/` bundle spec, shared-UI-shell design, OKF conformance notes.
- **accept:** `format.md` alone is sufficient to hand-author a valid bundle;
  ARCHITECTURE.md contains no references to `PLAN.md`/`CHUNKS.md` state files.

### W4 — `plan-skill`
- **depends_on:** W2, W3
- **files:** `skills/iterator-plan/SKILL.md` (rewrite), `skills/iterator-plan/server.mjs` (plan-review renderer only)
- Per §3.9: bundle creation (`index.md` + `format.md` + `log.md` + `plan.md`),
  legacy-file migration offer, plan-review UI on the shared shell, plan
  approval sets `status: approved` and auto-continues into chunking (W5's flow;
  until W5 lands, end by telling the user to run `/iterator-chunk`).
- **accept:** running the skill in a fresh repo produces an OKF-conformant
  `memory/` (checkable against `format.md`); re-running offers use/replace.

### W5 — `chunk-skill`
- **depends_on:** W4
- **files:** `skills/iterator-chunk/SKILL.md` (new, extracted from old steps 4–7), `skills/iterator-chunk/server.mjs` (chunk-plan renderer: graph, cards, split/merge)
- Per §3.9: one OKF file per chunk, slug rules, `chunks/index.md` + plan
  `# Chunks` regeneration, split/merge round-trips rewrite chunk *files*
  (create/delete/rewire `depends_on`), UI rename = file rename + reference
  rewrite, cycle detection, preserve done chunks on re-chunk. Wire W4's
  auto-continue.
- **accept:** end-to-end plan→chunks produces N chunk files + regenerated
  indexes + log entries; a merge removes merged files and rewires all
  `depends_on`; cycles are flagged in UI and block acceptance.

### W6 — `implement-skill`
- **depends_on:** W5
- **files:** `skills/iterator-implement/SKILL.md` (rewrite), delete `skills/iterator-implement/server.mjs` (uses the review renderer), `skills/iterator-review/server.mjs` (accept-and-commit mode flag)
- Per §3.9: readiness = all `depends_on` chunks `status: done`; cycle/stuck
  report; implement from chunk file + ARCHITECTURE.md + optional GUIDELINES.md;
  auto-start the review UI scoped to the chunk with **Accept and commit**
  primary; on accept: branch safety, commit `chunk(<slug>): <summary>` with
  `Chunk: <slug>` trailer including status flip + index + log updates; loop
  offer.
- **accept:** dependency order is enforced (attempting a blocked chunk names the
  missing dependency); accept produces exactly one commit containing code +
  chunk-file status flip + regenerated indexes + log entry; feedback round-trips
  without committing.

### W7 — `review-skill`
- **depends_on:** W5
- **files:** `skills/iterator-review/SKILL.md` (rewrite), `skills/iterator-review/server.mjs`
- Per §3.9: chunk picker, hunk mapping via `files` globs (first match wins,
  rest → Uncategorized), outcomes appended to `# Review` + `reviewed:` date +
  `timestamp`, index/log regeneration, progress report. Never sets `done`.
- **accept:** a review round-trip updates only the reviewed chunk's file + the
  two generated files (`chunks/index.md`, `log.md`); a second review appends
  (not overwrites) history.

### W8 — `test-skill`
- **depends_on:** W5 (UI shell from W2)
- **files:** `skills/iterator-test/SKILL.md` (rewrite), `skills/iterator-test/server.mjs` (new: test-plan renderer)
- Per §3.9: keep the existing runner-detection and test-writing rules; add the
  test-plan UI round (propose cases → comment/accept → write + run + report).
  No chunk status changes; add a `log.md` entry (`**Tests**: …`).
- **accept:** the skill shows the proposed cases in the browser before writing
  any file; generated tests follow the detected convention and are actually run.

### W9 — `docs-and-cleanup`
- **depends_on:** W6, W7, W8
- **files:** `README.md` (rewrite), `CONTRIBUTING.md` (update), `OKF_SPEC.md` → `docs/OKF_SPEC.md`
- README: iterator identity, the five-skill flow diagram, `memory/` bundle
  explanation (with a rendered example chunk), install instructions, port
  config (`ITERATOR_PORT`), sizing table. CONTRIBUTING: new paths, updated
  sample payloads matching the real schemas. Move the OKF spec under `docs/`
  and link it from README/ARCHITECTURE (fixes F2 fully).
- **accept:** every command, path, filename and env var mentioned in the docs
  exists and works as described; a new user can go install → plan → chunk →
  implement → review from README alone.

---

## 6. Acceptance criteria for the whole effort

1. Plugin installs and all five `/iterator-*` skills appear.
2. Full happy path works end-to-end in a scratch repo: plan → auto-chunk →
   implement (auto-review, accept-and-commit) → standalone review → test.
3. `memory/` passes OKF v0.1 conformance (§9 of the spec) at every step of that
   path.
4. Every UI is visually and behaviorally consistent: same header, same
   Accept/Cancel/Send-review logic, cancel-on-close, theme toggle.
5. No references to the old naming or old file model anywhere outside this file
   and git history.
