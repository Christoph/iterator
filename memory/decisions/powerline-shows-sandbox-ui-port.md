---
type: Decision
title: Powerline shows the sandbox-published UI port
description: "The footer trails a ui:PORT segment resolved from ITERATOR_DISPLAY_PORT, falling back to ~/.pisbx-env because sbx run never sources it into pi's environment."
status: accepted
date: 2026-07-17
tags: [powerline, footer, sandbox, ports, pi]
files: ["extensions/iterator.js", "lib/pi-tools.mjs", "test/pi-tools.test.mjs"]
timestamp: "2026-07-17T09:42:51.218Z"
---

# Decision

Show the host-reachable UI port as the rightmost footer segment (`🌐 ui:49159`), styled like the `🧠 N unmemorized` segment beside it. `uiPort()` in `lib/pi-tools.mjs` resolves it: prefer `ITERATOR_DISPLAY_PORT`, else parse `ITERATOR_DISPLAY_PORT=<n>` out of `~/.pisbx-env`. `footerText()` appends it last, and it renders even when no bundle exists.

# Rationale

There is one agent per sandbox and each gets its own host port, so with several running the user cannot tell which port reaches which agent's UI. The in-sandbox listen port (7777) is not what the host browser opens, so the published host port is the only useful thing to show.

The file fallback is not belt-and-braces — it is load-bearing. pisbx writes `~/.pisbx-env`, and the image's `.bashrc` sources it only on the interactive path (`if [[ $- == *i* ]] ... exec pi -a`). `sbx run` execs `pi` directly, so `.bashrc` never runs and the variable never reaches the process — verified against a live sandbox, where pi's `/proc/<pid>/environ` had `ITERATOR_REMOTE=1` but no `ITERATOR_DISPLAY_PORT`. `sbx run`/`create` have no `--env` flag, so there is no CLI way to inject it. Reading the file is what makes the segment work at all.

The port is a property of the agent, not of the plan, so it is not gated behind bundle or plan state — that would hide it in exactly the sessions with nothing else in the segment.

Rejected: carrying it in the Claude Code statusline (`~/.claude/statusline-command.sh`) — host-side and per-user rather than per-agent, so it cannot distinguish agents, and it lives outside the repo instead of travelling with the extension.

Deferred: shimming `pi` in the image (pi-docker-sandbox-setup) so the variable is set however pi is launched. That is the cleaner fix and would repair [[displayPort]] too, but it needs an image rebuild and sandbox recreation.

# Consequences

Known gap: `displayPort()` in `lib/server/env.mjs` still reads the env var only, so inside a sandbox iterator keeps printing `http://localhost:7777/` instead of the host URL — the very thing pi-docker-sandbox-setup's README claims it fixes. Fixing that means either the image shim or teaching `displayPort()` the same fallback.

`uiPort(env, file)` takes both the env object and the file path as parameters so tests never touch the real `$HOME`. It swallows read errors and returns null — outside a sandbox there is no `~/.pisbx-env`, and a broken read must never take the footer down. `footerText()`'s fourth parameter defaults to null, so existing callers are unaffected.
