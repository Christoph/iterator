# iterator — working in this repo

Iterate on code in small, reviewable, dependency-ordered **features** (the
term replaced "chunk" everywhere — never reintroduce chunk naming), with
durable state in the OKF `memory/` bundle. This repo dogfoods its own flow:
the active plan lives at `memory/plan.md` with one file per feature under
`memory/features/`.

## Use the knowledge automatically

Before changing code:

1. Read `memory/plan.md` and `memory/features/index.md` — if the work matches
   a planned feature, do it as that feature (don't ad-hoc edit).
2. Read the knowledge concepts whose `files:` anchors match the files you are
   about to touch — decisions first, then architecture/patterns/pitfalls/setup
   (`memory/decisions/`, `memory/architecture/`, `memory/patterns/`,
   `memory/pitfalls/`, `memory/setup/`). New work must not silently contradict
   a recorded decision.
3. UI work follows `memory/design.md` (saved design parameters) — usability
   fixes stay within them; it is never a license to redesign.

## Save new knowledge

When you learn a durable fact — a decision made with the user, a pattern, a
sharp edge, a setup step — record it in the bundle instead of leaving it in
the conversation: use the `/iterator-knowledge` skill (draft-memory flow) or
propose the concept file for review. After commits land, `/iterator-memorize`
folds them into memory; `/iterator-consolidate` repairs stale anchors.

## Drive the flow through the skills

The plugin's skills own the workflow — `/iterator` (dashboard hub),
`/iterator-plan`, `/iterator-feature`, `/iterator-test` (red tests),
`/iterator-implement`, `/iterator-review`, and the knowledge side
(`/iterator-init`, `/iterator-knowledge`, `/iterator-consolidate`,
`/iterator-memorize`). Keep feature statuses, tests, and logs current so the
plan files always show where everything stands.

## Bundle writes are deterministic — never by hand

`memory/` generated/machine files (`features/*.md` frontmatter, `index.md`,
`log.md`, `state.md`, `usage.md`, `settings.md`, the plan `# Features`
section) are owned by the writer. Pipe ops to `skills/iterator/write.mjs`
(`--schema` lists ops, `--schema <op>` shows a payload) instead of editing
them directly; semantic prose in feature bodies is yours to write.

## State is server-derived — views only render

Status rules live once, in `lib/status.mjs` (feature transition table,
dependency readiness, derived plan `stage`). Gather payloads ship the derived
state (`ready`, `waitingOn`, `stage`); views and skills must never re-derive
it from raw statuses. The dashboard splits into Planning (backlog, plan
lifecycle, dependency graph) and Work (test/implement/review) surfaces, both
rendered from the same gather payload.

## Claude Code feature flow

Claude Code runs the same published `/iterator-*` skills as Pi, but has no
persistent Iterator dashboard. Treat an explicit `/iterator-*` invocation as
permission to run that skill's deterministic gather/write commands. Read the
skill's `SKILL.md` before acting, gather its step payload, and use the returned
feature contract and derived readiness rather than reading bundle state or
choosing work yourself.

Work exactly one ready feature per round. `/iterator-implement` may create the
feature commit through `commit-feature`, leaving the feature `implemented`.
Do not call `accept-commit` or flip it to `done` until the user explicitly
accepts a `/iterator-review` result. In Claude Code, present review findings
in chat instead of opening the Pi-only dashboard; preserve the same
user-controlled acceptance gate.

## Development loop

- Source of truth is repo-root `lib/`; run `npm run sync` after editing it
  (skills ship synced copies; `test/sync.test.mjs` fails on drift).
- `npm test` runs the suite (`node --test`, 60s per-test timeout).
- The user reviews and commits themselves: never commit, branch, or flip a
  feature to `done` (accept-commit owns that) unless explicitly asked.
