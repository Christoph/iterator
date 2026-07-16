---
type: Feature
title: Single status module + server-computed derived state
description: Create lib/status.mjs holding the feature-status transition table, readiness rule, and derived planStage; replace the scattered guards in write.mjs and gather.mjs; hub payload ships ready/waitingOn/stage and hub.mjs drops its client-side depSatisfied duplicate.
status: implemented
size: medium
depends_on: []
files: ["lib/status.mjs", "lib/write.mjs", "lib/gather.mjs", "lib/views/hub.mjs", "scripts/sync.mjs", "test/status.test.mjs", "test/gather.test.mjs", "test/ui.test.mjs", "test/write.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/synced-droppable-skill-libs, setup/development-commands]
timestamp: "2026-07-16T09:52:56.865Z"
tags: []
tests: ["test/status.test.mjs"]
tests_status: green
---

# Implementation notes

Transition table: draft->pending; pending->implemented|done; implemented->pending|done; done terminal. Keep existing error strings byte-identical (write tests assert them). Guards to replace: write.mjs:652-655 creatable statuses, :1224-1237 update-feature enum (tightens: draft->done now forbidden), :1432-1450 accept-commit satisfied set, :2236-2238 restart-feature, :2394-2401 retire-plan all-done; gather.mjs:554-557 satisfies. depSatisfied(status,settings): done, or implemented when review_required==='off'. planStage values: no-plan|plan-draft|needs-features|feature-review|implementing|awaiting-plan-review|retirable. Add lib/status.mjs to COPIES in scripts/sync.mjs.

# Blast radius

All write ops that touch feature status; hub payload shape (additive fields); hub button gating now server-driven.
