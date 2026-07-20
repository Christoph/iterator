---
type: Feature
title: Review exact red test source
description: Users can inspect and approve the complete executable source for every proposed red-mode test before files are written.
status: done
size: medium
depends_on: []
files: ["skills/iterator-test/SKILL.md", "lib/views/test.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs"]
memories: [pitfalls/client-js-template-literal-escaping, decisions/iterator-dashboard-feature-workflow, decisions/parallel-feature-waves-and-consolidated-review, decisions/review-navigation-and-work-context, decisions/settings-close-returns-to-work, decisions/streamline-backlog-planning-and-knowledge-actions]
timestamp: "2026-07-20T16:46:37.169Z"
tags: []
commits:
  - sha: bbb2be96942cd1a87c440fb58f7d0a6fec5c5975
    kind: implement
    date: 2026-07-20
done: 2026-07-20
reviewed: 2026-07-20
---

# Implementation notes

Revise the `/iterator-test` runbook so red-mode planning drafts exact target file content before opening the gate, including imports, setup/helpers, path, and a mapping from every case to its executable test source. Extend the additive browser payload and output contract so the red-mode view renders safely escaped code, keeps include/comment feedback attached to cases, and returns the reviewed artifacts on feedback or approval. The post-approval step must write the accepted source rather than regenerate tests, then run it and verify the expected red result through the existing commit-tests flow. Keep green mode backward-compatible. Update this view's generic actor labels from Claude to Agent while touching it. Follow the saved compact dark design and double-escape inline client-script newlines.

# Snippets

```js
const state = (D.cases || []).map(c => ({ title:c.title||'', kind:c.kind||'happy', rationale:c.rationale||'', include:true, comment:'' }));
```

```js
post({ type:'test-approved', branch:D.branch||'HEAD', feature:feature.name,
  cases: state.filter(c=>c.include).map(c=>({title:c.title,kind:c.kind,rationale:c.rationale,include:true})) },
  'Accepted — Agent is writing tests');
```

# Blast radius

Changes the manual red-test approval payload consumed by the test skill; malformed round-tripping could authorize different tests or break test-plan rendering.

# Review

## 2026-07-20
* **Approved** _(agent review: openai-codex/gpt-5.6-sol)_ — Approved: red-mode review now exposes per-case executable source and complete files, validates mappings, preserves exact approved artifacts, safely supports feedback, and retains green-mode compatibility.
