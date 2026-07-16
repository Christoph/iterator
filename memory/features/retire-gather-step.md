---
type: Feature
title: Narrow gather step for plan retirement
description: Add gather --step retire returning plan sections plus per-feature summaries so the retire flow no longer instructs the agent to read the plan and every feature file wholesale.
status: implemented
size: small
depends_on: []
files: ["lib/gather.mjs", "skills/iterator/SKILL.md", "test/steps.test.mjs"]
memories: [decisions/iterator-dashboard-feature-workflow]
timestamp: "2026-07-16T10:16:38.863Z"
tags: []
tests: ["test/steps.test.mjs"]
tests_status: green
---

# Implementation notes

Reuse gatherPlanReview's feature mapping (gather.mjs:1498-1506) minus the diff: {step:'retire', plan:{title,description,created,goal,architecture,keyDecisions}, features:[{name,title,description,status,files,review}], filesUnion, allDone}. Register in runCli steps. Replace the 'Read the plan and its features' instruction in skills/iterator/SKILL.md:85-87.

# Blast radius

New read-only gather step; retire skill instructions.
