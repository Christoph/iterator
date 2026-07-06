---
name: okf
description: Use when the user types /okf or wants the Knowledge view — the bundle's okf memory plane (knowledge areas, concept browser, staleness, memorize status) with action callbacks to the coding agent.
---

<!-- markdownlint-disable MD013 -->

# okf

Open the Knowledge view: a browser dashboard over the `memory/` bundle's
knowledge side — the five okf areas (`architecture/`, `decisions/`,
`patterns/`, `pitfalls/`, `setup/`), every concept with per-concept stale
flags, the `last_memorized_commit` pointer and unmemorized-commit count, the
design.md card, and a free-text "ask the agent" box.

Plans and chunks are **not** shown here — they live on the Work side
(`/iterator` hub, `/iterator-plan`, `/iterator-chunk`). This view never
authors plan or chunk files.

## Preconditions

1. The shared scripts must exist at `<skill-dir>/../iterator/gather.mjs` and
   `<skill-dir>/../iterator/server.mjs`. If not, stop with: `Install the full
   iterator plugin; /okf uses the iterator hub's gather/server scripts.`
2. Do not mutate `memory/` while the browser dashboard is open. The dashboard
   only returns an action request; the agent performs changes after the
   server exits.

**pi mode:** if the tools `iterator_gather` / `iterator_ui` are available,
use `iterator_ui { step: "knowledge" }` instead of the shell pipeline below —
the view renders in the session dashboard's Knowledge tab. Actions the user
clicks while the agent is idle dispatch automatically; you only handle the
action names below when a round returns one.

## Open the dashboard

Gathering state is mechanical and fully scripted — do **not** read bundle
files or run git yourself to assemble the payload:

```bash
node <skill-dir>/../iterator/gather.mjs --step knowledge \
  | node <skill-dir>/../iterator/server.mjs
```

The payload carries `memory` (initialized, okf_version,
`last_memorized_commit`, concept/stale/unmemorized counts), `areas[]` with
counts, `memories[]` (one entry per knowledge concept, each with `files:`
anchors and a `stale` flag), `design` (the design.md card, when captured),
and `formatStale` (memory/format.md drifted from the current template).
A missing bundle yields `memory.initialized: false` with the standard areas.

Read exactly one JSON line from the server's stdout and react to it.

## React to dashboard actions

The server returns `{ "type": "action", "action": "...", "target": "...", "prompt": "..." }`.

- `okf-init`: run the `/okf-init` workflow.
- `okf-consolidate`: run the `/okf-consolidate` workflow.
- `okf-memorize`: run the `/okf-memorize` workflow.
- `design`: run the `/iterator-design` workflow (design.md is Work-side owned).
- `refresh-format`: mechanical — pipe `{ "op": "refresh-format" }` into
  `node <skill-dir>/../iterator/write.mjs` (copies the current
  `templates/format.md` over `memory/format.md` and logs it), then report.
- `draft-memory`: research the target (an area name like `pitfalls`, or a
  concept id like `patterns/error-handling` to write a related concept),
  draft a memory card, and send it through the `/okf-memorize`-style review
  (mode `memorize`, no `headCommit`) before anything is written.
- `draft-memory-prompt`: use `prompt` as the user's requested memory topic,
  research the repo, draft the appropriate area memory, and send it through
  review before writing.
- `update-memory`: `target` is the concept id shown on the card. Read that
  concept file, use `prompt` as the user's requested change (if `prompt` is
  empty, ask what change they want), draft an `action: "update"` card with
  `existingBody`, and send it through review. Never mutate memory directly
  from browser state.
- `close`: report that no action was selected.

For `cancel` / `timeout`, write nothing and explicitly report that the
dashboard was cancelled/timed out.

All memory writes go through the deterministic writer
(`<skill-dir>/../iterator/write.mjs`, op `apply-review` — or the review
server's `apply: true` path): it writes the concept files, regenerates area
indexes and the root index (preserving all foreign content, including the
Work side's plan/chunk links), appends `memory/log.md`, and validates the
bundle. Never hand-author frontmatter, indexes, the log, or the pointer.
