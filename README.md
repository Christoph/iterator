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

The browser UI is the **control plane**: one server (shipped with the
`/iterator` hub skill) renders every step's view — dashboard, plan review,
chunk breakdown, test plan, diff review — on one fixed port, and the step
skills are logic-only. All persistent state lives in a `memory/` directory
that is a conformant [Open Knowledge Format (OKF) v0.1](docs/OKF_SPEC.md)
bundle.

Everything mechanical is deterministic code, not prompt instructions: the hub
skill ships `gather.mjs` (computes every step's payload — bundle state, parsed
git diffs mapped to chunks, test-runner detection) and `write.mjs` (owns every
bundle write — frontmatter, timestamps, topological indexes, the update log,
cycle/reference validation). The model only supplies the semantic text: plan
prose, chunk descriptions, test cases, and the code itself. See `IDEAS.md`
for where this goes next as a pi extension.

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
standard. The `iterator` hub skill folder carries the whole UI (shared shell +
step views); the step skills are logic-only and call the hub's server, so
**always install the skill folders together** (`iterator-plan` additionally
bundles the OKF schema template). Copy or symlink them into your harness's
skills directory:

```bash
# opencode                        # Codex CLI                      # pi
cp -R skills/* .opencode/skills/  cp -R skills/* .agents/skills/   cp -R skills/* ~/.pi/skills/
```

(opencode also discovers Claude-compatible paths like `.claude/skills/` and
`.agents/skills/` directly.) Invocation differs per harness — e.g.
`/skill:iterator` or `/skill:iterator-plan` in pi, a `$`-mention in Codex —
and skills also trigger implicitly by description. SSH sessions and containers
are detected automatically: the server binds `0.0.0.0`, skips the browser
opener, and prints a URL to open on the host through a forwarded/published
port (see Configuration; force with `ITERATOR_REMOTE=1`).

**pi** can also install the repo directly as a package — the `pi` manifest in
`package.json` points at `skills/` and `extensions/`, so the install also
registers friendly `/iterator…` commands that forward to the skills:

```bash
pi install git:github.com/<user>/iterator@<tag>   # or: pi -e … for one session
```

iterator is designed to work alongside
[okf-memory](https://github.com/Christoph/okf-memory) (project memory, UI on
port 8888) and
[pi-docker-sandbox-setup](https://github.com/Christoph/pi-docker-sandbox-setup)
(a pi sandbox image that installs both packages, sets `ITERATOR_REMOTE=1` /
`OKF_REMOTE=1`, and forwards ports 7777 and 8888 to the host via its `pisbx`
script).

## Requirements

- Node.js ≥ 18 (the servers use only Node built-ins — no `npm install` needed)
- Any agent that supports Agent Skills (Claude Code, opencode, Codex CLI, pi, …)
- A git repository (the `memory/` bundle is resolved relative to the git root)

## Configuration

Every interactive step runs through one tiny local HTTP server (the hub
skill's `server.mjs`) bound to `127.0.0.1` that opens a browser UI and prints
your response back to Claude — no clipboard, no temp files. The port defaults
to **7777**; override it with `ITERATOR_PORT`:

```bash
ITERATOR_PORT=9000   # set in your shell
```

The port is **stable by design**: the server is single-instance — a lingering
iterator server from an earlier run (tracked in a per-user registry file,
verified via `/__iterator/status`) is shut down and replaced, so back-to-back
runs never drift to 7778. Only when a *different* program holds the port does
the server walk up and print the real URL (`ITERATOR_NO_TAKEOVER=1` disables
the takeover). Set `ITERATOR_MEMORY_DIR` to relocate the bundle (resolved
relative to the git root). Set `ITERATOR_NO_OPEN=1` to print the URL without
opening a browser (useful for CI and remote sessions).

The server rejects requests with a non-localhost `Host` header (DNS-rebinding
protection). Reloading the tab is safe — only closing it cancels.

### Remote sessions: SSH, Docker, devcontainers (`ITERATOR_REMOTE`)

When the agent runs inside a container or SSH session but your browser is on
the host, a `127.0.0.1` bind is unreachable through a port forward and there
is no local browser to open. The server detects this automatically — explicit
`ITERATOR_REMOTE=1`/`0` override first, then SSH markers (`SSH_TTY`,
`SSH_CONNECTION`), then container markers (`/.dockerenv`,
`/run/.containerenv`) — and in remote mode binds `0.0.0.0` (override with
`ITERATOR_BIND_HOST`), skips the browser opener, and prints a
`http://127.0.0.1:<port>/` URL for the host. MicroVM sandboxes have no
container marker files, so set `ITERATOR_REMOTE=1` in the sandbox image there
(pi-docker-sandbox-setup's image already does):

```dockerfile
ENV ITERATOR_REMOTE=1
```

The sandbox must also publish the port to the host:

```bash
sbx ports <sandbox> --publish 7777:7777      # Docker sandboxes (explicit host:container!)
docker run -p 127.0.0.1:7777:7777 …          # plain Docker — keep the host side on loopback
ssh -L 7777:localhost:7777 host              # plain SSH (or LocalForward in ~/.ssh/config)
```

(VS Code devcontainers and Codespaces forward ports automatically — check the
Ports tab.) Then open the printed URL in the host browser. The single-instance
takeover keeps the server on 7777 across runs, so a `7777:7777` mapping keeps
working; the stderr line always shows the real port in the rare case a foreign
process forces a walk. Binding `0.0.0.0` exposes the UI to whatever network
the sandbox is attached to: keep the host-side publish on loopback (the
localhost `Host`-header check is relaxed in this mode because the host browser
may arrive via a container IP, and there is no auth token — anyone who can
reach the port can answer as you).

## How it works

1. A skill builds a JSON payload (with a `step` field picking the view) and
   pipes it to `skills/iterator/server.mjs` via a heredoc — nothing is written
   to `/tmp`.
2. The server shuts down any lingering iterator server, binds the fixed port,
   serves a self-contained page (data embedded inline and safely escaped), and
   opens `http://127.0.0.1:<port>/`.
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
