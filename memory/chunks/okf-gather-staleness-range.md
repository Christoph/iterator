---
type: Chunk
title: OKF gather staleness and range accuracy
description: Make Knowledge staleness honor glob anchors and make /okf-memorize ignore memory-only bookkeeping commits.
status: done
size: small
depends_on: []
files: ["skills/iterator/gather.mjs", "test/gather.test.mjs"]
timestamp: "2026-07-06T19:57:51.862Z"
tags: []
done: 2026-07-06
commits:
  - sha: 5fdde9370df4098521b5b7843357ec4116c1b53c
    kind: implement
    date: 2026-07-06
---

# Implementation notes

Use glob-aware matching in gatherKnowledge stale flags, and apply the memory pathspec exclusion in gatherRange just like gatherMemorize. Add gather tests for glob anchors and memory-only ranges.
