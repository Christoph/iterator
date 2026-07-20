# Decisions

Durable product and implementation choices agents should preserve.

* [Apply role models to manual turns and reset stale runtime state](/decisions/manual-role-models-and-runtime-reset.md) - Manual Iterator role commands temporarily select configured models, while approved plans and terminal auto runs reset runtime state deterministically.
* [Backlog planning and parallel feature waves](/decisions/backlog-planning-and-feature-waves.md) - Keep low-risk backlog editing available during active work while implementing a fixed ready-feature wave and reviewing its commit-backed results together.
* [Consume selected backlog ideas on plan approval](/decisions/consume-accepted-backlog-ideas.md) - Selected idea or bug candidates leave the backlog only after deterministic plan approval.
* [Memory relevance, usage costs, and dashboard recovery](/decisions/memory-relevance-usage-and-dashboard-recovery.md) - Iterator now bounds implementation context, keeps knowledge/retirement changes reviewed, prices usage only from project-owned rates, and maintains an authoritative active-work dashboard state.
* [Parallel feature waves and consolidated review](/decisions/parallel-feature-waves-and-consolidated-review.md) - The dashboard supports fixed dependency-ready implementation waves and commit-backed multi-feature review without weakening explicit acceptance.
* [Polish dashboard and multi-agent workflows](/decisions/polish-dashboard-and-multi-agent-workflows.md) - Dashboard polish and workflow refinements that clarify project context, constrain settings to usable models, and support deterministic Claude Code feature execution.
* [Powerline shows the sandbox-published UI port](/decisions/powerline-shows-sandbox-ui-port.md) - The footer trails a ui:PORT segment resolved from ITERATOR_DISPLAY_PORT, falling back to ~/.pisbx-env because sbx run never sources it into pi's environment.
* [Return to Work when Settings closes](/decisions/settings-close-returns-to-work.md) - Idle Settings close events restore the refreshed Work hub without changing the settings persistence path.
* [Safely restore configured Iterator role models](/decisions/safe-role-model-restoration.md) - Only successfully switched role models are restored, so failed provider changes cannot corrupt the active session credentials.
* [Sync shared libs into droppable skills](/decisions/synced-droppable-skill-libs.md) - Shared code is developed in root lib/ and copied into skill folders so skills work when installed together or copied manually.
* [Unify Iterator dashboard and feature workflow](/decisions/iterator-dashboard-feature-workflow.md) - Dashboard workflows keep backlog candidates separate from active work until selected candidates are consumed by approved plan creation.
* [Use an OKF markdown bundle in target repos](/decisions/okf-markdown-bundle.md) - Project memory is stored as markdown plus YAML frontmatter in each target repo instead of in an external database.
* [Work owns active plan context and lifecycle](/decisions/review-navigation-and-work-context.md) - Keep active-plan progress, execution, and lifecycle controls on Work while Planning is reserved for staged future work and archives.
