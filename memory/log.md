# iterator update log

## 2026-07-17
* **Review**: Accepted [Keep the backlog available during active work](/features/always-available-backlog.md) (committed as feature(always-available-backlog)).
* **Implementation**: Committed feature(always-available-backlog) on branch iterator/consume-accepted-backlog-ideas; awaiting review.
* **Update**: Applied 3 feature adjustment(s).
* **Update**: 2 feature(s) written.
* **Creation**: 3 feature(s) written.
* **Creation**: Plan "Keep backlog planning available and support parallel feature waves" approved on branch iterator/consume-accepted-backlog-ideas.
* **Backlog**: select parallel-features-implement (selected).
* **Backlog**: select idea-backlog-always-active (selected).
* **Backlog**: edit parallel-features-implement.
* **Backlog**: create parallel-features-implement.
* **Backlog**: create idea-backlog-always-active.
* **Backlog**: delete remove-elements-from-idea-backlog-when-the-plan-and-feature-is-created.
* **Backlog**: delete idea-backlog-layout.
* **Backlog**: delete improve-the-interaction-with-claude-code.
* **Backlog**: delete show-in-settings-for-models-only-the-scoped-models.
* **Backlog**: delete improve-overall-styling.
* **Retirement**: Plan "Remove accepted backlog ideas" condensed into [Consume selected backlog ideas on plan approval](/decisions/consume-accepted-backlog-ideas.md).
* **Update**: Memorized [Unify Iterator dashboard and feature workflow](/decisions/iterator-dashboard-feature-workflow.md).
* **Review**: Accepted [Consume accepted backlog ideas](/features/consume-accepted-backlog-ideas.md) (committed as feature(consume-accepted-backlog-ideas)).
* **Implementation**: Committed feature(consume-accepted-backlog-ideas) on branch iterator/consume-accepted-backlog-ideas; awaiting review.
* **Update**: Applied 1 feature adjustment(s).
* **Creation**: 1 feature(s) written.
* **Creation**: Plan "Remove accepted backlog ideas" approved on branch main.
* **Backlog**: select remove-elements-from-idea-backlog-when-the-plan-and-feature-is-created (selected).
* **Backlog**: select idea-backlog-layout (deselected).
* **Backlog**: select improve-the-interaction-with-claude-code (deselected).
* **Backlog**: select show-in-settings-for-models-only-the-scoped-models (deselected).
* **Backlog**: select improve-overall-styling (deselected).
* **Backlog**: create remove-elements-from-idea-backlog-when-the-plan-and-feature-is-created.
* **Update**: Memorized [Remote browser access](/setup/remote-browser-access.md).
* **Creation**: Memorized [An IPv4-only bind breaks localhost behind a sandbox forward](/pitfalls/ipv4-only-bind-breaks-localhost.md).
* **Update**: Memorized [Powerline shows the sandbox-published UI port](/decisions/powerline-shows-sandbox-ui-port.md).
* **Creation**: Memorized [Powerline shows the sandbox-published UI port](/decisions/powerline-shows-sandbox-ui-port.md).
* **Retirement**: Plan "Polish dashboard and multi-agent workflows" condensed into [Polish dashboard and multi-agent workflows](/decisions/polish-dashboard-and-multi-agent-workflows.md).
* **Review**: Accepted [Support Claude Code feature flow](/features/support-claude-code-feature-flow.md) (committed as feature(support-claude-code-feature-flow)).
* **Implementation**: Committed feature(support-claude-code-feature-flow) on branch iterator/scope-settings-model-options; awaiting review.
* **Review**: Accepted [Scope settings model options](/features/scope-settings-model-options.md) (committed as feature(scope-settings-model-options)).
* **Implementation**: Committed feature(scope-settings-model-options) on branch iterator/scope-settings-model-options; awaiting review.
* **Settings**: Updated planner_model, reviewer_model, plan_reviewer_model.

## 2026-07-16
* **Review**: Accepted [Bound planning archives](/features/bound-planning-archives.md) (committed as feature(bound-planning-archives)).
* **Implementation**: Committed feature(bound-planning-archives) on branch iterator/clarify-dashboard-identity; awaiting review.
* **Update**: Memorized [Browser server contract](/architecture/browser-server-contract.md).
* **Memorize**: Advanced last_memorized_commit to a5d59c5.
* **Implementation**: Committed feature(clarify-dashboard-identity) on branch iterator/clarify-dashboard-identity.
* **Update**: Applied 4 feature adjustment(s).
* **Creation**: 4 feature(s) written.
* **Creation**: Plan "Polish dashboard and multi-agent workflows" approved on branch main.
* **Backlog**: select idea-backlog-layout (selected).
* **Backlog**: create idea-backlog-layout.
* **Backlog**: select improve-overall-styling (selected).
* **Backlog**: select show-in-settings-for-models-only-the-scoped-models (selected).
* **Backlog**: select improve-the-interaction-with-claude-code (selected).
* **Backlog**: create improve-the-interaction-with-claude-code.
* **Backlog**: create show-in-settings-for-models-only-the-scoped-models.
* **Backlog**: create improve-overall-styling.
* **Memorize**: Set last_memorized_commit to 84d97d1270c7.
* **Creation**: Memorized [Centralized workflow state rules](/architecture/workflow-state-ownership.md).
* **Update**: Memorized [Unify Iterator dashboard and feature workflow](/decisions/iterator-dashboard-feature-workflow.md).
* **Cancellation**: Plan "Simplify iterator: clear states, lean agent context, Planning tab" cancelled — archived under /features/archive/cancelled-2026-07-16-simplify-iterator-clear-states-lean-agent-context-planning-tab/.
* stale-docs-cleanup implemented: NUL note removed (byte verified gone), server-derived-state + tab structure documented in CLAUDE.md
* planning-tab implemented: planning view + widgets module, hub slimmed to Work, four-tab shell, extension pushes both; 311/311 green + manual render check
* server-module-split implemented: env/run-id/takeover/listen modules, facade re-exports, session-server shares listenWithTakeover; takeover + force-port manually verified
* review-state-hints implemented; suite green
* review-diff-cap implemented; suite green
* plan-apply-on-approve implemented; suite green
* retire-gather-step implemented; suite green
* memory-card-hydration implemented; suite green
* User hit a state mismatch: Implement ran, Review said working tree clean
* graph-full-labels implemented: shared lib/views/graph.mjs, auto-width nodes, clip() removed; 303/303 green
* status-module implemented: transition table + server-computed readiness/stage; 302/302 green
* Feature the simplification plan
* Registered simplification plan approved in Claude Code plan mode
* Superseded: dashboard-repair work already committed on main; archiving to start the simplification plan
* **Creation**: Memorized [Client JS in view template literals needs double-backslash escapes](/pitfalls/client-js-template-literal-escaping.md).

## 2026-07-15
* **Retirement**: Plan "Unify Iterator dashboard and feature workflow" condensed into [Unify Iterator dashboard and feature workflow](/decisions/iterator-dashboard-feature-workflow.md).
* **Implementation**: Committed feature(feature-idea-backlog) on branch iterator/iterator-terminology-migration.
* **Implementation**: Committed feature(scoped-dashboard-actions) on branch iterator/iterator-terminology-migration.
* **Cancellation**: Feature "Visible dashboard operation state" cancelled and archived under /features/archive/cancelled-2026-07-15-dashboard-operation-state/.
* **Design**: Captured project design parameters.
* **Implementation**: Committed feature(iterator-terminology-migration) on branch iterator/iterator-terminology-migration.
* **Implementation**: Committed feature(iterator-terminology-migration) on branch iterator/iterator-terminology-migration.
* **Update**: Applied 4 feature adjustment(s).
* **Creation**: 4 feature(s) written.
* **Creation**: Plan "Unify Iterator dashboard and feature workflow" approved on branch main.

## 2026-07-14
* **Update**: Implemented all 4 features in the working tree with green regression tests; statuses stay pending until the user reviews and commits.
* **Update**: Reset runtime state to manual/idle — the auto loop was wedged dispatching /iterator-test against a bundle the renamed tooling could not see.
* **Update**: Converted the plan bundle from the retired chunk layout (memory/chunks/, `# Chunks`, active_chunk) to the feature contract; completed the cancelled 2026-07-05 plan's archive with its 11 stranded feature files.
* **Update**: Applied 1 chunk adjustment(s).
* **Update**: 2 chunk(s) written.
* **Update**: Applied 3 chunk adjustment(s).
* **Update**: 3 chunk(s) written.
* **Creation**: 3 chunk(s) written.
* **Creation**: Plan "Repair dashboard actions and drafting" approved on branch iterator/settings-return-to-work.
* **Retirement**: Plan "Restore Work tab after closing Settings" condensed into [Return to Work when Settings closes](/decisions/settings-close-returns-to-work.md).
* **Implementation**: Committed chunk(settings-return-to-work) on branch iterator/settings-return-to-work.
* **Design**: Captured project design parameters.
* **Update**: Applied 1 chunk adjustment(s).
* **Creation**: 1 chunk(s) written.
* **Creation**: Plan "Restore Work tab after closing Settings" approved on branch main.
* **Cancellation**: Plan "Hub UI, red/green testing, and commit tracking" cancelled — archived under /features/archive/cancelled-2026-07-05-hub-ui-red-green-testing-and-commit-tracking/.

## 2026-07-06
* **Implementation**: Committed feature(commit-memory-reviewability) on branch iterator/okf-gather-staleness-range.
* **Implementation**: Committed feature(okf-writer-invariants) on branch iterator/okf-gather-staleness-range.
* **Implementation**: Committed feature(okf-gather-staleness-range) on branch iterator/okf-gather-staleness-range.
* **Update**: Added corrective features for OKF writer/gather invariants and commit-review memory readability.
* **Initialization**: Set last_memorized_commit to 308b031eeaa0.
* **Creation**: Memorized [Remote browser access](/setup/remote-browser-access.md).
* **Creation**: Memorized [Install and command surface](/setup/install-and-command-surface.md).
* **Creation**: Memorized [Development commands](/setup/development-commands.md).
* **Creation**: Memorized [Immediate cancel can be masked by a pending grace timer](/pitfalls/cancel-now-after-grace-timer.md).
* **Creation**: Memorized [Safe browser rendering helpers](/patterns/safe-browser-rendering.md).
* **Creation**: Memorized [One JSON line server results](/patterns/one-json-line-server-results.md).
* **Creation**: Memorized [Agent-reviewed memory writes](/patterns/agent-reviewed-memory-writes.md).
* **Creation**: Memorized [Sync shared libs into droppable skills](/decisions/synced-droppable-skill-libs.md).
* **Creation**: Memorized [Use an OKF markdown bundle in target repos](/decisions/okf-markdown-bundle.md).
* **Creation**: Memorized [Package and skill layout](/architecture/package-and-skill-layout.md).
* **Creation**: Memorized [Knowledge lifecycle](/architecture/knowledge-lifecycle.md).
* **Creation**: Memorized [Browser server contract](/architecture/browser-server-contract.md).
* **Update**: Refreshed format.md from the current schema template.
* **Update**: Hub payload gathering moved into code — skills/iterator/gather.mjs prints the step:"hub" payload (frontmatter, hasDiff via files globs, hasCommits via Feature: trailer); SKILL.md no longer instructs the model to read bundle files. Stale-tab guard added: pages embed a per-run id echoed on /submit and /cancel so a leftover tab from an earlier round can no longer cancel the live one (same fixes applied to okf-memory, incl. its gather.mjs).
* **Update**: UI made the control plane — one shared server in the iterator hub skill renders all step views (lib/views/); step skills are logic-only. Single-instance takeover keeps the fixed port 7777 (fixes the port-drift leak; pisbx forwards exactly 7777). Per-run URL token dropped (dev-only, matches okf-memory). Added pi extension (extensions/iterator.js) so iterator, okf-memory, and pi-docker-sandbox-setup work together.

## 2026-07-05
* **Implementation**: Built feature(docs-refresh); all 8 features done. Commits deferred (git blocked in session).
* **Implementation**: Built feature(hub-dispatch); commit deferred (git blocked in session).
* **Implementation**: Built feature(hub-dashboard-ui); commit deferred (git blocked in session).
* **Implementation**: Built feature(review-committed-diffs); commit deferred (git blocked in session).
* **Implementation**: Built feature(implement-green-gate), incl. optional impeccable design-quality hook (user request); commit deferred (git blocked in session).
* **Implementation**: Built feature(test-red-mode); commit deferred (git blocked in session).
* **Implementation**: Built feature(expose-bind-host); commit deferred (git blocked in session).
* **Implementation**: Built feature(schema-tests-commits); commit deferred (git blocked in session).
* **Creation**: Created 8 features from the plan.
* **Creation**: Plan "Hub UI, red/green testing, and commit tracking" drafted on branch main (status: draft — pending user approval).
