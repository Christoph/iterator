---
type: Decision
title: Sync shared libs into droppable skills
description: Shared code is developed in root lib/ and copied into skill folders so skills work when installed together or copied manually.
status: accepted
date: 2026-07-06
tags:
  - skills
  - sync
  - portability
files:
  - lib/server.mjs
  - lib/ui.mjs
  - lib/bundle.mjs
  - scripts/sync.mjs
  - test/sync.test.mjs
timestamp: 2026-07-06T19:11:28.964Z
---

# Decision

Keep canonical shared code in root `lib/` (`bundle.mjs`, `server.mjs`, `ui.mjs`, `views/*`), but commit byte-for-byte copies inside the `iterator` hub skill (`skills/iterator/lib/`). `scripts/sync.mjs` holds the COPIES table (it also syncs `templates/format.md` into `skills/iterator-plan/`); `test/sync.test.mjs` asserts the copies match.

# Rationale

Some harnesses install the whole package, while others copy skill folders. A copied skill still needs its imports to resolve without reaching back into this source tree. The pi extension imports root `lib/` directly; the packaged skills use the synced copies — both must stay identical.

# Consequences

After editing root `lib/` or `templates/`, run `npm run sync` and commit the copies in the same change. Do not hand-edit `skills/iterator/lib/` copies.
