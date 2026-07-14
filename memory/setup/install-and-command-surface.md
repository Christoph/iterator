---
type: Setup
title: Install and command surface
description: Install through pi (local path or git source) or as a Claude Code plugin; friendly commands map to direct skill invocations.
tags:
  - install
  - pi
  - claude
files:
  - package.json
  - extensions/iterator.js
  - README.md
timestamp: 2026-07-06T19:11:28.965Z
---

# Install

pi: `pi install /path/to/iterator` (this repo is installed by local path into `~/.pi/agent/settings.json`, so repo edits apply on the next pi start) or `pi install git:github.com/<user>/iterator@<tag>`. Claude Code: `claude --plugin-dir /path/to/iterator` or the local-marketplace flow.

# Command surface

The extension registers friendly commands that forward to skills: `/iterator` (hub), `/iterator-plan|feature|test|implement|design|review`, `/iterator-next` (implement the next ready feature, no questions), and the knowledge side `/iterator-knowledge`, `/iterator-init`, `/iterator-consolidate`, `/iterator-memorize`. `/iterator-implement` with no argument opens a TUI feature picker. In pi, prefer the tools (`iterator_gather` / `iterator_write` / `iterator_ui` / `okf_write`) over shell pipelines — same scripts underneath.
