---
type: Feature
title: Implement a fixed dependency-ready feature wave
description: Start and advance a snapshot of every pending feature that is ready when the user clicks Implement next wave.
status: done
size: medium
depends_on: []
files: ["lib/gather.mjs", "lib/views/hub.mjs", "lib/pi-tools.mjs", "extensions/iterator.js", "skills/iterator-implement/SKILL.md", "test/gather.test.mjs", "test/ui.test.mjs", "test/pi-tools.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, architecture/package-and-skill-layout, architecture/workflow-state-ownership, patterns/safe-browser-rendering, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/polish-dashboard-and-multi-agent-workflows, decisions/powerline-shows-sandbox-ui-port]
timestamp: "2026-07-17T15:17:38.309Z"
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
done: 2026-07-17
---

# Implementation notes

Gather server-derived ready-wave candidates, expose the Work-tab control, and dispatch each snapshot member independently. Persist queue, active feature, and result state through pause/resume; do not add features unblocked later, and record decision conflicts or failed rounds without dispatching them. Preserve the separate explicit review gate after implementation.

# Snippets

```js
if (feature.status === "pending") {
  next.active = featureName;
  return {
    wave: next,
    action: {
      step: "implement",
      role: "implementer",
      feature: featureName,
      cmd: `/skill:iterator-implement ${featureName} --auto`,
    },
  };
}
```

# Blast radius

Feature lifecycle dispatch, automatic-flow controls, and the Work dashboard; readiness must remain server-derived by lib/status.mjs and lib/gather.mjs.
