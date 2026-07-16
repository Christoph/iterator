---
name: iterator-consolidate
description: Use when the user types /iterator-consolidate or wants to review, update, merge, prune, or stale-check the OKF knowledge areas of an existing memory/ bundle.
---

<!-- markdownlint-disable MD013 -->

# iterator-consolidate

Update, merge, and prune the knowledge concepts of an existing `memory/`
bundle. Plans and features are out of scope — this flow never touches the Work
side.

Shared preconditions, review pipeline, React/Finish rules, card schema, and
pi mode: `<skill-dir>/../iterator-knowledge/PROTOCOL.md`. Specific to this flow:
`memory/index.md` must exist — if not, stop and suggest `/iterator-init`.

## Load the existing bundle

Scripted — do **not** walk memory/ yourself:

```bash
node <skill-dir>/../iterator/gather.mjs --step knowledge
```

`memories[]` lists every knowledge concept with `files:` anchors and a
`stale` flag (an anchor pointing at an untracked path). Then read the actual
concept files you plan to propose changes for — the review cards need their
current bodies.

Follow the payload's `advice` sentence — it is the proceed/stop signal. The
only no-op outcomes are the ones it names (no bundle, zero concepts). In every
other case the review round **always** opens, even when nothing looks stale:
never conclude "the knowledge base looks healthy, nothing to do" from the
inventory alone. An all-`keep` payload is still a valid round — it shows the
user the current state and lets them prune.

## Staleness scan

Beyond the gathered `stale` flags (frontmatter `files:` vs `git ls-files`),
scan concept bodies for inline repo-looking paths that no longer exist. Mark
stale memories with `stale: true` and clear `staleReasons` such as
`Referenced file src/old.ts no longer exists`.

## Draft the review payload

- Propose `action: "update"` for memories that are stale or clearly outdated.
- Propose `action: "delete"` for memories that no longer apply.
- Include all other memories as `action: "keep"` so the user can still delete
  them.
- Include `existingBody` for every `update`, `delete`, and `keep` card.

## Review

Run the PROTOCOL.md review round with `mode: "consolidate"`. Do **not**
include `headCommit` — consolidation never moves `last_memorized_commit`.
React and finish per PROTOCOL.md; additionally report any stale memories that
remain.
