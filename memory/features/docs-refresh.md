---
type: Feature
title: Docs refresh
description: README and ARCHITECTURE describe the six-skill flow with the hub, red/green testing, commit tracking, and the Docker bind option.
status: done
size: small
lines_estimate: 100
depends_on: [hub-dispatch, expose-bind-host]
files: ["README.md", "docs/ARCHITECTURE.md", ".claude-plugin/plugin.json"]
timestamp: 2026-07-05T15:05:00Z
done: 2026-07-05
tags: [docs]
---

# Implementation notes

- **Flow diagram** (both files): add `/iterator` as the entry point / home
  screen; move `/iterator-test` from "(optional, any time after slicing)" to
  an explicit optional red step between feature and implement, with implement
  annotated "uses tests as goal if present". Fix the README sentence that
  contradicts red mode (test currently implies reading existing code).
- **README:** hub section (what the dashboard shows, button enablement), the
  red→green lifecycle in the feature-sizing/testing area, `tests_status` badge in
  the example feature, `commits` + trailer lookup note, the new **7777 default
  port** everywhere 8888 appears, and `ITERATOR_HOST` in Configuration with
  the Docker recipe (`ITERATOR_HOST=0.0.0.0 ITERATOR_NO_OPEN=1
  ITERATOR_PORT=7777`, `docker run -p 7777:7777`, security warning).
- **docs/ARCHITECTURE.md:** hub-as-router decision (one-shot round trips kept;
  dashboard reopens between actions — explicitly note the rejected
  long-running-server alternative), the `tests_status`-vs-`status` separation
  rationale, sha-vs-trailer resilience note, plugin-structure tree gains
  `skills/iterator/`.
- Mention the optional `impeccable` integration (implement runs
  `/impeccable audit`/`polish` on UI features when that skill is installed).
- Keep the two files consistent with each other and with
  `templates/format.md` — the schema doc stays the normative one; README shows
  examples only.

# Depends on

* [Hub dispatch skill](/features/hub-dispatch.md) — documents the finished hub behavior.
* [Dev bind host for Docker](/features/expose-bind-host.md) — documents ITERATOR_HOST.

# Blast radius

Docs only; no runtime effect. Stale docs here are how the README/skill
contradiction (test "any time" vs "read the real code") happened in the first
place — this feature closes it.
