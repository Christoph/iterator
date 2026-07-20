---
type: Plan
title: Verify red test code and use Agent wording
description: Make red-mode test review code-exact and replace user-facing Claude labels with Agent.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-20
timestamp: 2026-07-20T16:08:42.753Z
---

# Goal

Let users verify the exact source of every proposed red-mode test before any test file is written, so approval covers the implementation rather than only case titles and rationales. Also replace user-facing references to “Claude” with the provider-neutral term “Agent” throughout Iterator’s interactive surfaces.

# Architecture

- Extend the `/iterator-test` red-mode draft contract from metadata-only cases to code-backed review artifacts: associate every case with its real proposed test source and include complete file context such as imports, setup, helpers, and target path.
- Update the test-plan browser view within the saved `memory/design.md` parameters to render readable, safely escaped source for each red test, preserve case-level inclusion and feedback, and round-trip the reviewed code through feedback and approval.
- Make the approved red-mode draft the source of truth for the write step: write the exact reviewed test content, then retain the existing run, expected-red verification, deterministic `commit-tests`, and implementation handoff flow described by `decisions/focus-feature-execution-and-dashboard-ownership`.
- Replace human-facing “Claude” copy in shared shell/server messages, workflow views, and extension status text with “Agent”; preserve actual Claude Code platform names, plugin compatibility identifiers, commands, model IDs, and developer documentation where they are proper nouns rather than UI agent labels.
- Develop shared UI behavior in root `lib/`, update workflow runbooks where the agent contract changes, run `npm run sync`, and cover the root and shipped skill copies in tests per `architecture/package-and-skill-layout` and `decisions/synced-droppable-skill-libs`.

# Dependencies

(none)

# Key decisions

- Collapse the duplicated red-test backlog candidate into one requirement.
- Scope code-exact review to red mode; keep green-mode planning behavior compatible unless shared schema handling requires additive fields.
- Approval means the exact displayed source is authorized: the agent must not regenerate materially different test code after acceptance. Users request revisions through existing per-case or overall feedback controls.
- Show complete executable context, not illustrative snippets, while still mapping each included test case to the source the user is approving.
- “Agent” replaces “Claude” only when referring generically to the active coding agent; explicit Claude Code product integration and provider/model identifiers remain unchanged.
- Add no external dependencies; use existing rendering, escaping, workflow, and test infrastructure.

# Features

* [Use Agent wording in the dashboard shell](/features/agent-neutral-shell-copy.md) - Shared dashboard status, submission, cancellation, and working messages refer to the active coding Agent rather than Claude.
* [Review exact red test source](/features/review-exact-red-test-source.md) - Users can inspect and approve the complete executable source for every proposed red-mode test before files are written.
* [Use Agent wording in workflow views](/features/agent-neutral-workflow-copy.md) - Interactive plan, feature, review, memory, and question views consistently address the provider-neutral Agent.
