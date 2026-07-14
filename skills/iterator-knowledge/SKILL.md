---
name: iterator-knowledge
description: Use when the user types /iterator-knowledge or wants the Knowledge view — the bundle's OKF memory plane (knowledge areas, concept browser, staleness, memorize status) with action callbacks to the coding agent.
---

<!-- markdownlint-disable MD013 -->

# iterator-knowledge

Open the Knowledge view: a browser dashboard over the `memory/` bundle's
knowledge side — the five OKF areas, every concept with per-concept stale
flags, the `last_memorized_commit` pointer and unmemorized-commit count, the
design.md card, and a free-text "ask the agent" box. Plans and features are
**not** shown here — they live on the Work side (`/iterator` hub); this view
never authors plan or feature files.

Preconditions and pi mode: see `<skill-dir>/PROTOCOL.md` (this flow uses
`iterator_ui { step: "knowledge" }` in pi).

## Open the dashboard

One command — do **not** read bundle files or run git yourself:

```bash
echo '{"gather":true,"step":"knowledge"}' | node <skill-dir>/../iterator/server.mjs
```

A missing bundle yields `memory.initialized: false` with the standard areas.
Read exactly one JSON line from stdout and react to it.

## React to dashboard actions

The server returns `{ "type": "action", "action": "...", "target": "...",
"prompt": "...", "skill": "<owner>" }` — `skill` names the flow that owns the
action (`iterator-init` / `iterator-consolidate` / `iterator-memorize` run those skills'
workflows; `iterator-design` runs `/iterator-design`). Actions owned by this
skill (`skill: "iterator-knowledge"`):

- `refresh-format`: mechanical — pipe `{ "op": "refresh-format" }` into
  `node <skill-dir>/../iterator/write.mjs` (copies the current template over
  `memory/format.md` and logs it), then report.
- `draft-memory`: research the target (an area name like `pitfalls`, or a
  concept id like `patterns/error-handling` to write a related concept),
  draft a memory card, and send it through the `/iterator-memorize`-style review
  (mode `memorize`, no `headCommit`) before anything is written.
- `draft-memory-prompt`: use `prompt` as the user's requested memory topic,
  research the repo, draft the appropriate area memory, and send it through
  review before writing.
- `update-memory`: `target` is the concept id shown on the card. Read that
  concept file, use `prompt` as the user's requested change (if empty, ask
  what change they want), draft an `action: "update"` card with
  `existingBody`, and send it through review. Never mutate memory directly
  from browser state.
- `close`: report that no action was selected.

For `cancel` / `timeout`, write nothing — relay the result's `report`.

All memory writes go through the deterministic writer (the review server's
`apply: true` path, or `write.mjs` op `apply-review`) — never hand-author
frontmatter, indexes, the log, or the pointer (see PROTOCOL.md).
