# Features

> **Plan:** Improve /iterator-plan-features UX & Extract Testing Skill (from PLAN.md)
> **Branch:** main
> **Created:** 2026-07-01
> **Progress:** 0/5 done

---

## [ ] project-scaffolding
- **description**: Standard project meta-files: .gitignore, package.json, README, CONTRIBUTING, and GitHub Actions CI workflow
- **files**: `.gitignore`, `package.json`, `README.md`, `CONTRIBUTING.md`, `.github/workflows/test.yml`
- **blast-radius**: No runtime dependencies — pure project metadata. CI workflow failure would block merges. README/CONTRIBUTING only affect contributors.
- **depends-on**: none
- **size**: medium (305 lines added)

## [ ] architecture-docs
- **description**: Rewrites ARCHITECTURE.md to capture the two-file design (PLAN.md + FEATURES.md) and replaces the old deliverables checklist in PLAN.md with the new structured plan
- **files**: `ARCHITECTURE.md`, `PLAN.md`
- **blast-radius**: Both skills reference ARCHITECTURE.md for format specs. If the documented format diverges from actual skill behavior, skill instructions become misleading and reviewers lose trust in the spec.
- **depends-on**: none
- **size**: medium (155 lines changed)

## [ ] plan-features-skill-a
- **description**: Rewritten /iterator-plan-features SKILL.md — defines the new step flow: FEATURES.md creation, PLAN.md index, browser server invocation, and feedback loop
- **files**: `skills/iterator-plan-features/SKILL.md`
- **blast-radius**: Defines the step-by-step instructions Claude follows when /iterator-plan-features is invoked. Any mismatch with the server.mjs stdin/stdout contract breaks the entire plan-creation flow. Also defines the FEATURES.md format that /iterator-review depends on.
- **depends-on**: architecture-docs
- **size**: large (259 lines changed)
- **⚠️ oversized**: 259 lines — single file, cannot split further

## [ ] plan-features-skill-b
- **description**: New plan-features server.mjs — Node.js server that powers the interactive browser UI for plan creation, adjustment, and approval
- **files**: `skills/iterator-plan-features/server.mjs`
- **blast-radius**: Implements the stdin JSON → browser UI → stdout JSON contract. If its input schema or output schema change, the SKILL.md steps that feed it (and read from it) break silently.
- **depends-on**: plan-features-skill-a
- **size**: large (612 lines added)
- **⚠️ oversized**: 612 lines — single file, cannot split further

## [ ] review-skill
- **description**: Full rewrite of /iterator-review — reads FEATURES.md for scope, maps diff hunks to features, runs the interactive diff viewer server, and writes review outcomes back to FEATURES.md
- **files**: `skills/iterator-review/SKILL.md`, `skills/iterator-review/server.mjs`
- **blast-radius**: The entire /iterator-review flow. Upstream: expects FEATURES.md in exact format produced by /iterator-plan-features. Downstream: feedback JSON written back to FEATURES.md must be parseable by future /iterator-review invocations.
- **depends-on**: plan-features-skill-a
- **size**: large (686 lines — 221 changed in SKILL.md + 465 new in server.mjs)
- **⚠️ oversized**: 686 lines — SKILL.md and server.mjs must be reviewed together to verify the feedback loop contract
