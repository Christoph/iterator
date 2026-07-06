---
type: Architecture
title: Package and skill layout
description: "The repo is a pi package / Claude Code plugin: SKILL.md runbooks own the flows, deterministic scripts own the mechanics, the extension adds tools/hooks/dashboard."
tags:
  - pi
  - skills
  - package
files:
  - package.json
  - extensions/iterator.js
  - skills/iterator/gather.mjs
  - skills/iterator/write.mjs
  - lib/pi-tools.mjs
timestamp: 2026-07-06T19:11:28.964Z
---

# Structure

`package.json` declares the repo as a pi package with `extensions/` and `skills/`. Each `SKILL.md` is the runbook the agent follows; everything mechanical lives in the `iterator` hub skill's scripts — `gather.mjs` (all read-side state, one `--step` per flow) and `write.mjs` (all bundle writes, one op per mutation). The step and okf skills are logic-only and call the hub's scripts as `<skill-dir>/../iterator/*.mjs`.

`extensions/iterator.js` is NOT thin: it registers typebox-validated tools (`iterator_gather`, `iterator_write`, `iterator_ui`, `okf_write`) that spawn the same CLIs, a session-scoped dashboard, guardrails on the `tool_call` hook, and friendly commands. Pure decision logic for the extension lives in `lib/pi-tools.mjs` / `lib/guardrails.mjs` so it is testable without a pi runtime.

When changing behavior, update the relevant `SKILL.md` first if the agent workflow changes; keep the pi path and the bash path byte-identical by routing both through the same scripts.
