---
type: Plan
title: Simplify the failing CI pipeline
description: Remove redundant CI setup and matrix execution while preserving the repository test backstop.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-21
timestamp: 2026-07-21T09:30:45.467Z
---

# Goal

Restore a reliable CI check by reducing the dependency-free Node.js pipeline to the minimum needed to run the repository test suite on pushes to main and pull requests.

# Architecture

- Keep `.github/workflows/ci.yml` as the CI entry point and preserve its existing push and pull-request triggers.
- Replace the three-version matrix with one `ubuntu-latest` test job that uses the runner’s available Node.js runtime.
- Keep only repository checkout and `npm test`; the project has no install-time package dependencies, build phase, or generated artifacts required before its built-in `node:test` suite runs.
- Preserve the repository’s package-and-skill layout and existing test suite as the CI contract, consistent with `architecture/package-and-skill-layout`.

# Dependencies

(none)

# Key decisions

- Remove the Node 18/20/22 matrix because repeatedly running the same dependency-free suite is unnecessary for this CI backstop.
- Remove `actions/setup-node` and do not add `npm install`; the hosted runner already provides Node.js and the package declares no installed test dependencies.
- Do not change application code or weaken `npm test`; scope the fix to CI configuration and validate the resulting workflow locally where possible.

# Features

* [Simplify CI workflow](/features/simplify-ci-workflow.md) - Run the repository test suite once in a minimal GitHub Actions job without redundant Node setup or version-matrix executions.
