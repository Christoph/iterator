---
name: okf-consolidate
description: Use when the user types /okf-consolidate or wants to review, update, merge, prune, or stale-check the okf knowledge areas of an existing memory/ bundle.
---

<!-- markdownlint-disable MD013 -->

# okf-consolidate

Update, merge, and prune the knowledge concepts of an existing `memory/`
bundle. Plans and chunks are out of scope — this flow never touches the Work
side.

## Preconditions

1. `memory/index.md` must exist. If it does not, stop and suggest `/okf-init`.
2. The shared scripts must exist at `<skill-dir>/../iterator/gather.mjs`,
   `server.mjs`, and `write.mjs`. If not, stop with: `Install the full
   iterator plugin; okf-consolidate uses the iterator hub's scripts.`
3. Do not write `memory/` while the browser review is open.

**pi mode:** if the tools `iterator_gather` / `iterator_ui` / `okf_write` are
available, use `iterator_gather { step: "knowledge" }` for the concept
inventory (incl. per-concept `stale` flags),
`iterator_ui { step: "memory-review", extra: { mode: "consolidate", memories: [...] } }`
for the review round, and `okf_write { mode: "consolidate", memories, decisions }`
to apply. Steps and card rules are unchanged.

## Load the existing bundle

Scripted — do **not** walk memory/ yourself:

```bash
node <skill-dir>/../iterator/gather.mjs --step knowledge
```

`memories[]` lists every knowledge concept with `files:` anchors and a
`stale` flag (an anchor pointing at an untracked path). Then read the actual
concept files you plan to propose changes for — the review cards need their
current bodies.

## Staleness scan

Beyond the gathered `stale` flags (frontmatter `files:` vs `git ls-files`),
scan concept bodies for inline repo-looking paths that no longer exist. Mark
stale memories with `stale: true` and clear `staleReasons` such as
`Referenced file src/old.ts no longer exists`.

## Draft review payload

Use `mode: "consolidate"`.

- Propose `action: "update"` for memories that are stale or clearly outdated.
- Propose `action: "delete"` for memories that no longer apply.
- Include all other memories as `action: "keep"` with `existingBody` so the
  user can still delete them.
- Include `existingBody` for every `update`, `delete`, and `keep` card.

Invoke the shared UI server with `apply: true` so an approval is applied by
the deterministic writer (`write.mjs`, op `apply-review`) before the result
reaches you — never hand-author memory files, indexes, or the log:

```bash
node <skill-dir>/../iterator/server.mjs <<'OKF_PAYLOAD'
{ "step": "memory-review", "mode": "consolidate", "apply": true, "project": "<git root>", "round": 1, "areas": [], "memories": [] }
OKF_PAYLOAD
```

Do **not** include `headCommit` — consolidation never moves
`last_memorized_commit`.

## React

- `review-feedback`: revise commented drafts plus the general note, increment
  `round`, and invoke the server again. Write nothing mid-loop.
- `cancel` / `timeout`: write nothing and explicitly report that
  consolidation was cancelled/timed out.
- `review-approved`: the verdicts are **already applied** — the result line
  carries `applied` with the writer's outcome (`written`, `deleted`, `kept`,
  `rejected`, `validation`). Verdict semantics, for reference: `accept`
  writes the proposed concept, `reject` discards the proposal, `keep` leaves
  the existing concept, `delete` removes it. The writer also regenerated the
  affected area indexes and `memory/index.md` links (preserving all foreign
  content, including the plan/chunk links), appended newest-first
  `memory/log.md` entries, and ran the bundle validator.

## Finish

Read `applied` from the result. If `applied.ok` is false (or
`applied.validation.ok` is false), show the error and fix it through another
review round — do not patch files by hand. Otherwise report
kept/updated/deleted/rejected counts and any stale memories that remain.
