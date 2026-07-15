---
type: Architecture
title: Knowledge lifecycle
description: "The knowledge skills manage the bundle's knowledge areas through init, knowledge view, consolidate, and memorize workflows."
tags:
  - okf
  - memory
  - workflow
files:
  - skills/iterator-knowledge/SKILL.md
  - skills/iterator-init/SKILL.md
  - skills/iterator-consolidate/SKILL.md
  - skills/iterator-memorize/SKILL.md
  - skills/iterator/gather.mjs
  - skills/iterator/write.mjs
timestamp: 2026-07-06T19:11:28.964Z
---

# Lifecycle

The `memory/` bundle carries a knowledge side next to the plan/features side: five areas (`architecture/`, `decisions/`, `patterns/`, `pitfalls/`, `setup/`) plus `last_memorized_commit` in the root index frontmatter. Area indexes provide progressive disclosure into individual concept files; concepts anchor to code via `files:` frontmatter.

`/iterator-init` drafts the first knowledge bundle after browser review. `/iterator-knowledge` opens the Knowledge view (memory status, area cards, concept browser with stale flags, action requests). `/iterator-consolidate` re-reviews existing memories, detects stale file anchors, and proposes updates/deletions. `/iterator-memorize` studies commits since `last_memorized_commit` (`gather --step range`, with a merge-base fallback after rebases) and advances the pointer only after approval. `/iterator-implement` additionally evaluates each accepted feature wave for durable knowledge and advances the pointer itself, so only out-of-flow commits accumulate for `/iterator-memorize`.

All knowledge writes funnel through `write.mjs` ops `memorize` and `apply-review` — concept files, regenerated area indexes, non-clobbering root-index updates, log entries, and validation happen in code, never by hand.
