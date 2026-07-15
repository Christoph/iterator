---
type: Setup
title: Remote browser access
description: Container, sbx, SSH, and devcontainer runs need host-facing port forwarding for the browser UI.
tags:
  - remote
  - docker
  - ports
files:
  - lib/server.mjs
  - README.md
timestamp: 2026-07-06T19:11:28.965Z
---

# Remote sessions

When the agent runs inside a container or SSH session, `isRemoteSession()` detects it (explicit `ITERATOR_REMOTE=1/0` override first, then SSH markers, then `/.dockerenv` / `/run/.containerenv`). In remote mode the server binds `0.0.0.0` (override `ITERATOR_BIND_HOST`), skips the browser opener, and prints a `http://127.0.0.1:7777/` URL for the host.

The port must be published to the host loopback: `sbx ports <sandbox> --publish 7777:7777`, `docker run -p 127.0.0.1:7777:7777`, or `ssh -L 7777:localhost:7777`. MicroVM sandboxes have no container marker files — set `ITERATOR_REMOTE=1` in the image. Everything (Work and Knowledge views) runs on the one 7777 server; the former okf-memory port 8888 is gone.

Binding `0.0.0.0` exposes the UI to the sandbox network: keep the host-side publish on loopback; the localhost Host-header check is relaxed in this mode and there is no auth token.
