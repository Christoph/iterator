---
type: Setup
title: Development commands
description: Use npm scripts for tests, lib syncing, and browser previews.
tags:
  - npm
  - tests
  - preview
files:
  - package.json
  - scripts/sync.mjs
  - test/sync.test.mjs
timestamp: 2026-07-06T19:11:28.965Z
---

# Commands

```bash
npm test                      # node --test test/*.test.mjs
npm run sync                  # copy root lib/ + templates into skill folders
npm run preview:hub           # browser previews with inline fixtures
npm run preview:plan
npm run preview:chunk
npm run preview:test
npm run preview:review
npm run preview:knowledge     # fixtures from test/fixtures/
npm run preview:memory-review
```

Run `npm run sync` after any edit to root `lib/` or `templates/` — `test/sync.test.mjs` fails on drift. Preview commands honor `ITERATOR_*` environment overrides such as `ITERATOR_REMOTE`, `ITERATOR_BIND_HOST`, `ITERATOR_PORT`, `ITERATOR_NO_OPEN`, and `BROWSER`. Deterministic timestamps in tests come from `ITERATOR_NOW`.
