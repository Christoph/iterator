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

`memories[]` lists every knowledge concept with its current `body`, `files:`
anchors, a `stale` flag (an anchor pointing at an untracked path), and the
features that store or freshly anchor-match it. `consolidation` carries the
feature-side evidence: raw stored/matched/candidate IDs per feature,
`overloadedFeatures` whose uncapped candidate set exceeds `memoryLimit`,
`danglingReferences` to concepts that no longer exist, and
`overlapCandidates` whose identical anchors warrant a semantic duplicate
check. These are review signals, not automatic verdicts — two concepts may
legitimately share anchors. The payload is your whole inventory; do not re-read
the concept or feature files.

Follow the payload's `advice` sentence — it is the proceed/stop signal. The
only no-op outcomes are the ones it names (no bundle, zero concepts). In every
other case the review round **always** opens, even when nothing looks stale:
never conclude "the knowledge base looks healthy, nothing to do" from the
inventory alone. An all-`keep` payload is still a valid round — it shows the
user the current state and lets them prune.

## Check the bundle's self-description

The bundle must stay usable by an agent with no iterator extension loaded, so
repair its two self-describing documents before reviewing concepts. The same
knowledge gather reports them:

- `formatMissing` / `formatStale` — `memory/format.md` (the metadata schema)
  is absent or has drifted from the current template.
- `contractMissing` / `contractStale` — `memory/EXTENSIONS.md` (the read/write
  contract: read order, machine-owned files, how to discover writer ops) is
  absent or predates the current contract rules.

Repair whichever is flagged — both writes are idempotent, and a stale copy is
overwritten with the current text (a project-specific preamble must be passed
again if the bundle had one):

```bash
echo '{"op":"refresh-format"}' | node <skill-dir>/../iterator/write.mjs
echo '{"op":"extensions"}' | node <skill-dir>/../iterator/write.mjs
```

Report what was refreshed. When none of the four flags is set, say so and move
on — this check never blocks the review round.

## Staleness and attachment scan

Beyond the gathered `stale` flags (frontmatter `files:` vs `git ls-files`),
scan concept bodies for inline repo-looking paths that no longer exist. Mark
stale memories with `stale: true` and clear `staleReasons` such as
`Referenced file src/old.ts no longer exists`.

Then inspect every `overloadedFeatures` entry. Prefer narrowing inaccurate
concept anchors or consolidating genuinely overlapping concepts; do not delete
useful knowledge merely to get below the limit. For each `overlapCandidates`
group, compare meaning and propose a merge only when the concepts duplicate or
fragment one durable fact. Treat every `danglingReferences` entry as unresolved
staleness: the review can repair/delete knowledge concepts, but feature files
remain writer-owned and out of scope, so report dangling feature references
that need a later deterministic feature rewrite.

## Draft the review payload

- Propose `action: "update"` for memories that are stale, too broadly anchored,
  fragmented into an overlap candidate, or clearly outdated.
- Represent a merge as one `update` card containing the consolidated concept
  plus `delete` cards for concepts it supersedes; explain the relationship in
  each card's reason.
- Propose `action: "delete"` for memories that no longer apply.
- Include all other memories as `action: "keep"` so the user can still delete
  them.
- Never include `existingBody` — the server reads each concept's current body
  from disk for the review display.

## Review

Run the PROTOCOL.md review round with `mode: "consolidate"`. Do **not**
include `headCommit` — consolidation never moves `last_memorized_commit`.
React and finish per PROTOCOL.md. After applying approved verdicts, gather the
knowledge step again and report every residual stale concept, dangling feature
reference, and over-limit feature. Consolidation is not complete merely because
the review write succeeded; never hide residual evidence, and never hand-edit
feature files to clear it.
