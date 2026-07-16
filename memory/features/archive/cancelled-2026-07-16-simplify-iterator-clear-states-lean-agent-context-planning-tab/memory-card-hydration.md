---
type: Feature
title: Server hydrates existingBody from disk
description: Add hydrateMemoryCards to gather.mjs so memory-review and review payloads get existingBody filled from disk by concept id; the LLM card schema drops the requirement; consolidate skill stops re-reading and echoing bodies.
status: implemented
size: small
depends_on: []
files: ["lib/gather.mjs", "lib/app.mjs", "extensions/iterator.js", "skills/iterator-knowledge/PROTOCOL.md", "skills/iterator-consolidate/SKILL.md", "skills/iterator-knowledge/SKILL.md", "test/steps.test.mjs"]
memories: [architecture/knowledge-lifecycle, architecture/package-and-skill-layout, patterns/agent-reviewed-memory-writes, decisions/iterator-dashboard-feature-workflow, decisions/settings-close-returns-to-work, setup/install-and-command-surface]
timestamp: "2026-07-16T10:16:38.775Z"
tags: []
tests: ["test/steps.test.mjs"]
tests_status: green
---

# Implementation notes

Writer already reads disk (write.mjs applyReview/conceptDoc); only views/memory-review.mjs:74,208,212 and views/review.mjs:294,303 consume existingBody. Fill only when absent (explicit bodies win) for update|delete|keep cards and review-step memory.proposals[]. Call sites: app.mjs main() after extra-merge (~:137-144) and extensions/iterator.js iterator_ui after mergePayload (~:1258).

# Blast radius

Memory-review and review display payloads; knowledge skill docs; no writer changes.
