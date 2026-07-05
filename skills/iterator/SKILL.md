---
name: iterator
description: Open the iterator dashboard — a browser home screen showing the plan, every chunk with status/size/test badges, and the dependency graph, with per-chunk Test / Implement / Review buttons. Dispatches the chosen action into the matching iterator flow and reopens the dashboard afterwards. Use when the user types /iterator, wants an overview of plan/chunk state, or wants to drive the flow from one place.
---

# iterator (hub)

The home screen of the flow: **plan → chunk → (optional red tests) → implement
→ review**. One dashboard shows where everything stands; the user picks a
chunk and an action instead of remembering which skill comes next. This skill
is a **thin router** — it gathers state, opens the dashboard, and dispatches
into the existing per-step flows. It never duplicates their steps.

## When to use this skill

When the user types `/iterator`, asks for an iterator overview / dashboard, or
wants to drive the flow from one place.

If the user's message contains a hub result payload (`action`, `cancel`,
`timeout`), process it per step 3.

## Steps

### 1. Gather state

Resolve the bundle (`git rev-parse --show-toplevel`; `<root>/memory` or
`$ITERATOR_MEMORY_DIR` relative to the git root).

- **No bundle** → payload with `"plan": null` (the UI shows a Create-plan
  hero); skip to step 2.
- Read `memory/plan.md` frontmatter (`title`, `status`) and
  `memory/chunks/index.md`, then each chunk file's frontmatter: `title`,
  `description`, `status`, `size`, `lines_estimate`, `tests_status`,
  `depends_on`, `commits`, `files`.
- Compute per chunk:
  - `hasDiff` — any file in `git diff HEAD --name-only` (falling back to
    `git diff --name-only`) matches the chunk's `files` globs.
  - `hasCommits` — the chunk has validated `commits` entries, **or**
    `git log --format=%H --grep='^Chunk: <slug>$'` finds any (the trailer is
    the resilient lookup; recorded shas go stale on rebase).

### 2. Open the dashboard

```sh
node <skill-dir>/server.mjs << 'HUB_DATA'
{
  "step": "hub",
  "branch": "<branch>",
  "plan": { "title": "<plan title>", "status": "approved" },
  "progress": { "done": 1, "total": 3 },
  "chunks": [
    {
      "name": "auth-middleware", "title": "Auth middleware",
      "description": "JWT-based auth middleware for protected routes.",
      "status": "pending", "size": "small", "linesEstimate": 60,
      "testsStatus": "red", "dependsOn": ["config-module"],
      "hasDiff": false, "hasCommits": false
    }
  ]
}
HUB_DATA
```

The UI renders the plan bar (status, progress, **Revise plan** / **Re-chunk**),
the dependency graph (with cycle warning), and one card per chunk with 🔴/🟢
test badges and three buttons — **Implement** (enabled only when pending and
all `depends_on` are done), **Test** (always; labeled "Test (red)" on pending
chunks), **Review** (enabled when `hasDiff || hasCommits`). There is no header
primary; the card buttons are the actions.

### 3. Dispatch the action

The server prints one JSON line. For
`{ "type": "action", "action": "...", "chunk": "<slug>|null" }`, dispatch:

| action | run |
|---|---|
| `plan` | the `/iterator-plan` flow (create or revise) |
| `chunk` | the `/iterator-chunk` flow (re-chunk; preserves done chunks) |
| `test` | the `/iterator-test` flow for that chunk — it picks red/green mode from the chunk's `status` itself |
| `implement` | the `/iterator-implement` flow pinned to that chunk |
| `review` | the `/iterator-review` flow for that chunk |

Follow the target skill's own SKILL.md from its first step — do not restate
its logic here. **Re-validate before acting**: the dashboard can be stale, so
`implement` must still check the chunk's `depends_on` are all `done` (the
target flow does this; let it). If a dispatched action is invalid by the time
it arrives, report why and reopen the dashboard.

For `{ "type": "cancel" }` / `{ "type": "timeout" }`: stop and print a short
state summary (done/total, next ready chunk).

### 4. Loop

When the dispatched flow finishes — success, feedback resolved, or the user
declined — re-gather state (step 1) and re-open the dashboard (step 2). The
dashboard is the resting point between actions; one-shot round trips, no
long-running server.

## Relationship to the other skills

- This skill routes; `/iterator-plan`, `/iterator-chunk`, `/iterator-test`,
  `/iterator-implement`, `/iterator-review` do the work and stay directly
  invocable without the hub.
- State lives in the `memory/` bundle; the dashboard renders only what the
  chunk files say (`memory/format.md` is the schema).
