---
type: Design
title: Iterator dashboard design parameters
description: A compact dark developer control plane with clear workflow state.
register: product
created: 2026-07-15
timestamp: 2026-07-15T09:56:12.393Z
---

# Direction

Quiet, compact developer control plane. Use a dark GitHub-inspired surface hierarchy; reserve blue for primary actions and active progress. Avoid gradients, nested cards, decorative color, and oversized marketing-style headings.

# Typography

Display and body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; mono labels: ui-monospace, SFMono-Regular, Menlo, monospace. Use a 1.25 scale, 600-weight headings, 400-weight body, 1rem body size, 1.5 body line height, and 0.08em letter spacing on uppercase mono labels.

# Color

Background #0d1117; elevated surface #161b22; border #30363d; primary text #c9d1d9; muted text #8b949e; accent #388bfd; success #3fb950; warning #d29922; danger #f85149. Keep blue for selected controls and progress; use semantic colors only for status.

# Spacing

Base 4px scale: 4/8/12/16/24/32/48/64. space-sm: 8px; space-md: 16px; space-lg: 32px. Use 8–12px within control groups and 24–48px between dashboard sections; use gap instead of ad-hoc margins.

# Elements

Button: #161b22 background, 1px #30363d border, 6px radius, 8px 12px padding, #388bfd hover border; primary button: #388bfd background with #fff text. Input: #0d1117 background, #30363d border, 6px radius, 8px 12px padding. Card: #161b22 background, 1px #30363d border, 6px radius, 16px padding. Badge: semantic tinted background, 999px radius, 2px 8px padding.

# Responsive

Mobile-first layout; stack controls below 640px, preserve all tab actions, use 44px touch targets, and use horizontal overflow rather than clipping workflow state.

# Signature

A compact blue progress pulse beside the active Work or Knowledge tab, paired with a terse mono status label.
