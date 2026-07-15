---
type: Feature
title: Iterator terminology migration
description: Rename the plugin’s lr/chunk surface to iterator/features and migrate persisted plan files without legacy ambiguity.
status: done
size: large
depends_on: []
files: ["package.json", "README.md", "ARCHITECTURE.md", "CONTRIBUTING.md", "PLAN.md", "CHUNKS.md", "FEATURES.md", "skills/lr-*", "skills/iterator-*", "test.md"]
timestamp: "2026-07-15T09:37:00.529Z"
tags: []
done: 2026-07-15
---

# Implementation notes

Rename skill directories, commands, package metadata, server labels, and docs from `lr-*` to `iterator-*`. Replace `CHUNKS.md` with `FEATURES.md` in the workflow and implement a one-time migration that preserves existing plan status, dependencies, and detail. Update direct server smoke commands and add migration coverage for old persisted files.

# Blast radius

All public skill commands, persisted plan state, documentation, and browser UI terminology.
