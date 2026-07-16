---
type: Feature
title: "Docs sweep: stale notes and tab description"
description: Remove the stale NUL-byte note from CLAUDE.md (the byte no longer exists in lib/gather.mjs) and align CLAUDE.md wording with the new tab structure.
status: implemented
size: small
depends_on: [planning-tab]
files: ["CLAUDE.md"]
timestamp: "2026-07-16T10:40:18.307Z"
tags: []
---

# Implementation notes

Verified 2026-07-16: perl byte-scan of lib/gather.mjs finds no NUL. Update after the planning tab lands so wording matches shipped reality.

# Depends on

* [Planning tab: backlog, plan and feature management](/features/planning-tab.md)

# Blast radius

Docs only.
