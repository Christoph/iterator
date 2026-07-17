---
type: Feature
title: Support Claude Code feature flow
description: Make Claude Code skills reliably drive the existing plan and feature workflow without changing Pi’s review-centered flow.
status: done
size: medium
depends_on: []
files: ["CLAUDE.md", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", "skills/iterator/SKILL.md", "skills/iterator-plan/SKILL.md", "skills/iterator-feature/SKILL.md", "skills/iterator-test/SKILL.md", "skills/iterator-implement/SKILL.md", "skills/iterator-review/SKILL.md", "lib/gather.mjs", "lib/write.mjs", "test/skills.test.mjs", "test/gather.test.mjs", "test/write.test.mjs"]
memories: [architecture/workflow-state-ownership, decisions/iterator-dashboard-feature-workflow]
timestamp: "2026-07-17T08:10:43.057Z"
tags: []
commits:
  - sha: 7d84d320f4fc58a35247aa54941998bd418850f7
    kind: implement
    date: 2026-07-17
done: 2026-07-17
---

# Implementation notes

Audit and revise the published SKILL.md runbooks and Claude plugin metadata so Claude loads the applicable instructions, reads gather outputs and feature contracts, processes exactly one ready feature per round, and performs the Claude-specific completion/commit path. Keep mechanical mutations routed through gather/write and preserve Pi’s dashboard and user-controlled acceptance behavior.

# Snippets

```md
`package.json` declares the repo as a pi package with `extensions/` and `skills/`. Each `SKILL.md` is the runbook the agent follows; everything mechanical lives in the `iterator` hub skill's scripts.
```

# Blast radius

Published Claude Code plugin instructions and deterministic workflow behavior; must remain compatible with the Pi extension.
