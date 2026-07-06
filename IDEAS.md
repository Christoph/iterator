<!-- markdownlint-disable MD013 -->

# Ideas: deeper pi integration

Where iterator can go beyond the current "six command aliases + skills"
package. Context: the deterministic core now exists — `gather.mjs` computes
every step payload (`--step hub|plan|chunk|implement|test|review`) and
`write.mjs` owns every bundle write (`plan|chunks|update-chunk|adjustments`),
so the model only supplies semantic text. Everything below builds on that
split: **mechanical logic in scripts, semantic logic in the model** — and in
pi, the extension is the natural home for the mechanical side.

## 1. Register the scripts as real tools (`pi.registerTool`)

Today the skills shell out (`node <skill-dir>/../iterator/gather.mjs ...`).
An extension can register them as first-class tools instead:

- `iterator_gather` — params `{ step, chunk? }` (typebox-validated), returns
  the payload as structured tool output.
- `iterator_write` — params mirroring the write ops; validation errors surface
  as tool errors the model can react to, instead of a shell exit code buried
  in bash output.
- `iterator_ui` — takes a payload, POSTs it to the running UI server (see §3),
  returns the user's answer.

Why: typebox validation means the model *cannot* malform a payload the way it
can with an improvised heredoc; tool results are structured (no stdout
parsing); and pi can render a custom TUI widget per tool call (chunk table,
diff stats) via the tool's `details`.

## 2. Ambient bundle awareness (`session_start`, `before_agent_start`)

- On `session_start`, run the equivalent of `gather --step hub`; if a bundle
  exists, `ctx.ui.notify("iterator: 3/7 chunks done · next ready: auth-middleware")`.
- On `before_agent_start`, inject a one-paragraph bundle summary (plan title,
  progress, next ready chunk, red-test chunks) into the turn context so the
  agent never re-derives state — and knows mid-conversation work should go
  through the chunk flow.
- Keep it cheap: read `chunks/index.md` only; skip silently when there is no
  `memory/` bundle.

## 3. Session-scoped UI server instead of one-shot round trips

The single-instance-takeover machinery exists because each skill invocation
spawns its own short-lived server. In pi the extension owns the session
lifecycle, so it can do better:

- Start the server once in `session_start` (fixed port 7777), stop it in
  `session_shutdown`.
- The server holds a persistent dashboard; step payloads swap the view over
  SSE instead of restarting the process (the browser tab then *never*
  reloads, not even between steps).
- Skill invocations talk to it via `iterator_ui` (§1) or a tiny HTTP client —
  no takeover dance, no orphaned ports, no 2h-timeout processes.

## 4. Guardrails via `pi.on("tool_call")`

The bundle has invariants the writer enforces — protect them against direct
edits too:

- Intercept Write/Edit calls targeting `memory/chunks/*.md`: warn (or block)
  when the edit touches frontmatter that `write.mjs` owns (`status`,
  `tests_status`, `commits`, `timestamp`) and point the model at the
  `update-chunk` op. Body-text edits stay allowed — hand-editability is an
  OKF feature.
- Watch `git commit` bash calls while a chunk is in flight: if the message
  lacks a `Chunk: <slug>` trailer, warn before the commit runs (the trailer
  is the resilient chunk↔commit link).
- `status: done` set by anything other than an accept-commit flow → block and
  explain that `/iterator-implement` owns `done`.

## 5. Footer widget: chunk progress in the TUI

Like pi-powerline-footer: a segment showing `⛭ 3/7 · next: auth-middleware`
(done/total, next ready chunk, a 🔴 marker when red tests are waiting).
Refresh it from the `tool_call` hook whenever a write op ran, so it is always
current without polling.

## 6. TUI quick flows (`ctx.ui` selectors) — browser optional

The browser is the control plane, but some decisions are one keypress:

- `/iterator-implement` with no argument → `ctx.ui.select` over the ready
  chunks (from `gather --step implement`) right in the terminal.
- Plan/test approval could offer a "quick approve" confirm in the TUI with
  "open in browser" as the escape hatch for real review.
- `/iterator` without a browser (SSH session, no forward): render the
  dashboard as a TUI widget from the same hub payload.

## 7. Server applies mechanical UI results itself

`write.mjs` already accepts the chunk UI's `plan-adjustments` output verbatim.
Next step: the *server* invokes the writer directly for purely-mechanical
result types (adjustments, approvals that only flip state) and only returns
the semantic residue (comments, split/merge requests) to the agent. The
agent's loop shrinks to: draft text → user interacts → react to comments.
Combined with §3 the UI becomes self-service for everything that doesn't need
the model.

## 8. `iterator_validate` / OKF lint

A `validate` op (or standalone `validate.mjs`): frontmatter parseable +
non-empty `type`, acyclic `depends_on` referencing real files, bundle-absolute
links resolve, indexes not stale. Run it:

- as a tool the model can call after manual edits,
- from the `tool_call` hook after any Write into `memory/`,
- in CI (`npm test` already guards the writer; this guards hand edits).

## 9. Prompt templates (`prompts/`)

Ship pi prompt templates for the flow's entry points, e.g. `/plan-from-issue
<url>` (fetch issue → seed `gather --step plan` skeleton → open the plan UI)
or `/iterator-status` (one-paragraph summary from the hub payload). Cheap to
add — the `pi` manifest already supports `"prompts"`.

## 10. Distribution

- Publish to npm (`pi install npm:iterator` — the `pi-package` keyword is
  already set) so installs don't need a local path or git clone.
- Tag releases (`v1.x`) so `pi update --all` works predictably.
- Optional: a second, thin package (`iterator-tools`) exposing only §1's
  tools for people who want the bundle format without the browser UI.

## Sequencing

§1 and §2 are small and independent — do them first (§1 makes every other
integration cleaner). §3 unlocks §7. §4/§8 harden what already ships. §5/§6
are polish. §10 when the above has settled.
