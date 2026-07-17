---
type: Feature
title: Implement a dependency-ready feature wave
description: A Work action launches implementation for every feature ready at the start of the wave and reports each result.
status: implemented
size: large
depends_on: []
files: ["lib/gather.mjs", "lib/status.mjs", "lib/views/hub.mjs", "extensions/iterator.js", "skills/iterator-implement/SKILL.md", "test/gather.test.mjs", "test/status.test.mjs", "test/ui.test.mjs", "test/session-server.test.mjs"]
memories: [pitfalls/cancel-now-after-grace-timer, pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T14:32:06.307Z"
tags: []
commits:
  - sha: 01e5a15cedfc71138680d73ed63276ba010eaca8
    kind: implement
    date: 2026-07-17
  - sha: cc53c06e7cf02c1c31774902ecc72f585b9fa0ec
    kind: implement
    date: 2026-07-17
  - sha: 93ee1955897efe51f805bf23f284b593c4e6cf08
    kind: implement
    date: 2026-07-17
reviewed: 2026-07-17
---

# Implementation notes

Use server-derived readiness rather than browser filtering. Add an extension/skill orchestration entry point that snapshots ready features, processes only that snapshot, records per-feature success or failure, refreshes the dashboard between results, and leaves every feature subject to the existing review/acceptance lifecycle.

# Snippets

```js
const ready = readiness(b.features, b.settings);\nconst features = b.features.map((c) => ({ name: c.slug, ...ready.get(c.slug) }));
```

# Blast radius

Work controls and feature lifecycle coordination; must not auto-accept or include features unblocked after the wave starts.

# Review

## 2026-07-17
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Pause/Continue still has a race: Continue can call advanceFeatureWave and dispatch the retried feature before the aborted turn's agent_end fires; that stale agent_end then sees the retried feature active but still pending, marks it failed, and dispatches the next queue member concurrently. Track an abort-in-flight flag/generation: Pause requeues and marks the old turn pending completion, Continue waits when that flag is set, and agent_end clears it then resumes only if state is no longer paused. Add regression coverage for Continue both before and after the aborted agent_end.
* **Needs changes** _(agent review: openai-codex/gpt-5.6-sol)_ — Wave execution ignores the dashboard Pause control: onControl('pause') leaves featureWave active, and agent_end still calls advanceFeatureWave without checking state.paused, so the aborted active feature is marked failed and the next queued feature is dispatched immediately. Preserve/requeue the active item on pause, make advanceFeatureWave no-op while paused, and have Continue resume the wave before falling back to auto mode; add regression coverage for this transition.
