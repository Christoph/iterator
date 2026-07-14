---
type: Design
title: Iterator dashboard design parameters
description: Quiet dark developer-tool interface with compact, stateful navigation.
register: product
created: 2026-07-14
timestamp: 2026-07-14T10:58:46.509Z
---

# Direction

Quiet dark developer tool: precise, compact, and utilitarian. Preserve the persistent tab strip as the signature element; avoid gradients, decorative accents, and card-heavy layouts.

# Typography

Display/body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; mono: ui-monospace, SFMono-Regular, Menlo, monospace. Use a 1.25 scale, 600 weight headings, and regular body copy.

# Color

Background #0d1117; elevated surface #161b22; control surface #21262d; border #30363d; primary text #c9d1d9; muted text #8b949e; accent #388bfd; positive #3fb950; warning #d29922; danger #f85149. Dark mode is the primary design.

# Spacing

4px base scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px. space-sm: 8px; space-md: 16px; space-lg: 32px. Use compact 4–8px gaps within controls and 16–32px between content groups.

# Elements

Button: #21262d background, #30363d border, 6px radius, 4px 10px padding, #8b949e border hover. Input: #0d1117 background, #30363d border, 6px radius, 6px 10px padding, #388bfd focus border. Card: #161b22 background, #30363d border, 6px radius, 12px 16px padding. Badge: transparent or #161b22 background, #30363d border, 10px radius, 2px 9px padding.

# Responsive

Keep navigation and controls operable at 360px; preserve core actions, use wrapping flex rows, and use 44px touch targets for coarse pointers.

# Signature

The compact persistent Work / Knowledge / Usage tab strip with state chips and a dedicated settings gear.
