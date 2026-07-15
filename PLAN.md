# Plan: Improve /iterator-plan-features UX & Extract Testing Skill

## Goal
Improve `/iterator-plan-features` to use Claude Code's `AskUserQuestion` tool for interactive prompts instead of plain text questions. Remove the upfront 5-question clarification step — auto-read `ARCHITECTURE.md` if it exists (fall back to best practices) and only ask follow-ups when the goal implies a deviation or new dependency. Extract testing into a new `/iterator-test-features` skill that generates tests at the feature level.

## Architecture
Follows the existing plugin structure: `SKILL.md` files contain step-by-step instructions Claude executes, with `server.mjs` for browser UI. Changes: `skills/iterator-plan-features/SKILL.md` (rewrite), new `skills/iterator-test-features/SKILL.md`, register in `.claude-plugin/plugin.json`.

The plan-review browser UI (`server.mjs`) is substantially upgraded:
- **Markdown rendering**: each section renders as formatted markdown (not raw text) — headers, bold, code blocks
- **Click-to-edit**: clicking any section switches it to an editable textarea, saves on blur or Cmd+Enter
- **Inline comments**: each section has a comment icon; clicking opens a side-panel comment thread (same UX as `/iterator-review` line comments), aggregated at the bottom for Claude to act on
- **Dependencies panel**: Claude pre-populates inferred new deps as editable chips; developer confirms/removes/adds before approving
- Server invocation via piped heredoc — no /tmp file; tab opens immediately

## Dependencies
None. `AskUserQuestion` is a built-in Claude Code tool — no installs needed.

## Key Decisions

**AskUserQuestion for flow-control prompts**: Replaces plain-text "choose 1 or 2" messages with structured option cards for: (a) existing PLAN.md detected — use/replace; (b) existing FEATURES.md — regenerate/update.

**Auto-derive architecture from ARCHITECTURE.md**: Step 2's architecture question eliminated. Claude reads `ARCHITECTURE.md` and only surfaces a follow-up if the goal diverges from it.

**Goal-only upfront question**: Only "what are you building and why?" is asked initially. Dependencies and product-fit deferred until goal analysis reveals a need.

**Plan view as a readable document**: Sections render as styled markdown, not raw textarea fields. Editing is opt-in (click to activate). Comments are per-section and visible at a glance — mimics the review UI pattern the user already knows.

**Dependencies panel in browser**: Inferred deps appear as editable chips. Developer approves/removes/adds before clicking Approve — no chat round-trips.

**No /tmp data file**: Data piped directly to `server.mjs` via heredoc — one step, tab opens immediately.

**Testing as `/iterator-test-features` skill**: New skill reads `FEATURES.md`, picks a feature, generates tests. Users opt in per-feature rather than upfront.

## Product Fit
Improves `skills/iterator-plan-features/SKILL.md` (rewrite) and `skills/iterator-plan-features/server.mjs` (UI upgrade). Adds `skills/iterator-test-features/SKILL.md` + `plugin.json` entry. No changes to `/iterator-review`.

## Features Index

<!-- Line references into FEATURES.md for efficient loading -->
| Feature | Line | Status | Size |
|---|---|---|---|
| project-scaffolding | 10 | [ ] pending | medium |
| architecture-docs | 19 | [ ] pending | medium |
| plan-features-skill-a | 28 | [ ] pending | large ⚠️ |
| plan-features-skill-b | 37 | [ ] pending | large ⚠️ |
| review-skill | 46 | [ ] pending | large ⚠️ |
