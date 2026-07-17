# Decisions

Durable product and implementation choices agents should preserve.

* [Polish dashboard and multi-agent workflows](/decisions/polish-dashboard-and-multi-agent-workflows.md) - Dashboard polish and workflow refinements that clarify project context, constrain settings to usable models, and support deterministic Claude Code feature execution.
* [Powerline shows the sandbox-published UI port](/decisions/powerline-shows-sandbox-ui-port.md) - The footer trails a ui:PORT segment resolved from ITERATOR_DISPLAY_PORT, falling back to ~/.pisbx-env because sbx run never sources it into pi's environment.
* [Return to Work when Settings closes](/decisions/settings-close-returns-to-work.md) - Idle Settings close events restore the refreshed Work hub without changing the settings persistence path.
* [Sync shared libs into droppable skills](/decisions/synced-droppable-skill-libs.md) - Shared code is developed in root lib/ and copied into skill folders so skills work when installed together or copied manually.
* [Unify Iterator dashboard and feature workflow](/decisions/iterator-dashboard-feature-workflow.md) - Iterator’s dashboard uses explicit operation state and consistent iterator/features terminology so active work and navigation remain unambiguous.
* [Use an OKF markdown bundle in target repos](/decisions/okf-markdown-bundle.md) - Project memory is stored as markdown plus YAML frontmatter in each target repo instead of in an external database.
