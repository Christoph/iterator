---
type: Decision
title: Powerline shows the sandbox-published UI port
description: "The footer trails a ui:PORT segment read from ITERATOR_DISPLAY_PORT, so each sandboxed agent shows which host port its UI answers on."
status: accepted
date: 2026-07-17
tags: [powerline, footer, sandbox, ports, pi]
files: ["extensions/iterator.js", "lib/pi-tools.mjs", "test/pi-tools.test.mjs"]
timestamp: 2026-07-17T09:25:29.872Z
---

# Decision

Show the host-reachable UI port as the rightmost footer segment (`🌐 ui:53421`), styled like the `🧠 N unmemorized` segment beside it. `uiPort()` in `lib/pi-tools.mjs` reads `ITERATOR_DISPLAY_PORT` — the distinct host port pisbx publishes per sandbox — and `footerText()` appends it last. It renders even when no bundle exists.

# Rationale

There is one agent per sandbox and each gets its own host port, so with several running the user cannot tell which port reaches which agent's UI. `ITERATOR_DISPLAY_PORT` is the source of truth because the in-sandbox listen port (7777) is not what the host browser opens.

The port is a property of the agent, not of the plan, so it is not gated behind bundle or plan state — that would hide it in exactly the sessions with nothing else in the segment.

Rejected: carrying it in the Claude Code statusline (`~/.claude/statusline-command.sh`). That is host-side and per-user rather than per-agent, so it cannot distinguish agents, and it lives outside the repo instead of travelling with the extension.

# Consequences

`uiPort()` mirrors the validation in `displayPort()` (`lib/server/env.mjs`) — a positive integer or null — so keep the two consistent. The segment is absent outside a sandbox, where the listen port is already the host port. `footerText()`'s fourth parameter defaults to null, so existing callers are unaffected.
