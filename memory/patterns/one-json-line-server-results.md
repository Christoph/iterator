---
type: Pattern
title: One JSON line server results
description: Local UI servers must resolve every user, timeout, and signal path by printing one machine-readable JSON object to stdout.
tags:
  - server
  - contract
  - tests
files:
  - lib/server.mjs
  - skills/iterator/server.mjs
  - test/server.test.mjs
timestamp: 2026-07-06T19:11:28.965Z
---

# Pattern

The CLI-side skill caller blocks on stdout, so every interactive server path must finish with a single JSON line. `/submit` echoes the posted JSON body (optionally transformed by `onSubmit`), signals resolve as `{"type":"cancel"}`, and the timeout resolves as `{"type":"timeout"}`.

Use stderr for logs such as the browser URL, remote-session notices, takeover messages, and timeout notices. Never print extra stdout banners.

# Testing

`test/server.test.mjs` covers submit echo, signal cancellation, stale server takeover, remote URL behavior, cancel grace semantics, and the memory-review apply flow. Add server lifecycle tests whenever changing `lib/server.mjs`.
