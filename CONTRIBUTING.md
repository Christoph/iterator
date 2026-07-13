# Contributing to iterator

## Development setup

```bash
git clone <repo>
cd iterator
# No npm install needed — the server uses only Node built-ins (Node ≥ 18).
```

## Testing the plugin locally

Load it into a Claude Code session with `--plugin-dir`:

```bash
claude --plugin-dir .
```

Then, in any git repo, run `/iterator` for the dashboard, or `/iterator-plan`
to start the flow (plan → chunk → implement → review). (For a persistent
install, use `/plugin marketplace add <path>` + `/plugin install iterator` —
the repo ships a `.claude-plugin/marketplace.json`. pi installs the repo as a
package: `pi -e .`, which also loads `extensions/iterator.js` for friendly
`/iterator…` commands.)

## Running the tests

```bash
npm test        # node:test — no dependencies
```

The suite unit-tests `lib/ui.mjs` (`embed`, `escHtml`, `renderPage`) and
boots the shared UI server on ephemeral ports to exercise the full
round-trip: view dispatch per `step`, page serve, `/submit` → stdout, the
Host-header rejection, the cancel grace period, the single-instance takeover,
and signal handling. Tests set `ITERATOR_NO_OPEN=1` (no browser),
`ITERATOR_CANCEL_GRACE_MS` (short grace), and a private `ITERATOR_REGISTRY`
per spawn — all work outside tests too.

## Previewing the UIs in a browser

The shared server reads a JSON payload from stdin, picks the view from its
`step` field, and opens the browser. Sample payloads are wired up as npm
scripts:

```bash
npm run preview:hub            # /iterator          dashboard (control plane)
npm run preview:plan           # /iterator-plan     plan-review view
npm run preview:chunk          # /iterator-chunk    chunk-plan view (graph, cards, split/merge)
npm run preview:review         # /iterator-review   chunk-grouped diff review
npm run preview:test           # /iterator-test     test-plan view
npm run preview:knowledge      # /okf               knowledge plane dashboard
npm run preview:memory-review  # /okf-*             memory card review
```

Each opens `http://127.0.0.1:7777/` (watch stderr for the real URL if a
foreign process holds the port). A preview replaces any iterator server that
is still running — that is the single-instance takeover working as designed.
`/iterator-implement` has no view of its own — it drives the review view in
`"mode": "commit"`.

## Repository structure

```
iterator/
├── .claude-plugin/plugin.json   # manifest (name: iterator; skills auto-discovered)
├── extensions/iterator.js       # pi extension: /iterator… commands → /skill:iterator…
├── lib/                         # SOURCE OF TRUTH — synced into skills/iterator/lib/ (npm run sync)
│   ├── app.mjs                  # control plane: view dispatch, one-command gather, onSubmit hooks
│   ├── server.mjs               # shared HTTP server: stdin→JSON, /submit + /cancel, takeover, timeout
│   ├── gather.mjs               # deterministic state gathering (--step …)
│   ├── write.mjs                # deterministic bundle writer (--schema lists op payload shapes)
│   ├── git.mjs / bundle.mjs     # git helpers; frontmatter/index/log primitives + validation
│   ├── ui.mjs                   # shared page shell + "ink & ember" design tokens
│   └── views/                   # one view module per step: hub, plan, chunk, test, review,
│                                #   knowledge, memory-review
├── skills/
│   ├── iterator/                # hub skill — thin shims (server/gather/write) + bundled lib/ + PI.md
│   ├── iterator-plan/           # SKILL.md (logic only) + templates/format.md
│   ├── iterator-chunk/          # SKILL.md (logic only)
│   ├── iterator-implement/      # SKILL.md (logic only; uses the review view in commit mode)
│   ├── iterator-design/         # SKILL.md (logic only; design params + UI quality rules)
│   ├── iterator-review/         # SKILL.md (logic only)
│   ├── iterator-test/           # SKILL.md (logic only)
│   └── okf, okf-init, …         # knowledge plane skills + shared okf/PROTOCOL.md
├── templates/format.md          # SOURCE OF TRUTH — bundle schema, copied into every memory/ bundle
├── scripts/sync.mjs             # copies lib/ (+views) into the hub skill (npm run sync)
├── docs/OKF_SPEC.md             # Open Knowledge Format v0.1 spec
├── test/                        # node:test suite (npm test, no dependencies)
├── .github/workflows/ci.yml     # runs the tests on push/PR
├── ARCHITECTURE.md
└── README.md
```

The **UI lives only in the hub skill**: `skills/iterator/` carries thin shims
(`server.mjs`, `gather.mjs`, `write.mjs`) plus the bundled cores and views
(`skills/iterator/lib/`); the step skills are logic-only and invoke the hub's
scripts as `<skill-dir>/../iterator/<name>.mjs`, so the skill folders must be
installed together. The repo-root `lib/` and `templates/` are the source of
truth: edit those, then run `npm run sync` to refresh the bundled copies.
`test/sync.test.mjs` fails if they drift.

Run `npm run hooks:install` once after cloning — it points `core.hooksPath`
at `scripts/githooks/`, whose pre-commit hook runs the sync and stages the
refreshed copies, so drift can never be committed. The sync test remains the
CI backstop for clones that skip the hook.

## File structure

- **`skills/<name>/SKILL.md`** — instructs Claude how to run the skill: the
  steps, the payload to pipe into the shared server, and how to handle the
  server's output (including how it reads/writes the `memory/` bundle).
- **`lib/app.mjs`** — the control plane (invoked through the
  `skills/iterator/server.mjs` shim): parses the stdin payload, gathers
  in-process when it is the one-command form (`{"gather":true,"step":…}`),
  picks the view module from `payload.step`, attaches per-step cancel/timeout
  `report` strings, dispatches action results to their owning `skill`, and
  calls `serve()`.
- **`lib/views/<step>.mjs`** — a thin step-specific view: exports
  `render(data)` supplying a body renderer + step-specific browser JS. All
  shared chrome (header, theme, CSS variables, `esc`, `mdToHtml`, the `post()`
  submit helper, the Accept ↔ Send review flip) comes from `lib/ui.mjs` via
  `renderPage()`.
- **`skills/iterator/lib/`** — the hub skill's private copy of the shell and
  views, generated by `npm run sync`. Never edit it directly; edit the
  repo-root `lib/` instead.

## Changing the shared UI

Header, theme toggle, CSS variables, the markdown renderer, and the
submit/cancel/timeout/takeover behavior all live in the repo-root `lib/ui.mjs`
and `lib/server.mjs` — edit them there, run `npm run sync`, and every view
changes together. Step-specific markup, CSS, and JS live in that step's
`lib/views/<step>.mjs`. The shared `embed()` escapes `<` so payload data
containing `</script>` can't break the page.

## Changing the port

The port defaults to `7777`; override it with the `ITERATOR_PORT` environment
variable (the default lives once in `lib/server.mjs`). The port is stable
across runs: a lingering iterator server is shut down and replaced
(single-instance takeover; `ITERATOR_NO_TAKEOVER=1` disables it). Only a
foreign process on the port makes the server walk up — the real URL is always
printed to stderr. Keep the fixed port in sync with any sandbox port forward
(pi-docker-sandbox-setup publishes `7777:7777`).

## Skill invocation flow

1. Claude runs the skill's steps (bundle/git state comes from `gather.mjs` —
   never read by hand).
2. Claude pipes a payload to the hub's `server.mjs` — usually the one-command
   form `{"gather":true,"step":"<step>","extra":{…}}` (the server gathers the
   base payload itself and merges the agent-authored `extra`); nothing is
   written to `/tmp`.
3. The server replaces any lingering iterator server, serves the page, opens
   the browser, and blocks until submit.
4. Claude reads the stdout JSON and records results through `write.mjs`
   (`--schema <op>` prints any op's payload shape), then re-runs for the next
   round.

## Adding a new skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`).
2. If it needs a UI, add `lib/views/<step>.mjs` exporting `render(data)`,
   register it in the `VIEWS` map of `lib/app.mjs` (and the COPIES list in
   `scripts/sync.mjs`), and run `npm run sync`. The SKILL.md then pipes its
   payload (with the new `step`) into `<skill-dir>/../iterator/server.mjs`.
3. Restart the session with `claude --plugin-dir .` (or reinstall via the
   marketplace) to pick up the new skill.
