---
name: iterator-init
description: Use when the user types /iterator-init or wants to initialize the OKF knowledge areas of the memory/ bundle for a project, with browser review before anything is written.
---

<!-- markdownlint-disable MD013 -->

# iterator-init

Initialize the OKF knowledge side of the `memory/` bundle for the current
project. Works with or without an iterator plan — the knowledge areas and the
plan/features side share one bundle but are independent.

Shared preconditions, review pipeline, React/Finish rules, card schema, and
pi mode: `<skill-dir>/../iterator-knowledge/PROTOCOL.md`. Specific to this flow: if
knowledge areas already exist under `memory/` (any of `architecture/`,
`decisions/`, `patterns/`, `pitfalls/`, `setup/`), stop and tell the user to
run `/iterator-consolidate` instead (an existing `memory/plan.md` or
`memory/features/` is fine — that is the Work side).

## Analyze

Study enough of the repo to draft useful, non-obvious memories: `git
ls-files`, README and docs, package manifests/lockfiles, entry points and
CLI/server startup code, CI and test setup, representative source files for
conventions.

Draft about 3–8 memories total per useful area (areas and card schema in
PROTOCOL.md). Every memory must tell an agent something it needs to act
correctly in this codebase — not what the repo already makes obvious.

## Review

Run the PROTOCOL.md review round with `mode: "init"`, all memories
`action: "create"`, and `headCommit` set to `git rev-parse HEAD` so the
writer seeds `last_memorized_commit`. React and finish per PROTOCOL.md.

## After approval: the extension contract

One more deterministic write — the `extensions` op creates
`memory/EXTENSIONS.md` (the extension-facing memory contract: progressive
disclosure, concept IDs, safe-write rules, writer ops) and links it from the
root index; it is idempotent:

```bash
echo '{"op":"extensions"}' | node <skill-dir>/../iterator/write.mjs
```

Pass `"preamble": "<project-specific prose>"` only when the project needs
contract notes beyond the standard boilerplate.

## Finish

Report created/accepted/rejected counts from `applied` (`applied.summary` is
a ready-made line) and mention that `memory/EXTENSIONS.md` was created for
other extensions.
