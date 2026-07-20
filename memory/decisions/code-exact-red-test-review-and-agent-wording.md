---
type: Decision
title: Review exact red test source and use Agent wording
description: Red-mode test approval covers exact executable files, while generic dashboard copy refers to the provider-neutral Agent.
status: accepted
date: 2026-07-20
tags: [testing, review, workflow, ui-copy]
files: ["extensions/iterator.js", "lib/server.mjs", "lib/ui.mjs", "lib/session-server.mjs", "test/server.test.mjs", "test/session-server.test.mjs", "test/extension-model-lifecycle.test.mjs", "skills/iterator-test/SKILL.md", "lib/views/test.mjs", "test/ui.test.mjs", "test/client-js-parse.test.mjs", "lib/views/plan.mjs", "lib/views/feature.mjs", "lib/views/review.mjs", "lib/views/memory-review.mjs", "lib/views/question.mjs", "lib/views/widgets.mjs", "test/agent-copy.test.mjs"]
timestamp: 2026-07-20T17:44:46.841Z
---

# Decision

Red-mode test review must expose the complete executable test files before anything is written. Each included test case identifies its exact source and target path, and approval authorizes that reviewed file content without post-approval regeneration. Mapping validation and browser-script coverage protect the handoff; green-mode test planning remains metadata-compatible.

Generic user-facing workflow copy calls the active coding system the **Agent**. Keep explicit **Claude Code** platform references and provider/model identifiers intact. The regression suite checks canonical shell and workflow surfaces, while root shared libraries remain synchronized to shipped skill copies.

# Outcome

Users can verify real red-test source—including imports, setup, helpers, and assertions—at the approval gate. Shared completion, working, feedback, and workflow messages consistently use provider-neutral wording.

# Retired plan

Condensed from plan "Verify red test code and use Agent wording" (3 features, archived under /features/archive/2026-07-20-code-exact-red-test-review-and-agent-wording/).

Token usage: 2024786 in / 38005 out / 18353664 cache-read / 0 cache-write over 148 turns (per-step breakdown in the archived usage.md).
