---
type: Plan
title: Make configuration and memory self-explanatory
description: Reject unusable role models where they are chosen and make the memory bundle explain its own usage to agents without the extension.
status: approved
branch: iterator/make-configuration-and-memory-self-explanatory
worktree: /Volumes/Extern/Projects/iterator-iterator-make-configuration-and-memory-self-explanatory
created: 2026-07-21
timestamp: 2026-07-21T19:41:10.247Z
---

# Goal

Stop Iterator from failing silently when its configuration or its memory bundle is used outside the dashboard. A role model that cannot work in the current session must be rejected where it is chosen, not surface later as an opaque provider 401; and a memory/ bundle must explain its own usage well enough that an agent with no Iterator extension can read and update it correctly.

# Architecture

- Extend the settings seam in `extensions/iterator.js` (`modelOptions` / `saveSettings`) per `architecture/package-and-skill-layout`: the registry is only reachable in the extension, so session-scope validation belongs there, with pure identity/compat policy in `lib/pi-tools.mjs` beside `resolveRoleModel`.
- `lib/views/settings.mjs` renders supplied state only (`architecture/workflow-state-ownership`): it marks unlisted or route-incompatible values from data the payload carries, and never re-derives compatibility.
- When the registry is genuinely unavailable, the free-text fallback in `lib/views/settings.mjs` must say so, so it cannot be mistaken for a validated field.
- Add an agent-facing usage section to `templates/format.md` — already copied verbatim into every bundle, so it stays self-describing when moved out of the repo (`decisions/okf-markdown-bundle`).
- `/iterator-init` writes it; `/iterator-consolidate` verifies and repairs it, reusing the existing stale-anchor repair pass rather than a new mechanism (`architecture/knowledge-lifecycle`).
- Canonical `lib/` edits run `npm run sync` (`decisions/synced-droppable-skill-libs`).

# Dependencies

(none)

# Key decisions

- Validation stays structural: compare a configured `provider/id` against the session registry and the active runtime model's route. Do not probe providers and do not hard-code the `proxy-managed` sentinel — this upholds `decisions/work-first-plan-start-and-runtime-model-reuse`.
- A mismatch warns and blocks the save rather than silently rewriting the user's provider, because auto-correcting `openai/...` to `openai-codex/...` would guess at intent.
- Runtime behavior is unchanged: `resolveRoleModel`'s active/restore/registry precedence and `decisions/safe-role-model-restoration`'s arm-only-on-success rule stay exactly as they are. This plan makes bad configuration visible earlier; it does not alter fallback.
- This extends `decisions/polish-dashboard-and-multi-agent-workflows` (settings limited to models available in the current session scope) — availability proved insufficient, since both `openai/...` and `openai-codex/...` list as available while only one carries the managed route.
- The bundle usage guide documents the deterministic-writer rule as a first-class constraint, so a no-extension agent does not hand-edit machine-owned files.
- No new settings keys, workflow statuses, external dependencies, or visual redesign.

# Features

* [Teach the bundle to explain its own use](/features/self-describing-bundle-usage.md) - Every bundle carries agent-facing usage rules, written at init and drift-checked during consolidate without the dashboard.
* [Reject unusable role models at save time](/features/validate-role-model-on-save.md) - Saving a role model that cannot work in the current session is refused with a named reason instead of failing later as a provider 401.
* [Show unusable model choices in settings](/features/flag-unusable-model-fields.md) - The settings model fields visibly mark a value the current session cannot use, and say so when the registry is unavailable.
