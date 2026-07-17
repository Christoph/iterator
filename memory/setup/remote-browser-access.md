---
type: Setup
title: Remote browser access
description: Container, sbx, SSH, and devcontainer runs need host-facing port forwarding for the browser UI, and a dual-stack bind so localhost works.
tags: [remote, docker, ports]
  - remote
  - docker
  - ports
files: ["lib/server.mjs", "lib/server/env.mjs", "lib/server/listen.mjs", "README.md"]
  - lib/server.mjs
  - README.md
timestamp: "2026-07-17T10:07:11.513Z"
---

# Remote sessions

When the agent runs inside a container or SSH session, `isRemoteSession()` detects it (explicit `ITERATOR_REMOTE=1/0` override first, then SSH markers, then `/.dockerenv` / `/run/.containerenv`). In remote mode the server binds `::` (override `ITERATOR_BIND_HOST`), skips the browser opener, and prints a `http://127.0.0.1:7777/` URL for the host.

The bind is `::`, not `0.0.0.0`, because `::` is the dual-stack wildcard — one socket answers both families. A sandbox with an IPv6 address publishes **two** loopback forwards (`127.0.0.1:<host>->7777` and `::1:<host>->7777`); an IPv4-only listener leaves the v6 one resetting, and a reset (unlike a refusal) stops browsers falling back to IPv4. The symptom is `http://localhost:<port>/` failing on the host while `http://127.0.0.1:<port>/` works — see [[ipv4-only-bind-breaks-localhost]]. Where there is no IPv6 stack, `listenWithTakeover` downgrades to `0.0.0.0` on its own.

The port must be published to the host loopback: `sbx ports <sandbox> --publish 7777:7777`, `docker run -p 127.0.0.1:7777:7777`, or `ssh -L 7777:localhost:7777`. MicroVM sandboxes have no container marker files — set `ITERATOR_REMOTE=1` in the image. Everything (Work and Knowledge views) runs on the one 7777 server; the former okf-memory port 8888 is gone.

Binding `::` exposes the UI to the sandbox network: keep the host-side publish on loopback; the localhost Host-header check is relaxed in this mode and there is no auth token.
