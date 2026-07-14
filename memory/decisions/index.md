# Decisions

Durable product and implementation choices agents should preserve.

* [Return to Work when Settings closes](/decisions/settings-close-returns-to-work.md) - Idle Settings close events restore the refreshed Work hub without changing the settings persistence path.
* [Sync shared libs into droppable skills](/decisions/synced-droppable-skill-libs.md) - Shared code is developed in root lib/ and copied into skill folders so skills work when installed together or copied manually.
* [Use an OKF markdown bundle in target repos](/decisions/okf-markdown-bundle.md) - Project memory is stored as markdown plus YAML frontmatter in each target repo instead of in an external database.
