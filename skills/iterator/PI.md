# pi mode (all iterator/okf skills)

If the tools `iterator_gather` / `iterator_write` / `iterator_ui` are
available, use them instead of the shell pipelines in the SKILL.mds. Steps,
result payloads, and rules are unchanged — only the transport differs:

- `iterator_ui { step: "<step>", chunk?: "<slug>", extra?: {...} }` gathers
  the step payload itself and shows the view in the **session dashboard**
  (one persistent browser tab — no per-round server), then returns the user's
  answer. Never pass gathered data to it; `extra` is the one place your
  semantic draft travels (e.g. plan sections, test `cases`, commit-mode
  `memory` proposals + per-chunk `tests`).
- `iterator_gather { step: "<step>", ... }` replaces a `gather.mjs` pipe.
- `iterator_write { ... }` replaces a `write.mjs` pipe — same op payloads.

The dashboard stays clickable while you are idle — a user click arrives as a
new `/skill:iterator-*` turn, which you handle per the target skill. In pi,
`/iterator-next` implements the next ready wave directly, and a bare
`/iterator-implement` offers a terminal chunk picker.
