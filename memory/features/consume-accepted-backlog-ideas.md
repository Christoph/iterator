---
type: Feature
title: Consume accepted backlog ideas
description: Remove selected backlog candidates atomically when their plan and resulting feature set are accepted.
status: implemented
size: medium
depends_on: []
files: ["lib/write.mjs", "lib/gather.mjs", "lib/bundle.mjs", "lib/views/planning.mjs", "extensions/iterator.js", "test/write.test.mjs", "test/gather.test.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs", "test/sync.test.mjs", "skills/iterator/lib/write.mjs", "skills/iterator/lib/gather.mjs", "skills/iterator/lib/bundle.mjs", "skills/iterator/lib/views/planning.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port, decisions/settings-close-returns-to-work, decisions/synced-droppable-skill-libs]
timestamp: "2026-07-17T13:52:37.777Z"
tags: []
---

# Implementation notes

Define a validated selected-backlog identifier handoff from Planning to plan acceptance, then consume only those records after the plan write succeeds. Preserve selections on non-approval outcomes. Carry the accepted candidate identities into the feature-set flow so the same accepted work cannot leave stale backlog entries. Refresh the gathered Planning payload after successful writes; update client UI wording/interaction without deriving lifecycle state there. Add writer, gather/UI, and browser-script coverage; run npm run sync for canonical lib changes.

# Snippets

```js
function selectedBacklogGoal(){
  const selected = (D.backlog || []).filter(item => item.selected);
  if(!selected.length) return null;
  return 'Create a plan from these saved backlog candidates:\\n\\n' + selected.map(item =>
    '[' + item.kind + '] ' + item.title + (item.details ? '\\n' + item.details : '')).join('\\n\\n');
}
```

```js
function writeBacklog(payload, root) {
  const b = loadBundle(root);
  const action = String(payload.action || '');
  const items = loadBacklogForWrite(b);
  // create, edit, select, delete
}
```

```js
function writePlan(payload, root) {
  const b = loadBundle(root);
  // validate and write plan, regenerate and log
}
```

# Blast radius

Plan acceptance, feature slicing acceptance, the Planning backlog, deterministic bundle writes, and synchronized skill copies.
