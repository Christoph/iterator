---
type: Pattern
title: Safe browser rendering helpers
description: Browser pages escape HTML, embed data through safe JSON, and attach event handlers in client JavaScript instead of string-built inline handlers.
tags:
  - browser-ui
  - security
  - rendering
files:
  - lib/ui.mjs
  - lib/views/hub.mjs
  - lib/views/review.mjs
  - lib/views/knowledge.mjs
  - lib/views/memory-review.mjs
  - test/server.test.mjs
timestamp: 2026-07-06T19:11:28.965Z
---

# Pattern

Use `escHtml()` for HTML text and attributes, and `embed()` for JSON data embedded into `<script>` blocks. `embed()` escapes `<`, U+2028, and U+2029 so strings such as `</script>` stay data (the F8 fix). The shared page shell (`renderPage()`) inserts `SHARED_JS`, then view-specific client JS.

Client behavior should be attached with `addEventListener`; avoid string-built `on*=` attributes. Markdown bodies are rendered client-side via the shared `mdToHtml()` helper rather than by trusting raw HTML from memory bodies.

When adding UI fields, keep all source data in the payload object (`const D`) and render through these helpers.
