<!-- markdownlint-disable MD013 -->

# Ideas: deeper pi integration

Where iterator can go beyond the current "six command aliases + skills"
package. Context: the deterministic core now exists — `gather.mjs` computes
every step payload (`--step hub|plan|feature|implement|test|review`) and
`write.mjs` owns every bundle write (`plan|features|update-feature|adjustments`),
so the model only supplies semantic text. Everything below builds on that
split: **mechanical logic in scripts, semantic logic in the model** — and in
pi, the extension is the natural home for the mechanical side.

## 1. Register the scripts as real tools (`pi.registerTool`) — ✅ shipped

Today the skills shell out (`node <skill-dir>/../iterator/gather.mjs ...`).
An extension can register them as first-class tools instead:

- `iterator_gather` — params `{ step, feature? }` (typebox-validated), returns
  the payload as structured tool output.
- `iterator_write` — params mirroring the write ops; validation errors surface
  as tool errors the model can react to, instead of a shell exit code buried
  in bash output.
- `iterator_ui` — takes a payload, POSTs it to the running UI server (see §3),
  returns the user's answer.

Why: typebox validation means the model *cannot* malform a payload the way it
can with an improvised heredoc; tool results are structured (no stdout
parsing); and pi can render a custom TUI widget per tool call (feature table,
diff stats) via the tool's `details`.

## 2. Ambient bundle awareness (`session_start`, `before_agent_start`) — ✅ shipped

(shipped as the `before_agent_start` hook: state line + concepts anchored to
recently touched files, injected with `display: false`; deduped per turn)

- On `session_start`, run the equivalent of `gather --step hub`; if a bundle
  exists, `ctx.ui.notify("iterator: 3/7 features done · next ready: auth-middleware")`.
- On `before_agent_start`, inject a one-paragraph bundle summary (plan title,
  progress, next ready feature, red-test features) into the turn context so the
  agent never re-derives state — and knows mid-conversation work should go
  through the feature flow.
- Keep it cheap: read `features/index.md` only; skip silently when there is no
  `memory/` bundle.

## 3. Session-scoped UI server instead of one-shot round trips — ✅ shipped

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

## 4. Guardrails via `pi.on("tool_call")` — ✅ shipped

The bundle has invariants the writer enforces — protect them against direct
edits too:

- Intercept Write/Edit calls targeting `memory/features/*.md`: warn (or block)
  when the edit touches frontmatter that `write.mjs` owns (`status`,
  `tests_status`, `commits`, `timestamp`) and point the model at the
  `update-feature` op. Body-text edits stay allowed — hand-editability is an
  OKF feature.
- Watch `git commit` bash calls while a feature is in flight: if the message
  lacks a `Feature: <slug>` trailer, warn before the commit runs (the trailer
  is the resilient feature↔commit link).
- `status: done` set by anything other than an accept-commit flow → block and
  explain that `/iterator-implement` owns `done`.

## 5. Footer widget: feature progress in the TUI — ✅ shipped

(shipped via `ctx.ui.setStatus('iterator', …)` — pi's footer and
pi-powerline-footer render extension statuses; includes the 🧠 unmemorized
segment and the /iterator-memorize nudge)

Like pi-powerline-footer: a segment showing `⛭ 3/7 · next: auth-middleware`
(done/total, next ready feature, a 🔴 marker when red tests are waiting).
Refresh it from the `tool_call` hook whenever a write op ran, so it is always
current without polling.

## 6. TUI quick flows (`ctx.ui` selectors) — browser optional — 🟡 partial
(shipped: bare `/iterator-implement` opens a TUI picker over the ready
features; `/iterator-next` implements the next ready feature directly)

The browser is the control plane, but some decisions are one keypress:

- `/iterator-implement` with no argument → `ctx.ui.select` over the ready
  features (from `gather --step implement`) right in the terminal.
- Plan/test approval could offer a "quick approve" confirm in the TUI with
  "open in browser" as the escape hatch for real review.
- `/iterator` without a browser (SSH session, no forward): render the
  dashboard as a TUI widget from the same hub payload.

## 7. Server applies mechanical UI results itself — 🟡 partial

(shipped: memory-review with `apply: true` is applied by the writer before
the result reaches the agent, results carry `applied` + `summary`; the
one-command form `{"gather":true,"step":…}` gathers in-process so the bash
path is a single pipe; hub/knowledge action results carry the owning `skill`.
Remaining: feature `plan-adjustments` still round-trips through the agent.)

`write.mjs` already accepts the feature UI's `plan-adjustments` output verbatim.
Next step: the *server* invokes the writer directly for purely-mechanical
result types (adjustments, approvals that only flip state) and only returns
the semantic residue (comments, split/merge requests) to the agent. The
agent's loop shrinks to: draft text → user interacts → react to comments.
Combined with §3 the UI becomes self-service for everything that doesn't need
the model.

## 8. `iterator_validate` / OKF lint — 🟡 partial

(shipped: `validateBundle` runs after **every** writer op and its result
rides along as `{validation}`; the guardrails hook (§4) covers direct edits.
Remaining: a standalone lint CLI/tool for hand edits outside a writer op.)

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

## 11. Dynamic tool loading (`pi.setActiveTools`) — keep context small

pi now supports dynamic tool loading
(<https://pi.dev/docs/latest/extensions#dynamic-tool-loading>):
`pi.registerTool()` works after startup too (inside `session_start`, command
handlers, other event handlers — new tools become available immediately), and
`pi.setActiveTools(names)` controls which registered tools are visible to the
LLM; only active tools land in the system prompt (`promptSnippet` /
`promptGuidelines`).

Today `extensions/iterator.js` registers all 4 tools unconditionally at load —
`iterator_gather`, `iterator_write` (~1.5k-char description alone), `okf_write`,
`iterator_ui`. In repos without a `memory/` bundle that is pure dead context
weight; even in iterator repos `okf_write` is only needed during memory-review
rounds and `iterator_write` only inside skill flows.

Sketch:

- **Bundle gate**: on `session_start`, activate the iterator tools only when
  `memory/index.md` exists in `ctx.cwd`; otherwise keep them inactive (or
  activate only a minimal entry point). `/iterator-init` must still work in a
  bare repo, so its command handler activates what it needs before running.
- **Per-flow activation**: each `/iterator-*` command handler calls a small
  `updateActiveTools()` helper to enable the tools its skill references
  (grep skills/*/SKILL.md + PROTOCOL.md for the mapping); `okf_write` only for
  the knowledge/review flows.
- **Re-check after writes**: `iterator_write` op results that create a bundle
  (init path) should trigger the same helper (the `invalidateSession()` hook
  is the natural place).
- **Robustness**: skills instruct the model to call these tools by name — an
  inactive tool means a failed call. Safest ladder: keep `iterator_gather`
  always active as the entry point and activate the rest whenever any
  `/iterator-*` command runs or a bundle is detected.

Reference example: `packages/coding-agent/examples/extensions/dynamic-tools.ts`
in the pi repo.

## Sequencing

§1 and §2 are small and independent — do them first (§1 makes every other
integration cleaner). §3 unlocks §7. §4/§8 harden what already ships. §5/§6
are polish. §10 when the above has settled.
