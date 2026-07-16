# pi mode (all iterator/iterator-knowledge skills)

If the tools `iterator_gather` / `iterator_write` / `iterator_ui` are
available, use them instead of the shell pipelines in the SKILL.mds. Steps,
result payloads, and rules are unchanged — only the transport differs:

- `iterator_ui { step: "<step>", feature?: "<slug>", extra?: {...} }` gathers
  the step payload itself and shows the view in the **session dashboard**
  (one persistent browser tab — no per-round server), then returns the user's
  answer. Never pass gathered data to it; `extra` is the one place your
  semantic draft travels (e.g. plan sections, test `cases`, commit-mode
  `memory` proposals + per-feature `tests`). For the plan step, put
  `"apply": true` inside `extra` — an approved plan is then written by the
  deterministic writer before the result returns (it carries `applied`; on
  `applied.ok === false` fix the draft and re-open, never `iterator_write`
  the same sections again).
- `iterator_gather { step: "<step>", ... }` replaces a `gather.mjs` pipe.
- `iterator_write { ... }` replaces a `write.mjs` pipe — same op payloads.

The session dashboard shows four tabs — **Planning** (backlog, plan
lifecycle, dependency graph, feature set), **Work** (progress, escalation,
per-feature Test / Implement / Review), **Knowledge**, and **Usage**; the
plan/feature/archive steps render into the Planning tab. It stays clickable
while you are idle — a user click arrives as a new `/skill:iterator-*` turn,
which you handle per the target skill. In pi, `/iterator-next` implements
the next ready feature directly, and a bare `/iterator-implement` offers a
terminal feature picker.
