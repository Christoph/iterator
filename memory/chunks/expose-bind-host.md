---
type: Chunk
title: Dev bind host for Docker
description: ITERATOR_HOST env var lets the shared server bind 0.0.0.0 for Docker sandboxes, and the default port moves from 8888 to 7777.
status: done
size: small
lines_estimate: 70
depends_on: []
files: ["lib/server.mjs", "skills/*/lib/server.mjs", "skills/*/SKILL.md", "test/server.test.mjs", "README.md"]
timestamp: 2026-07-05T13:50:00Z
done: 2026-07-05
tags: [server, docker]
---

# Implementation notes

In `lib/server.mjs` (then `npm run sync` to refresh all bundled copies):

- **Default port becomes 7777** (was 8888): change the `ITERATOR_PORT`
  fallback in `serve()`, and update every 8888 mention in the five SKILL.md
  files (iterator-plan "Shared UI behavior", iterator-review step 5) and in
  README/ARCHITECTURE (the docs-refresh chunk re-checks these, but flip them
  here so the repo is never internally inconsistent). Port-retry behavior on
  busy ports is unchanged.
- Read `ITERATOR_HOST` (default `127.0.0.1`). Use it as the bind address in
  both `server.listen()` calls (`tryListen` and the ephemeral-port fallback).
- **Host-header check:** the current `LOCAL_HOST_RE` rejects anything
  non-localhost, which breaks access via container IP or hostname. When
  `ITERATOR_HOST` is set to a non-default value, skip the localhost Host check
  (keep it strict in the default mode). The **per-run token stays mandatory in
  all modes** — it is the real defense once the port is reachable from outside.
- Print a loud stderr warning when binding non-localhost: anyone who can reach
  the port and obtain the token can answer as the user.
- Keep printing the `127.0.0.1` URL (with Docker `-p 8888:8888` port publishing
  that is exactly what the host browser opens); additionally print a hint line
  when bound to `0.0.0.0`.
- Add a `test/server.test.mjs` case: with `ITERATOR_HOST=0.0.0.0`, a request
  with a non-localhost `Host` header and a valid token gets 200; with a bad
  token still 403. Default mode: non-localhost Host stays 403.
- README Configuration section: document the new 7777 default and
  `ITERATOR_HOST` as dev-only, with the Docker recipe
  `ITERATOR_HOST=0.0.0.0 ITERATOR_NO_OPEN=1` + `docker run -p 7777:7777 …`
  (pin `ITERATOR_PORT=7777` in the container so the busy-port retry can't move
  it off the published port).

# Snippets

```js
const BIND_HOST = process.env.ITERATOR_HOST || '127.0.0.1';
const exposed = BIND_HOST !== '127.0.0.1';
// request guard:
if ((!exposed && !LOCAL_HOST_RE.test(String(req.headers.host || ''))) ||
    url.searchParams.get('t') !== token) { /* 403 */ }
```

# Blast radius

All six UI servers inherit this via sync. A mistake here weakens the
forged-submit protection everywhere — the token check must remain unconditional.
Default behavior (no env var) must be byte-for-byte today's: localhost bind +
strict Host check.
