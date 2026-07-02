# Contributing to iterator

## Development setup

```bash
git clone <repo>
cd iterator
# No npm install needed — the servers use only Node built-ins (Node ≥ 18).
```

## Testing the plugin locally

Install it as a local plugin in Claude Code:

```bash
claude plugins install .
```

Then, in any git repo, run `/iterator-plan` to start the flow (plan → chunk →
implement → review), or `/iterator-test` for chunk-level tests.

## Testing the servers directly

Each step's UI server reads a JSON payload from stdin and opens the browser.
Sample payloads are wired up as npm scripts:

```bash
npm run test:plan-server     # /iterator-plan   plan-review UI
npm run test:chunk-server    # /iterator-chunk  chunk-plan UI (graph, cards, split/merge)
npm run test:review-server   # /iterator-review chunk-grouped diff review
npm run test:test-server     # /iterator-test   test-plan UI
```

Each opens `http://127.0.0.1:8888` (or the next free port; watch stderr for the
real URL). `/iterator-implement` has no server of its own — it drives the review
server in `"mode": "commit"`.

## Repository structure

```
iterator/
├── .claude-plugin/plugin.json   # manifest (name: iterator; skills auto-discovered)
├── lib/
│   ├── server.mjs               # shared HTTP server: stdin→JSON, /submit + /cancel, timeout, port retry
│   └── ui.mjs                    # shared page shell: header, theme, CSS vars, esc/mdToHtml, embed, post
├── skills/
│   ├── iterator-plan/           # SKILL.md + server.mjs (plan-review UI)
│   ├── iterator-chunk/          # SKILL.md + server.mjs (chunk-plan UI)
│   ├── iterator-implement/      # SKILL.md only (reuses the review server in commit mode)
│   ├── iterator-review/         # SKILL.md + server.mjs (chunk-grouped diff review; commit mode)
│   └── iterator-test/           # SKILL.md + server.mjs (test-plan UI)
├── templates/format.md          # bundle schema, copied into every memory/ bundle
├── docs/OKF_SPEC.md             # Open Knowledge Format v0.1 spec
├── ARCHITECTURE.md
└── README.md
```

## File structure per skill

- **`SKILL.md`** — instructs Claude how to run the skill: the steps, the payload
  to pipe into the server, and how to handle the server's output (including how
  it reads/writes the `memory/` bundle).
- **`server.mjs`** — a thin step-specific view: it parses the stdin payload,
  provides a body renderer + step-specific browser JS, and calls `serve()` from
  `lib/server.mjs`. All shared chrome (header, theme, CSS variables, `esc`,
  `mdToHtml`, the `post()` submit helper, the Accept ↔ Send review flip) comes
  from `lib/ui.mjs` via `renderPage()`.

## Changing the shared UI

Header, theme toggle, CSS variables, the markdown renderer, and the
submit/cancel/timeout behavior all live in `lib/ui.mjs` and `lib/server.mjs` —
edit them there and every step changes together. Step-specific markup, CSS, and
JS live in that step's `server.mjs`. The shared `embed()` escapes `<` so payload
data containing `</script>` can't break the page.

## Changing the port

The port defaults to `8888`; override it with the `ITERATOR_PORT` environment
variable (the default lives once in `lib/server.mjs`). A busy port is handled
automatically — the server retries the next port and prints the real URL.

## Skill invocation flow

1. Claude runs the skill's steps (reads the `memory/` bundle and git state).
2. Claude builds a JSON payload and pipes it to `server.mjs` via a heredoc —
   nothing is written to `/tmp`.
3. The server serves the page, opens the browser, and blocks until submit.
4. Claude reads the stdout JSON, updates the `memory/` bundle, and re-runs for
   the next round.

## Adding a new skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`).
2. If it needs a UI, create `skills/<name>/server.mjs` that imports
   `readPayload`/`serve` from `../../lib/server.mjs` and `renderPage` from
   `../../lib/ui.mjs`, and supplies a step-specific `body` + `clientJs`.
3. Reinstall the plugin: `claude plugins install .`
