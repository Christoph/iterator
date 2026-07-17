---
type: Settings
title: Project settings
description: Iterator behavior for this project — edited via the settings UI, applied by the writer.
planner_model: openai-codex/gpt-5.6-sol
reviewer_model: openai-codex/gpt-5.6-sol
plan_reviewer_model: openai-codex/gpt-5.6-sol
timestamp: 2026-07-17T08:01:16.021Z
---

# Settings

* `planner_model`: openai-codex/gpt-5.6-sol — Model for /iterator-plan turns — 'active' uses the session model.
* `reviewer_model`: openai-codex/gpt-5.6-sol — Model for auto-mode review turns — pick a strong model here; it stands in for you until escalation.
* `plan_reviewer_model`: openai-codex/gpt-5.6-sol — Model for the whole-plan review (/iterator-review-plan). Unset = same as the reviewer model.
