---
type: Pitfall
title: Client JS in view template literals needs double-backslash escapes
description: "The views' client scripts live inside backtick template literals, so a single \\n is converted to a real newline at module load and breaks the served inline <script>."
tags: [views, client-js, escaping]
files: ["lib/views/hub.mjs", "lib/views/knowledge.mjs", "lib/ui.mjs", "test/client-js-parse.test.mjs"]
timestamp: 2026-07-16T09:00:35.300Z
---

# Pitfall

Every view's client script (`const JS = \`...\`` in `lib/views/*.mjs`, plus `SHARED_JS` in `lib/ui.mjs`) is a backtick template literal that is shipped verbatim into the page's single inline `<script>` (assembled by `renderPage()` in `lib/ui.mjs`). Escape sequences written with a single backslash (`\n`, `\t`, `\u2014`) are interpreted **at module load**, so `'a\nb'` puts a real newline inside a single-quoted string in the served script — an unterminated string literal. One such token kills the whole `<script>` block with `SyntaxError: Invalid or unexpected token`, and because every tab body is built client-side, the page renders blank (and inline `onclick` handlers throw `... is not defined` as fallout). This shipped once via the backlog feature's `selectedBacklogGoal()` in `lib/views/hub.mjs`.

# How to handle it

Inside these template-literal JS blocks, always double the backslash so the browser receives the escape sequence: `'a\\nb'`, `.join('\\n\\n')`, regexes as `/\\s+/`. Dynamic data is never the problem — it goes through `embed()` (`JSON.stringify` + separator escaping); the pitfall is hand-written escapes in the static script text. `test/client-js-parse.test.mjs` renders every view and parse-checks the assembled inline script with `vm.Script`, so a leaked raw newline fails the suite — keep new views covered there (add their minimal payload to `MIN_DATA`). The same file also guards top-level ordering (TDZ: `const` declarations must precede the bootstrap calls that use them, e.g. `DESIGN_SECS` in `lib/views/knowledge.mjs`).
