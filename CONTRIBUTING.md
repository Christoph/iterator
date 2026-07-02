# Contributing to local-review

## Development setup

```bash
git clone <repo>
cd local-review
# No npm install needed — server.mjs uses only Node built-ins
```

## Testing the plugin locally

Install it as a local plugin in Claude Code:

```bash
claude plugins install .
```

In any git repo with changes, run `/plan-features` or `/review` in Claude Code.

## Testing the servers directly

You can test the server scripts independently by piping sample data:

```bash
# Review server
echo '{"branch":"test","hasPlanFile":true,"features":[{"name":"example","description":"Test feature","blastRadius":"Low risk","dependsOn":[],"stats":{"added":10,"removed":3,"files":1,"complexity":"green"},"files":[{"path":"src/foo.ts","hunks":[{"header":"@@ -1,3 +1,5 @@","oldStart":1,"newStart":1,"lines":[{"type":"addition","content":"const x = 1;"}]}]}]}],"uncategorized":[]}' \
  | node skills/review/server.mjs

# Plan-features server
echo '{"branch":"test","totalChanged":50,"features":[{"name":"example","description":"Test feature","files":["src/foo.ts"],"blastRadius":"Low risk","dependsOn":[],"linesAdded":10,"linesRemoved":3,"size":"small"}]}' \
  | node skills/plan-features/server.mjs
```

Open http://localhost:8888 to see the UI.

## File structure

- **`SKILL.md`** — instructs Claude how to invoke the skill (steps, data format, how to handle server output)
- **`server.mjs`** — self-contained Node.js script: HTTP server + full browser UI as a template literal
- **`templates/*.md`** — detailed spec/reference for the HTML structure (used when extending or regenerating)

## Changing the UI

The browser UI is embedded in `server.mjs` inside the `buildHtml()` function as a template literal. Edit there directly. The `templates/` directory is a reference spec, not runtime code.

## Changing the port

Port defaults to `8888`. Change via `LOCAL_REVIEW_PORT` environment variable or edit the default in both `server.mjs` files:

```javascript
const port = parseInt(process.env.LOCAL_REVIEW_PORT || '8888', 10);
```

## Skill invocation flow

1. Claude runs the skill's steps (reads git diff, reads PLAN.md)
2. Claude builds the JSON data object
3. Claude writes JSON to `/tmp/local-review-data.json`
4. Claude runs `node <skill-dir>/server.mjs < /tmp/local-review-data.json`
5. Server blocks until user submits
6. Claude reads stdout JSON and processes the feedback

## Adding a new skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`)
2. Create `skills/<name>/server.mjs` following the same pattern
3. Reinstall the plugin: `claude plugins install .`
