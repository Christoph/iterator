# okf review protocol (shared by /okf-init, /okf-consolidate, /okf-memorize)

## Preconditions (every okf flow)

1. The shared scripts must exist at `<skill-dir>/../iterator/gather.mjs`,
   `server.mjs`, and `write.mjs`. If not, stop with: `Install the full
   iterator plugin; the okf skills use the iterator hub's scripts.`
2. Do not write `memory/` while the browser review is open. The UI only
   returns decisions; changes are applied after the server exits.

**pi mode:** see `<skill-dir>/../iterator/PI.md`. The okf skills use
`iterator_ui { step: "memory-review", extra: { mode, memories, ... } }` for
the review round and `okf_write { mode, headCommit?, memories, decisions }`
to apply it (the bash pipeline applies server-side via `apply: true`).

## The review round

Pipe a `step: "memory-review"` payload into
`node <skill-dir>/../iterator/server.mjs` with `apply: true` so an approval
is applied by the deterministic writer (`write.mjs`, op `apply-review`)
before the result reaches you — never hand-author memory files, indexes, the
log, or the pointer:

```bash
node <skill-dir>/../iterator/server.mjs <<'OKF_PAYLOAD'
{ "step": "memory-review", "mode": "<init|consolidate|memorize>",
  "apply": true, "project": "<git root>", "round": 1,
  "headCommit": "<sha, when the mode advances the pointer>",
  "areas": [], "memories": [] }
OKF_PAYLOAD
```

Read exactly one JSON line from stdout and react:

- `review-feedback`: revise the commented drafts plus the general note,
  increment `round`, and invoke the server again. Write nothing mid-loop.
- `cancel` / `timeout`: nothing was written and the pointer did not advance —
  relay the result's `report` and stop.
- `review-approved`: the verdicts are **already applied** — the result
  carries `applied` with the writer's outcome (`written`, `deleted`, `kept`,
  `rejected`, `advancedTo`, `validation`, and a one-line `summary`). Verdict
  semantics: `accept` writes the proposed concept, `reject` discards the
  proposal, `keep` leaves the existing concept, `delete` removes it. The
  writer also regenerated the affected area indexes and root-index links
  (preserving all foreign content, including the Work side's plan/chunk
  links), appended newest-first `memory/log.md` entries, and validated the
  bundle.

## Finish (after `review-approved`)

If `applied.ok` is false (or `applied.validation.ok` is false), show the
error and fix it through another review round — do not patch files by hand.
Otherwise report the outcome (`applied.summary` is a ready-made line).

## Card schema

Draft cards carry `action` (`create|update|delete|keep`), `id`
(`<area>/<slug>`) or `area` + `slug`, `type`, `title`, `description`,
optional `tags`/`files`, and `body`; `update`/`delete`/`keep` cards also
carry `existingBody`. The writer turns each accepted card into
`<area>/<slug>.md`:

```yaml
---
type: Pattern
title: Error handling
description: One sentence reused in indexes.
tags:
  - errors
timestamp: 2026-07-02T00:00:00.000Z
files:
  - src/lib/errors.ts
---
```

Areas and types: `architecture/` (Architecture — how the system is
structured), `decisions/` (Decision — why important choices were made;
also `status: accepted|superseded` and `date:`), `patterns/` (Pattern — how
code here is written), `pitfalls/` (Pitfall — known bugs and sharp edges),
`setup/` (Setup — build/test/run commands and key dependencies). Give every
create/update card `files:` anchors pointing at the code it describes —
anchors are what let the implement/review flows surface the memory next to
the right files later. Use bundle-absolute cross-links such as
`/patterns/error-handling.md` in bodies.
