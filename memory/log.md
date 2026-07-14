# iterator update log

## 2026-07-14
* **Retirement**: Plan "Restore Work tab after closing Settings" condensed into [Return to Work when Settings closes](/decisions/settings-close-returns-to-work.md).
* **Implementation**: Committed chunk(settings-return-to-work) on branch iterator/settings-return-to-work.
* **Design**: Captured project design parameters.
* **Update**: Applied 1 chunk adjustment(s).
* **Creation**: 1 chunk(s) written.
* **Creation**: Plan "Restore Work tab after closing Settings" approved on branch main.
* **Cancellation**: Plan "Hub UI, red/green testing, and commit tracking" cancelled — archived under /chunks/archive/cancelled-2026-07-05-hub-ui-red-green-testing-and-commit-tracking/.

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
