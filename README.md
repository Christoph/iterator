# iterator

A Claude Code plugin that helps you iterate on code together with AI by forcing
work into small, reviewable **chunks**. You still lean on AI for planning and
implementation, but the unit of change stays human-reviewable (~200 lines),
dependency-ordered, and durable across sessions.

Inspired by [Plannotator](https://github.com/backnotprop/plannotator).

## The idea

Classical diff tools group changes by file. A developer's mental model is
organized around *what changed and why* — a unit of work often touches several
files at once. iterator makes the **chunk** the primary unit: a meaningful,
connected slice of implementation of roughly 200 lines, in dependency order.
Review-effectiveness research shows defect detection degrades past ~200–400
lines, so ~200 is a conservative, reviewable default.

Every step has a browser UI built on one shared shell, so all six UIs (the
dashboard and the five steps) look and behave the same, and all persistent
state lives in a `memory/` directory that is a conformant
[Open Knowledge Format (OKF) v0.1](docs/OKF_SPEC.md) bundle.

## The flow

```
/iterator            dashboard hub — plan, chunks, badges, dependency graph;
      │              pick a chunk, press Test / Implement / Review
      ▼
/iterator-plan       create/revise the plan            → memory/plan.md
      │  (accept auto-continues)
      ▼
/iterator-chunk      break the plan into chunks        → memory/chunks/<slug>.md
      │
      ├─ (optional) /iterator-test   write RED tests from the chunk's contract
      ▼
/iterator-implement  build the next dependency-ready chunk
      │              (drives the chunk's tests GREEN if they exist,
      │               auto-starts the review at the end)
      ▼
/iterator-review     chunk-vs-git-diff review          → outcome written into the chunk file

/iterator-test       after implementation: write green tests for a done chunk
```

- **`/iterator`** — the hub: a dashboard showing the plan, every chunk with
  status/size/🔴🟢-test badges, and the dependency graph. Per-chunk buttons
  (**Implement** only when dependencies are done, **Test** always, **Review**
  when there's a diff or recorded commits) dispatch into the flows below and
  the dashboard reopens when the action finishes.
- **`/iterator-plan`** — turn a goal into a plan in a browser plan-review UI
  (click-to-edit markdown sections, per-section comments, editable dependency
  chips). On accept it writes the `memory/` bundle and auto-continues into
  chunking.
- **`/iterator-chunk`** — split the plan into chunks, one OKF file each, in a UI
  with a dependency-graph visualization, snippets, drag-to-move files, and
  LLM-backed **Split**/**Merge**.
- **`/iterator-test`** — red/green, decided by the chunk's status: on a
  **pending** chunk it writes intentionally-failing tests from the chunk's
  contract (red — the goal implement drives to green); on a **done** chunk it
  writes passing tests against the real code. Either way it commits the tests
  (`test(<slug>)`) and records `tests`/`tests_status` in the chunk file.
- **`/iterator-implement`** — build the next chunk whose dependencies are all
  done; if the chunk has tests they are the definition of done (implement →
  run → fix until green, never weakening a test). Auto-opens the review UI
  scoped to the chunk — with the test badge visible — and on **Accept and
  commit** commits it (`chunk(<slug>)`), flips its status to done, and records
  the commit sha. If the [impeccable](https://github.com/pbakaus/impeccable)
  skill is installed, UI chunks get an `/impeccable audit` + `polish` pass
  before review.
- **`/iterator-review`** — standalone chunk-grouped diff review; records
  `reviewed`/notes into the chunk file. Done chunks are reviewable too — the
  diff is rebuilt from the chunk's recorded commits (or the `Chunk: <slug>`
  trailer). Never marks a chunk done.

## The `memory/` bundle

`/iterator-plan` creates a `memory/` directory in your project root. It is a
self-describing OKF v0.1 bundle — plain markdown with YAML frontmatter that you
can read and edit without any tooling:

```
memory/
├── index.md          # bundle root index (okf_version)
├── format.md         # the metadata schema, copied into every bundle
├── plan.md           # the plan (type: Plan)
├── log.md            # chronological history of what the AI did
└── chunks/
    ├── index.md      # chunk listing with status
    └── <slug>.md     # one document per chunk (type: Chunk)
```

An example chunk document:

```markdown
---
type: Chunk
title: Auth middleware
description: JWT-based auth middleware for all protected routes.
status: pending
size: small
lines_estimate: 60
depends_on: [config-module]
files: ["src/auth.ts", "src/middleware/*.ts"]
timestamp: 2026-07-02T10:00:00Z
tests: ["test/auth.test.ts"]
tests_status: red
---

# Implementation notes
Verify the token from the config secret; wrap protected routes.

# Depends on
* [Config module](/chunks/config-module.md) — needs the JWT secret from config.

# Blast radius
Every route behind the auth guard.
```

The chunk **slug** (the filename without `.md`) is the chunk's identity: its OKF
concept ID, its `depends_on` key, and its commit-message name. One file per chunk
means per-chunk git history and no fragile line-number indexes. The full schema
is in [`templates/format.md`](templates/format.md) (and in each bundle's
`memory/format.md`); see [`docs/OKF_SPEC.md`](docs/OKF_SPEC.md) for the format
itself.

## Chunk sizing

| Est. lines | Label | Color | Guideline |
|---|---|---|---|
| ≤ 100 | small | 🟢 green | Ideal — 10-minute review |
| 101–200 | medium | 🟡 yellow | Acceptable — 30-minute review |
| > 200 | large | 🔴 red | Should be split |

Size is estimated from the plan before code exists, so it is a soft target.
`/iterator-chunk` flags oversized chunks and offers Split; `/iterator-review`
warns on oversized diffs.

## Installation

### Claude Code

Load the plugin for a session with `--plugin-dir`:

```bash
claude --plugin-dir /path/to/iterator
```

To install it persistently, add the directory as a local marketplace and
install from it (inside Claude Code):

```
/plugin marketplace add /path/to/iterator
/plugin install iterator
```

All six skills (`/iterator` + the five `/iterator-*` steps) are auto-discovered
from `skills/*/SKILL.md`.

### Other agents (opencode, Codex CLI, pi, …)

The skills follow the [Agent Skills](https://code.claude.com/docs/en/skills)
standard, and every `skills/<name>/` folder is standalone — it bundles its own
copy of the shared UI shell (and `iterator-plan` bundles the OKF schema
template). Copy or symlink the skill folders into your harness's skills
directory:

```bash
# opencode                        # Codex CLI                      # pi
cp -R skills/* .opencode/skills/  cp -R skills/* .agents/skills/   cp -R skills/* ~/.pi/skills/
```

(opencode also discovers Claude-compatible paths like `.claude/skills/` and
`.agents/skills/` directly.) Invocation differs per harness — e.g.
`/skill:iterator-plan` in pi, a `$`-mention in Codex — and skills also trigger
implicitly by description. In sandboxed harnesses set `ITERATOR_NO_OPEN=1` to
print the UI URL instead of launching a browser.

## Requirements

- Node.js ≥ 18 (the servers use only Node built-ins — no `npm install` needed)
- Any agent that supports Agent Skills (Claude Code, opencode, Codex CLI, pi, …)
- A git repository (the `memory/` bundle is resolved relative to the git root)

## Configuration

Each interactive step runs a tiny local HTTP server bound to `127.0.0.1` that
opens a browser UI and prints your response back to Claude — no clipboard, no
temp files. The port defaults to **7777**; override it with `ITERATOR_PORT`:

```bash
ITERATOR_PORT=9000   # set in your shell
```

If the port is busy the server automatically picks the next free port and prints
the real URL. Set `ITERATOR_MEMORY_DIR` to relocate the bundle (resolved relative
to the git root). Set `ITERATOR_NO_OPEN=1` to print the URL without opening a
browser (useful for CI and remote sessions).

Each run's URL carries a one-time token; the server rejects any request without
it (and any non-localhost `Host` header), so no other page or process can forge
a submission or cancel your flow. Reloading the tab is safe — only closing it
cancels.

### Docker / sandboxed agents (`ITERATOR_HOST`)

When the agent runs inside a container but your browser is on the host, the
default `127.0.0.1` bind is unreachable. Set `ITERATOR_HOST=0.0.0.0` (dev
only!) inside the container and publish the port:

```bash
# inside the container / sandbox config
ITERATOR_HOST=0.0.0.0 ITERATOR_NO_OPEN=1 ITERATOR_PORT=7777

# on the host
docker run -p 7777:7777 …   # then open the printed http://127.0.0.1:7777/?t=… URL
```

Pin `ITERATOR_PORT` explicitly: if the port were busy the server's retry would
move to 7778, which your `-p 7777:7777` mapping would not reach. In exposed
mode the localhost `Host`-header check is relaxed (the host browser may arrive
via a container IP), but the one-time token stays mandatory — treat the URL
like a secret and use this only on trusted dev machines.

## How it works

1. A skill builds a JSON payload and pipes it to `skills/<step>/server.mjs` via a
   heredoc — nothing is written to `/tmp`.
2. The server serves a self-contained page (data embedded inline and safely
   escaped) and opens `http://127.0.0.1:<port>/?t=<one-time token>`.
3. On submit the browser POSTs structured JSON to `/submit`; the server prints it
   to stdout and exits. Closing the tab POSTs `/cancel`, emitting
   `{ "type": "cancel" }`, so a closed tab never leaves the flow hanging
   (reloads are grace-period-protected and don't cancel). A 2h idle emits
   `{ "type": "timeout" }`.
4. Claude reads stdout, updates the `memory/` bundle, and re-runs the server for
   the next round.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and
[docs/OKF_SPEC.md](docs/OKF_SPEC.md) for the bundle format.

## License

MIT
