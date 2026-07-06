---
type: Chunk
title: Commit review memory-card readability
description: Make commit-mode memory proposals readable enough for human approval and refresh the README documentation for the safer OKF flow.
status: done
size: medium
depends_on: [okf-writer-invariants, okf-gather-staleness-range]
files: ["lib/views/review.mjs", "skills/iterator/lib/views/review.mjs", "test/server.test.mjs", "README.md"]
timestamp: "2026-07-06T19:58:15.722Z"
tags: []
done: 2026-07-06
commits:
  - sha: ab474718ce5c76674b859917fd658479d0567942
    kind: implement
    date: 2026-07-06
---

# Implementation notes

Improve lib/views/review.mjs memory proposal cards so they show action/id/type/description/files/source commits/body/current version and a clear apply/skip state. Render markdown bodies client-side with mdToHtml and safe data from D. Update tests and README. Run npm run sync so skills/iterator/lib copies match.

# Depends on

* [OKF writer invariants](/chunks/okf-writer-invariants.md)
* [OKF gather staleness and range accuracy](/chunks/okf-gather-staleness-range.md)
