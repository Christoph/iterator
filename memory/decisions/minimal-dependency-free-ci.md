---
type: Decision
title: Keep dependency-free CI minimal
description: For this dependency-free Node.js package, CI runs the repository test suite once without an unnecessary Node matrix or setup step.
status: accepted
date: 2026-07-21
tags: [ci, github-actions, nodejs, testing]
files: [".github/workflows/ci.yml"]
timestamp: 2026-07-21T09:35:38.104Z
---

## Decision

Keep the GitHub Actions workflow as a single `ubuntu-latest` job that checks out the repository and runs `npm test` for pushes to `main` and pull requests. Do not add a Node version matrix, `actions/setup-node`, or dependency-install step while the test suite has no installed dependencies and uses only the runner-provided Node.js runtime.

## Rationale

The previous Node 18/20/22 matrix repeated the same dependency-free test suite three times, and explicit Node setup added no value. A minimal workflow provides the required regression backstop with less CI time and fewer failure points. Revisit this decision if the project gains runtime-specific compatibility requirements or install-time test dependencies.

# Retired plan

Condensed from plan "Simplify the failing CI pipeline" (1 features, archived under /features/archive/2026-07-21-minimal-dependency-free-ci/).

Token usage: 281758 in / 5588 out / 1730560 cache-read / 0 cache-write over 52 turns (per-step breakdown in the archived usage.md).
