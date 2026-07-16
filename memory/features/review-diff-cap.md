---
type: Feature
title: Cap review diff at file boundary
description: gatherReview truncates the embedded working-tree diff at the last file boundary under 400KB, flags diffTruncated with omitted file names, and the review view shows a warning banner.
status: implemented
size: small
depends_on: []
files: ["lib/gather.mjs", "lib/views/review.mjs", "skills/iterator-review/SKILL.md", "test/steps.test.mjs"]
memories: [patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow]
timestamp: "2026-07-16T10:16:39.040Z"
tags: []
tests: ["test/steps.test.mjs"]
tests_status: green
---

# Implementation notes

Mirror gatherPlanReview's cap (gather.mjs:1534-1558) but cut at the last '\ndiff --git ' boundary under 400000 chars so parseDiff never sees a half file; set diffTruncated:true and diffOmittedFiles from git diff --name-only beyond the cut. One-sentence fallback note in the review skill (scoped --feature review / git show).

# Blast radius

Review payload for oversized diffs only; small view banner.
