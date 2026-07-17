---
type: Pitfall
title: An IPv4-only bind breaks localhost behind a sandbox forward
description: A sandbox publishes both v4 and v6 loopback forwards; bound to 0.0.0.0 the v6 one resets, and a reset stops clients falling back — so localhost fails while 127.0.0.1 works.
tags: [remote, docker, ports, ipv6, sbx]
files: ["lib/server/env.mjs", "lib/server/listen.mjs"]
timestamp: 2026-07-17T10:07:11.515Z
---

# Pitfall

A sandbox with an IPv6 address makes sbx publish **two** loopback forwards for one container port: `127.0.0.1:49159->7777` *and* `::1:49159->7777`. Bind the server to `0.0.0.0` (IPv4 only) and the v6 forward proxies to the container's IPv6 address where nothing listens, so it answers **RST**.

That is the trap: a *reset* is not a *refusal*. Clients fall back to the next address only when a connection is refused, so curl and browsers give up instead of retrying over IPv4. macOS resolves `localhost` to `::1` first, so the symptom is:

* `http://localhost:<port>/` → hangs then `Connection reset by peer`
* `http://127.0.0.1:<port>/` → HTTP 200

It looks like broken port forwarding, and `sbx ls` showing the forward makes that read plausible — but the forward is fine. Confirm by checking the listener's family inside the container rather than trusting the forward table:

```sh
grep -i 1E61 /proc/net/tcp    # 1E61 = 7777; state 0A = LISTEN
grep -i 1E61 /proc/net/tcp6   # empty => IPv4-only bind => this pitfall
```

# Fix

Bind `::` (dual-stack; node leaves `ipv6Only` false) so one socket serves both forwards — `lib/server/env.mjs` does this whenever `REMOTE`. Do not "fix" it by publishing v4 only or by telling users to type `127.0.0.1`.

Do not bind `::1` or set `ipv6Only`: `reclaimPort()` probes `http://127.0.0.1:<port>/__iterator/status` and, when that probe fails, falls through to `lsof` + SIGTERM/SIGKILL — and for a session dashboard that pid is the agent process itself. Dual-stack keeps the v4 probe answering. `listenWithTakeover` downgrades `::` → `0.0.0.0` on `EAFNOSUPPORT`/`EPROTONOSUPPORT`/`EADDRNOTAVAIL`/`EINVAL` so a host without IPv6 still starts.
