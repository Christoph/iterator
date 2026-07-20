---
type: Plan
title: Focus feature execution and dashboard ownership
description: Start each implementation in a minimal fresh session and make Work the single active-plan surface with clear red-test and modal settings state.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-20
timestamp: 2026-07-20T13:48:00.101Z
---

# Goal

Make every manual or automatic feature implementation start with a clean Pi session containing only the deterministic feature contract and relevant project knowledge, while simplifying the dashboard so Work owns all active-plan information, Settings opens reliably as a modal from any tab, and committed red tests are unmistakable before implementation.

# Architecture

- Build on `architecture/package-and-skill-layout` and Pi's documented session-replacement lifecycle: route manual, ready-wave, and auto implementation dispatch through an extension command that uses `ExtensionCommandContext.newSession()`, then send only `/skill:iterator-implement <slug>` plus required mode/guidance in the replacement-session context. The implement gather contract, relevant memories, and recorded test paths remain the source of necessary context; prior conversation history is not copied.
- Preserve `architecture/workflow-state-ownership`: durable plan/feature/auto state remains in the bundle and `lib/status.mjs`/gather payloads. Intentional implementation-session replacement must resume the named feature without being mistaken for an interrupted auto run, losing a fixed-wave item, or bypassing dependency and review gates.
- Consolidate active-plan presentation in `lib/views/hub.mjs`: progress, dependency graph, feature actions, revise/re-feature/review-plan/retire/cancel controls, and escalation all live on Work. `lib/views/planning.mjs` becomes the future-work surface for plan creation, selected backlog candidates, and retired-plan browsing when no active work needs management.
- Let `lib/session-server.mjs` own navigation and modal presentation: approved plan/feature transitions intentionally activate Work, while Settings renders in a shell-level modal above whichever tab is open, preserves the originating tab and any pending round, and closes back to that exact context.
- Make red-test state explicit across gather, Work cards, and implementation kickoff: after `/iterator-test`, show that failing tests are committed and expected, expose the recorded test paths/status to the implementer, and label the implementation action as the green step rather than as a generic pending feature.
- Keep all UI changes within `memory/design.md` (compact dark control plane, semantic status colors, responsive controls), retain inline-script parse coverage for `pitfalls/client-js-template-literal-escaping`, and run `npm run sync` after canonical `lib/` changes.

# Dependencies

(none)

# Key decisions

- Use a real fresh Pi session for each feature implementation, not compaction or a conversation summary. Record the previous session as lineage if useful, but inject no old chat; deterministic gather data is the complete handoff.
- Fresh-session routing applies to explicit manual implementation, fixed ready waves, and auto-mode implementation steps. Testing and review stay in their existing turns unless they independently dispatch a new feature implementation.
- Explicitly revise `decisions/review-navigation-and-work-context`: active plan lifecycle controls move from Planning to Work so Planning contains only future/backlog/archive concerns. This accepted deviation must be captured by `/iterator-memorize` after implementation.
- Explicitly revise `decisions/settings-close-returns-to-work`: Settings becomes a tab-independent modal and closes to its originating tab/context instead of always forcing Work. This accepted deviation must be captured by `/iterator-memorize` after implementation.
- Keep `decisions/backlog-planning-and-feature-waves` and `decisions/parallel-feature-waves-and-consolidated-review`: fresh sessions must not change the immutable ready-wave snapshot, single-model-flow guard, commit attribution, or explicit review acceptance.
- Red remains an expected pre-implementation state: never weaken or auto-fix those tests during test creation; the fresh implementer receives their paths and is responsible for driving them green.

# Features

* [Fresh implementation session](/features/fresh-implementation-session.md) - Start every manual, ready-wave, and automatic feature implementation in a new Pi session seeded only with the named feature command and deterministic bundle context.
* [Active plan workspace](/features/active-plan-workspace.md) - Make Work the complete home for an active plan and land there after plan or feature approval, while Planning stays focused on future work and archives.
* [Settings dashboard modal](/features/settings-dashboard-modal.md) - Open project Settings as a modal above any dashboard tab and return to the exact originating context on save or close.
* [Visible red-test handoff](/features/visible-red-test-handoff.md) - Show committed red tests as the implementation target in Work and carry their exact status and paths into the fresh implementer context.
