---
type: Chunk
title: OKF writer invariants
description: Enforce apply-review pointer and knowledge-area invariants so memory approvals cannot skip future memorize coverage or create unsupported areas.
status: pending
size: small
depends_on: []
files: ["skills/iterator/write.mjs", "test/write.test.mjs"]
timestamp: 2026-07-06T19:50:16.549Z
tags: []
---

# Implementation notes

Fix applyReview validation: consolidate must not accept headCommit, init/memorize headCommit must be sha-like when present, and concept ids/areas must be one of the supported OKF areas. Add writer tests for the rejected cases.
