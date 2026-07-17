---
type: Feature
title: Keep the idea backlog editable during agent work
description: Let users create, edit, delete, and select backlog candidates while an implementation turn is running.
status: implemented
size: medium
depends_on: []
files: ["lib/session-server.mjs", "lib/views/planning.mjs", "extensions/iterator.js", "test/session-server.test.mjs", "test/ui.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, architecture/browser-server-contract, architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/consume-accepted-backlog-ideas, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows]
timestamp: "2026-07-17T15:12:25.814Z"
tags: []
commits:
  - sha: f44d2f9e2da9ba16c40498873fadf4824c686891
    kind: feature
    date: 2026-07-17
  - sha: f44d2f9e2da9ba16c40498873fadf4824c686891
    kind: implement
    date: 2026-07-17
reviewed: 2026-07-17
---

# Implementation notes

Treat backlog CRUD as a deterministic filesystem mutation, not a new model flow. Permit only `{ type: "backlog" }` through the session server while it is working; reject every other unsolicited action. Keep the Planning UI responsive, retain selection intent until deterministic plan approval, and refresh the dashboard after the write.

# Snippets

```js
const backlogWrite = parsed.type === "backlog";
if (!pending && working != null && !backlogWrite) {
  res.writeHead(409, { "Content-Type": "application/json" });
  res.end('{"busy":true}');
  return;
}
```

# Blast radius

The session dashboard's concurrency guard and Planning backlog controls; no second agent flow may start while backlog CRUD remains available.

# Review

## 2026-07-17
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Backlog CRUD clears the active agent-working guard: `saveBacklog()` in `extensions/iterator.js` calls `session.showWorking("Saving backlog candidate…")`, then `clearWorking()` and `refreshHub()`. When invoked during implementation, this overwrites and removes the model turn's working state, re-enabling unrelated dashboard actions while the agent is still running. Preserve/restore the existing working state (or make backlog saves use a separate non-destructive status path), and add an integration test proving a backlog save during active work leaves other `/submit` actions blocked with 409 until the model turn actually ends.
