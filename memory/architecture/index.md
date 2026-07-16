# Architecture

How the system is structured.

* [Browser server contract](/architecture/browser-server-contract.md) - Interactive workflows run a local server that receives a JSON payload on stdin and returns exactly one JSON result on stdout.
* [Centralized workflow state rules](/architecture/workflow-state-ownership.md) - lib/status.mjs owns feature transitions, dependency readiness, and derived plan stages; gather computes them and views render the supplied state.
* [Knowledge lifecycle](/architecture/knowledge-lifecycle.md) - The knowledge skills manage the bundle's knowledge areas through init, knowledge view, consolidate, and memorize workflows.
* [Package and skill layout](/architecture/package-and-skill-layout.md) - The repo is a pi package / Claude Code plugin: SKILL.md runbooks own the flows, deterministic scripts own the mechanics, the extension adds tools/hooks/dashboard.
