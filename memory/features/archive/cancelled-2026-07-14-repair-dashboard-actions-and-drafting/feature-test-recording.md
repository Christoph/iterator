---
type: Feature
title: Record tests for feature contracts
description: Make the deterministic test writer record and commit tests for feature-based plans.
status: pending
size: medium
depends_on: []
files: ["lib/write.mjs", "skills/iterator/lib/write.mjs", "test/write.test.mjs", "test/sync.test.mjs"]
memories: [decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs, setup/development-commands]
timestamp: "2026-07-14T11:32:10.154Z"
tags: []
---

# Implementation notes

Originally authored (pre-rename, as "Record tests for chunk contracts") to migrate commit-tests onto the current bundle contract, preserving atomic staging, test status updates, commit trailers, and bundle regeneration, with root and packaged writer copies kept synchronized.

Resolution: after the global chunk→feature rename the canonical contract is `memory/features/` with the `Feature:` trailer, and the deterministic writer already records and commits tests for such plans (write.mjs `commit-tests`, covered by test/write.test.mjs "commit-tests commits test files with trailer, records status and sha"). The remaining work — done here — was converting this plan's bundle from the retired chunk layout (memory/chunks/, plan `# Chunks`, state `active_chunk`) to the feature contract so /iterator-test auto rounds stop no-op'ing against an invisible plan, plus sweeping every remaining chunk location (usage ledger totals key, decision/log archive pointers) to feature naming.

# Blast radius

All /iterator-test flows for feature-based plans.
