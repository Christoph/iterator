---
type: Feature
title: Fresh implementation session
description: Start every manual, ready-wave, and automatic feature implementation in a new Pi session seeded only with the named feature command and deterministic bundle context.
status: implemented
size: large
depends_on: []
files: ["extensions/iterator.js", "lib/pi-tools.mjs", "skills/iterator-implement/SKILL.md", "test/pi-tools.test.mjs", "test/extension-fresh-session.test.mjs"]
memories: [architecture/package-and-skill-layout, decisions/backlog-planning-and-feature-waves, decisions/iterator-dashboard-feature-workflow, decisions/manual-role-models-and-runtime-reset, decisions/memory-relevance-usage-and-dashboard-recovery, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-20T13:59:02.057Z"
tags: []
commits:
  - sha: e7a69a4ee3dd962817c766d39109012284a0e530
    kind: implement
    date: 2026-07-20
---

# Implementation notes

Add one extension-command handoff seam that owns `ExtensionCommandContext.newSession()`. Route explicit `/iterator-implement`, dashboard implementation actions, ready-wave items, and auto-mode implementation decisions through it. Capture only plain strings/state before replacement; inside `withSession`, use only the replacement context to send `/skill:iterator-implement <slug>` with `--auto` or user guidance as needed. Do not append prior conversation. Preserve parent-session lineage if available. Distinguish intentional `session_start.reason === 'new'` implementation handoffs from interrupted auto runs so the extension does not pause them, and rebuild any in-memory wave ownership from durable/safely serialized state or a replacement-safe command. Keep model-role switching and explicit review acceptance unchanged. Update the implement runbook to describe the Pi-only fresh-session boundary while leaving Claude Code deterministic gather/write behavior intact.

# Snippets

```ts
const result = await ctx.newSession({
  parentSession: ctx.sessionManager.getSessionFile(),
  withSession: async (replacementCtx) => {
    await replacementCtx.sendUserMessage('/skill:iterator-implement auth --auto');
  },
});
```

```js
// Existing auto/wave paths dispatch implementation as another turn.
dispatch(action.cmd);
dispatch(`/skill:iterator-implement ${feature} --auto`);
```

# Blast radius

Every Pi implementation entrypoint and session lifecycle; mistakes can lose auto/wave progress, duplicate a feature turn, or carry stale session-bound objects into the replacement runtime.
