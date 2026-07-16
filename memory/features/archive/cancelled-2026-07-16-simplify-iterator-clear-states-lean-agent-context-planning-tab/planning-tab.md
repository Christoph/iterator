---
type: Feature
title: "Planning tab: backlog, plan and feature management"
description: New planning view holding the no-plan hero, backlog (ideas/bugs), retired plans, dependency graph, stage-driven plan-lifecycle buttons, and read-only feature cards; hub slims to the Work surface; session shell gains the Planning tab.
status: implemented
size: large
depends_on: [status-module, graph-full-labels]
files: ["lib/views/planning.mjs", "lib/views/hub.mjs", "lib/session-server.mjs", "extensions/iterator.js", "lib/app.mjs", "scripts/sync.mjs", "skills/iterator/SKILL.md", "skills/iterator/PI.md", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/browser-server-contract, architecture/package-and-skill-layout, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs]
timestamp: "2026-07-16T10:39:30.000Z"
tags: []
tests: ["test/ui.test.mjs", "test/session-server.test.mjs", "test/client-js-parse.test.mjs"]
tests_status: green
---

# Implementation notes

planning.mjs renders from the same hub gather payload with step 'planning'. Moves out of hub.mjs: hero+goal box (:222-281), renderBacklog (:427-471), renderRetired (:473-492), graph, plan-lifecycle buttons driven by D.stage. Hub keeps escalation banner, progress, dirty chip, auto-implement, Test/Implement/Review cards, empty state pointing at Planning. session-server: TABS=['planning','work','knowledge','usage']; tabFor: plan|feature|archive|planning->planning; hub|test|review|settings|question->work. extensions refreshHub also pushes the planning view; app.mjs VIEWS/GATHERS/CANCEL_REPORTS += planning. Action payload shapes unchanged so actionSkill/actionToCommand stay untouched.

# Depends on

* [Single status module + server-computed derived state](/features/status-module.md)
* [Shared dependency graph with full labels](/features/graph-full-labels.md)

# Blast radius

Dashboard shell, hub view split, extension refresh path; largest test-churn item (string-based ui fixtures) - done last.
