---
type: Feature
title: Server applies plan on approve
description: "When a plan submission carries apply:true and the browser returns plan-approved, the server spawns the writer itself with the approved sections, so plan text no longer round-trips through the model twice."
status: implemented
size: medium
depends_on: []
files: ["lib/app.mjs", "extensions/iterator.js", "skills/iterator-plan/SKILL.md", "skills/iterator/PI.md", "test/steps.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/iterator-dashboard-feature-workflow, decisions/settings-close-returns-to-work, setup/install-and-command-surface]
timestamp: "2026-07-16T10:16:38.952Z"
tags: []
tests: ["test/steps.test.mjs"]
tests_status: green
---

# Implementation notes

Extract the apply-review execFile block (app.mjs:174-193) into a shared runWriter() used by both memory-review apply and plan apply. Surface writer warnings/branch/worktree/note back as result.applied (skill relays note verbatim). Same path in extensions/iterator.js iterator_ui for step==='plan' && extra.apply, plus invalidateSession(). Keep op:plan CLI as fallback; verify writePlan re-run tolerates an existing branch/worktree.

# Blast radius

Plan approval flow in both one-shot and pi servers; iterator-plan skill steps 3-5.
