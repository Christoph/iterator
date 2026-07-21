---
type: Plan
title: Focus plan starts and preserve managed model authentication
description: Move active plan creation to Work immediately and preserve Pi runtime model routing when applying role settings.
status: approved
branch: iterator/safe-role-model-handoff
created: 2026-07-21
timestamp: 2026-07-21T13:59:28.635Z
---

# Goal

Make Iterator plan creation visibly move from Planning to the Work progress surface as soon as the planner starts, and make configured role models use Pi’s active runtime model/authentication safely so skill calls do not fail with the managed credential sent to a direct OpenAI endpoint.

# Architecture

- Extend the persistent dashboard dispatch seam in `extensions/iterator.js`: a Planning `plan` action intentionally refreshes and activates Work before showing the owned working overlay and dispatching `/skill:iterator-plan`; the later plan-review round may still activate Planning, and approval continues to land on Work, consistent with `architecture/browser-server-contract` and `decisions/review-navigation-and-work-context`.
- Harden role-model application in `extensions/iterator.js` around Pi’s current extension API: resolve a configured provider/id that matches `ctx.model` to that exact active runtime model object instead of replacing it with `modelRegistry.find(...)`, preserving host/proxy routing and credentials.
- Treat a resolved `pi.setModel()` call as success even when the modern API returns `void`; only an explicit legacy `false` result or a thrown error is failure. Keep restoration armed only after a real switch, preserving the FIFO/manual/auto ownership rules from `decisions/manual-role-models-and-runtime-reset` and `decisions/safe-role-model-restoration`.
- Keep pure model identity/resolution policy in `lib/pi-tools.mjs`, consume it from the extension, and run `npm run sync` so the shipped skill copy remains aligned with `architecture/package-and-skill-layout`.
- Add focused extension routing and model-lifecycle regressions for immediate Work activation, active runtime model preservation, void-return success, failure isolation, and one-time restoration; retain the existing full suite and design parameters without redesigning dashboard UI.

# Dependencies

(none)

# Key decisions

- Starting Plan from Planning is an intentional Work landing because the active agent overlay is Work-owned; ordinary dashboard refreshes still preserve the user’s selected tab.
- An exact provider/id match must retain `ctx.model` as the authoritative runtime model object so proxy/base-URL/auth metadata supplied by Pi is not discarded by a registry re-lookup.
- Follow Pi’s modern `setModel` contract: successful resolution may return `undefined`; failure is an exception, while explicit `false` remains supported for older runtimes.
- Do not probe providers or hard-code the `proxy-managed` credential sentinel; prevent the invalid direct-provider path structurally and leave genuinely unavailable alternate models on the current active model with a warning.
- No workflow statuses, settings keys, external dependencies, or visual redesign are introduced.

# Features

* [Activate Work when planning starts](/features/activate-work-on-plan-start.md) - Starting a plan from Planning immediately opens the Work progress surface while preserving the later plan review and approval landings.
* [Preserve runtime role-model authentication](/features/preserve-runtime-role-model.md) - Configured Iterator roles retain Pi’s active runtime model routing and correctly recognize modern void-returning model switches.
