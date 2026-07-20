---
type: Plan
title: Fix post-test role model credential corruption
description: Prevent red-test completion and role-model restoration from leaving the next Iterator turn on an unusable OpenAI credential path.
status: approved
branch: iterator/fix-post-test-role-model-credential-corruption
worktree: /Volumes/Extern/Projects/iterator-iterator-fix-post-test-role-model-credential-corruption
created: 2026-07-20
timestamp: 2026-07-20T13:10:00.129Z
---

# Goal

Make the red-test → implementation handoff reliable: after `/iterator-test` writes and commits intentionally failing tests, the following `/iterator-implement` turn must use the intended active or explicitly configured role model without producing a `proxy-managed` OpenAI 401 or leaking model state between turns.

# Architecture

- Build on `architecture/package-and-skill-layout`: isolate the extension's manual-role lifecycle (`input` → `before_agent_start` → `agent_end`) and reproduce the tester-to-implementer sequence with direct extension-hook tests, including managed/proxied active models and failed switches.
- Keep role resolution in `lib/pi-tools.mjs` and session orchestration in `extensions/iterator.js`; make role state turn-scoped, consume stale pending roles, and only restore a prior model when an explicit switch actually succeeded.
- Treat `active` as a strict no-model-switch path. Preserve thinking-level overrides independently, and never synthesize, export, or rewrite provider API-key environment variables.
- Verify both manual red-test handoff and automatic/wave role transitions, then run `npm run sync` for any canonical `lib/` changes so shipped skill copies remain identical.

# Dependencies

(none)

# Key decisions

- Follow `decisions/manual-role-models-and-runtime-reset`: retain configured per-role model selection and restoration, but harden its lifecycle rather than disabling role models.
- A default or explicit `active` role model must not call `pi.setModel`; an unknown, unavailable, or failed explicit override must stay on the usable current model and must not arm a later restoration.
- Add hook-level regression coverage for tester → implementer and restoration failure paths, closing the direct extension-lifecycle test gap recorded by `decisions/manual-role-models-and-runtime-reset`.
- Preserve the red/green feature contract: red tests remain committed and visible to implementation; deferred formatter output is treated as context, not as a trigger for provider selection.

# Features

* [Safe role-model handoff](/features/safe-role-model-handoff.md) - Keep the active managed model usable when a tester or implementer role override is unavailable, so red-test completion can hand off to implementation without an OpenAI credential error.
