---
type: Reference
title: iterator memory format
description: Metadata schema for this iterator memory/ bundle (plan, features, indexes, log).
timestamp: 2026-07-02T00:00:00Z
---

# iterator memory format

This bundle is a conformant **OKF v0.1** knowledge bundle (a directory of
markdown files with YAML frontmatter — see `docs/OKF_SPEC.md` in the iterator
plugin). It is written and maintained by the `/iterator-*` skills and is
readable and hand-editable without any tooling. This document is copied
verbatim into every bundle so the bundle stays self-describing even when moved
out of its repository.

## Layout

```
memory/
├── index.md          # bundle root index; carries okf_version frontmatter (OKF §11)
├── format.md         # this file — type: Reference — the metadata schema
├── plan.md           # type: Plan — the plan concept
├── design.md         # optional — type: Design — the project's design parameters
├── settings.md       # optional — type: Settings — project settings (writer op `settings`)
├── state.md          # optional — type: State — machine runtime flow state (op `state`)
├── usage.md          # optional — type: Usage — per-plan token ledger (op `usage`)
├── log.md            # OKF §7 update log; skills append entries
└── features/
    ├── index.md      # feature listing with status, for progressive disclosure
    ├── archive/      # retired plans: <created>-<slug>/ with plan.md + features + usage.md
    └── <slug>.md     # type: Feature — one concept per feature
```

Rules:

- The bundle lives in `memory/` at the git root (override with the
  `ITERATOR_MEMORY_DIR` env var; always resolved relative to the git root).
- Every non-reserved `.md` file has parseable YAML frontmatter with a non-empty
  `type` (OKF §9). `index.md` / `log.md` are reserved (OKF §6/§7).
- Cross-references between documents use **bundle-absolute** links beginning
  with `/`, e.g. `/features/auth-middleware.md` (OKF §5.1).
- Skills regenerate the `index.md` files after any change. Consumers must
  tolerate a stale index (OKF permissive-consumption model).

---

## Feature documents — `features/<slug>.md`

The **slug** (the kebab-case filename without `.md`) is the feature's identity:
it is the OKF concept ID (`features/<slug>`), the value used in `depends_on`, and
the name used in commit messages. Renaming a feature means renaming the file and
rewriting every `depends_on` reference to it.

```markdown
---
type: Feature                             # REQUIRED (OKF type)
title: Auth middleware                  # display name
description: JWT-based auth middleware for all protected routes.  # one line
status: pending                         # draft | pending | implemented | done
size: small                             # small | medium | large — how big the feature feels
depends_on: [config-module]             # feature slugs; [] if none
files: ["src/auth.ts", "src/middleware/*.ts"]   # paths/globs this feature owns
timestamp: 2026-07-02T10:00:00Z         # OKF "timestamp": last meaningful change
done: 2026-07-02                        # present only once implemented & committed
reviewed: 2026-07-02                    # present only after a review pass
tests: ["test/auth.test.mjs"]           # test files owned by this feature (written by /iterator-test)
tests_status: red                       # none | red | green (absent means none)
commits:                                # commits recorded for this feature (kind: test | implement)
  - sha: a1b2c3d
    kind: test
    date: 2026-07-02
tags: []                                # optional
---

# Implementation notes

How to build it: approach, constraints, gotchas. Written by /iterator-feature,
consumed by /iterator-implement.

# Snippets

Illustrative code (interfaces, key functions, call sites) — never full
implementations.

```ts
export function requireAuth(req, res, next) { /* … */ }
```

# Depends on

* [Config module](/features/config-module.md) — needs the JWT secret from config.

# Blast radius

What breaks if this feature is wrong; which other features/files feel it.

# Review

## 2026-07-02
* **Approved** — after 1 feedback round: renamed `verify()` to `verifyToken()`.
```

### Feature field semantics

| Field | Required | Meaning / rules |
|---|---|---|
| `type` | yes | Always `Feature`. OKF consumers route on this. |
| `title` | yes | Human display name. |
| `description` | yes | One sentence; copied into `features/index.md` entries. |
| `status` | yes | `draft`, `pending`, `implemented`, or `done`. `/iterator-feature` writes proposals as `draft`; accepting the feature set in the UI promotes every draft to `pending`. Drafts are never implementable/testable. `implemented` = code complete, awaiting review — set by the implement flow (update-feature) when the implementation finishes; it enables Review and disables Implement. Only the accept flow sets `done` (on Accept-and-commit). With the `review_required` setting on (default), dependents wait for `done`; off lets `implemented` dependencies satisfy them. |
| `size` | yes | `small` \| `medium` \| `large` — a judgment call on how big the **feature** feels, not a line count. A feature is one user-visible capability (a vertical slice incl. its tests); `large` means "probably two features" and gets a ⚠️ in the UIs — prefer splitting. Reviewability is enforced against the *actual* diff at review time. |
| `depends_on` | yes (may be `[]`) | Feature slugs that must be `done` before this feature is implemented. Must be acyclic and reference existing files. This is the **canonical** dependency data; the `# Depends on` body section mirrors it with optional "why" prose. |
| `files` | yes | Paths or simple globs the feature owns — **including its test files** (a feature's tests are reviewed together with its logic, never separately). `/iterator-review` maps diff hunks to a feature through these (first matching feature wins), with the feature's `tests` entries as an exact-match fallback. |
| `timestamp` | yes | ISO 8601 "last meaningful change" (OKF's field — iterator uses it instead of inventing `last_updated`). Every skill that edits the file updates it. |
| `done`, `reviewed` | when applicable | ISO dates. `reviewed` is set/refreshed by `/iterator-review`; review notes are appended to the `# Review` body section (newest first). |
| `tests` | no | Test file paths owned by this feature. Written by `/iterator-test`; consumed by `/iterator-implement` as the implementation goal, and by `/iterator-review` to group the test diff with the feature's logic. |
| `tests_status` | no | `none` \| `red` \| `green` (absent = `none`). `red` = tests exist and fail — the *expected* state before implementation (red/green flow). `/iterator-test` sets `red` or `green`; `/iterator-implement` flips `red → green` on Accept-and-commit. Independent of `status`: an implemented-but-red feature is `status: done`, `tests_status: red`. |
| `commits` | no | List of `{ sha, kind, date }`, `kind: test \| implement`. Recorded shas are an **optimization** — they go stale when the branch is rebased or amended. The resilient lookup is the `Feature: <slug>` commit trailer: consumers must fall back to `git log --grep '^Feature: <slug>'`. A commit cannot contain its own sha, so each sha is recorded in the *next* bundle write after committing. |
| `memories` | no | Writer-computed at feature time: the knowledge concept ids (`<area>/<slug>`) whose `files:` anchors match this feature's `files` — the implementer's reading list. Never hand-authored. |
| `conflicts` | no | JSON scalar `[{"decision","note"}]` — decision concepts this feature contradicts, flagged by the slicing model; rendered as a red badge and mirrored readably in the `# Decision conflicts` body section. Escalates instead of implementing in auto mode. |

Body sections `# Implementation notes`, `# Snippets`, `# Depends on`,
`# Blast radius` are written at feature-creation time; `# Decision conflicts`
mirrors the `conflicts` frontmatter; `# Review` is appended by review passes
(agent reviews carry an `_(agent review: <model>)_` tag). All are optional
except `# Implementation notes`.

---

## Plan document — `plan.md`

```markdown
---
type: Plan
title: Add JWT authentication
description: JWT-based auth for all protected API routes.
status: draft                           # draft | approved
branch: iterator/add-jwt-authentication # where the work happens (branch-per-plan)
worktree: ../repo-iterator-add-jwt-authentication  # present only in worktree-per-plan mode
plan_reviewed: 2026-07-04               # present only after the whole-plan review (record-plan-review)
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

# Features

* [Config module](/features/config-module.md) - Centralize env/config access
* [Auth middleware](/features/auth-middleware.md) - JWT middleware for protected routes
```

`status: approved` is set when the user accepts the plan in the UI. On
approval from `main`/`master` (settings `branch_per_plan: on`) the writer
creates `iterator/<plan-slug>` — in a separate git **worktree** by default
(`worktree_per_plan: on`; the frontmatter records both). When a worktree is
recorded, **all iterator work happens inside it** — gathers and writes
re-root themselves to the worktree, so implementation, review, and commits
land there no matter where the session sits (this is what enables running
plans in parallel later). `plan_reviewed` is set by the `record-plan-review`
op after `/iterator-review-plan` checks the finished work against the plan;
the review report is appended to the body as `# Plan review` sections. The
`# Dependencies` section lists **only new external packages/libraries/
services** the plan requires (`` `name` — why ``), never todos or work
items. `# Architecture` and `# Key decisions` are written as markdown
bullet lists (one statement per bullet) built on the bundle's architecture
memories. The `# Features` section is (re)generated by `/iterator-feature` and
links every feature so OKF graph consumers see plan → feature edges.

---

## Design document — `design.md` (optional)

The project's design parameters, captured once by `/iterator-design` (derived
from the plan and codebase, confirmed with the user) and reused on every feature
that touches UI so the project's interfaces stay consistent. Written only via
the writer's `design` op; the body prose is hand-editable like feature bodies.
Optional — bundles created before it existed are fine without it (OKF
permissive consumption).

```markdown
---
type: Design
title: <project> design parameters
description: One-line summary of the visual direction.
register: product            # brand (expressive) | product (quiet, utilitarian)
created: 2026-07-06          # first capture date; preserved on re-runs
timestamp: 2026-07-06T12:00:00Z
---

# Direction

Aesthetic direction, tone, signature element, what to avoid.

# Typography

Families (display/body/mono), scale ratio, weights.

# Color

Palette (OKLCH/hex values), accent, neutral tint, dark-mode notes.

# Spacing

Base unit, scale steps, radii, section rhythm, and named small/medium/large
margin and padding constants (e.g. space-sm: 8px · space-md: 16px ·
space-lg: 32px).

# Elements

Per-component styles — button, input, card, badge — each with concrete
background, border, radius, padding, hover values.

# Responsive

Breakpoints, fluid-type clamp() ranges, touch rules.

# Signature

(optional) The one distinctive recurring element.
```

`# Direction`, `# Typography`, `# Color`, `# Spacing`, `# Elements` are
required; `# Responsive` and `# Signature` are optional. Sections hold **concrete
values** (font stacks, color values, pixel scales) so a later session can
reproduce the look from this file alone. When present, the root `index.md`
links it as `* [Design](design.md) - <description>`.

---

## Runtime documents — `settings.md`, `state.md`, `usage.md` (optional)

Three writer-owned root documents; **never hand-edited** (the guardrails
warn) — they are written exclusively by the `settings` / `state` / `usage`
ops and read by every gather:

- **`settings.md`** (`type: Settings`) — project configuration as flat
  frontmatter keys (auto mode, per-role models and thinking levels, testing
  default, branch/worktree per plan, commit-leftover blocking, memorize
  nudge, usage ledger). `write.mjs --schema settings` lists every key with
  its enum/default; missing keys mean defaults. Edited via the settings UI
  (gear icon / `/iterator-settings`).
- **`state.md`** (`type: State`) — the machine's runtime flow state: `mode`
  (`manual|auto`), `paused`, `phase`
  (`idle|slicing|testing|implementing|reviewing|escalated|done`),
  `active_feature`, `strikes` (a JSON scalar mapping feature slugs to their
  needs-work review counts), and `escalation` (a JSON scalar
  `{feature, reason, at}` or `null` — why auto mode stopped; rendered as the
  dashboard's attention banner with its recovery actions). This is what makes
  Pause/Continue and auto-mode resume possible across sessions.
- **`usage.md`** (`type: Usage`) — the active plan's token ledger:
  `totals` (JSON scalar; per-step × per-model input/output/cache-read/
  cache-write/turns plus per-feature rollups) with a regenerated
  human-readable table as the body. On plan retirement it moves into the
  plan's `features/archive/<created>-<slug>/` directory and its grand total is
  recorded in the retirement decision concept.

---

## Index files

`memory/index.md` — the bundle root; the only index permitted frontmatter
(OKF §11), carrying `okf_version`:

```markdown
---
okf_version: "0.1"
---

# iterator memory

* [Plan](plan.md) - JWT-based auth for all protected API routes.
* [Format](format.md) - Metadata schema for this bundle.
* [Features](features/) - One document per implementation feature.
* [Log](log.md) - Chronological history of plan/feature/implement/review events.
```

The bundle may be shared with other OKF tools (okf-memory adds knowledge
areas like `architecture/` and a `last_memorized_commit` frontmatter key
here). iterator's writer *merges* its link lines into this file — it never
removes foreign frontmatter keys, headings, prose, or area links.

`memory/features/index.md` — no frontmatter; status is folded into the
description text (which OKF permits). Ordering is dependency order
(topological, ties broken by creation order):

```markdown
# Features

* [Config module](config-module.md) - ✅ done · 🟢 tests green · small · Centralize env/config access
* [Auth middleware](auth-middleware.md) - ⬜ pending · 🔴 tests red · small · depends: config-module · JWT middleware
* [API routes](api-routes.md) - ⬜ pending · medium · depends: auth-middleware · REST routes
```

The test badge (`🔴 tests red` / `🟢 tests green`) sits between the status and
the size and is **omitted** when `tests_status` is `none`/absent (see
`api-routes` above). Unaccepted feature proposals show `📝 draft` in place of
`⬜ pending`.

Every skill that changes feature status or metadata regenerates
`features/index.md`. Skills stay context-efficient by reading `features/index.md`
first, then opening only the feature file(s) they need.

---

## Log — `log.md`

OKF §7 format, newest first. Each skill appends one entry per meaningful event
(plan approval, feature creation, implementation commit, review, tests):

```markdown
# iterator update log

## 2026-07-02
* **Review**: Approved [Auth middleware](/features/auth-middleware.md) after 1 feedback round.
* **Implementation**: Committed feature(auth-middleware) on branch feature/auth.
* **Creation**: Plan approved; created 3 features.
```

This is the cross-session audit trail — "what did the AI do while I was gone".

---

## Full example feature

```markdown
---
type: Feature
title: Config module
description: Centralize environment/config access behind a typed accessor.
status: done
size: small
depends_on: []
files: ["src/config.ts"]
timestamp: 2026-07-02T09:40:00Z
done: 2026-07-02
reviewed: 2026-07-02
tests: ["test/config.test.ts"]
tests_status: green
commits:
  - sha: 9f8e7d6
    kind: test
    date: 2026-07-02
  - sha: 5c4b3a2
    kind: implement
    date: 2026-07-02
tags: [foundation]
---

# Implementation notes

Read and validate every required env var once at startup; export a frozen
`config` object. Throw a clear error listing all missing vars rather than
failing lazily at first use.

# Snippets

```ts
export interface Config { jwtSecret: string; port: number; }
export const config: Config = loadConfig();
```

# Blast radius

Every module that reads `process.env` directly should route through here; a
wrong default (e.g. an empty `jwtSecret`) silently weakens auth downstream.

# Review

## 2026-07-02
* **Approved** — no changes requested.
```
