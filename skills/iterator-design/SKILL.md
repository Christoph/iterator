---
name: iterator-design
description: Set up and apply the project's design parameters (direction, typography, color, spacing, responsive) saved in memory/design.md so every UI feature stays visually consistent, and audit/fix existing UI against them. On first use it derives the parameters from the plan and codebase, confirms them with the user once, and persists them through the bundle writer; later runs reuse them without asking. Use when the user types /iterator-design, wants to set or revise the project's look, wants existing UI improved or fixed, or when /iterator-implement builds a feature that touches frontend/UI surface.
---

# iterator-design

The design companion to the iterator flow. It keeps one durable set of
**design parameters** per project in `memory/design.md` — captured once,
reused on every UI feature — and applies a small set of design rules so the
UI the implementer creates is intentional rather than templated.

## When to use this skill

When the user types `/iterator-design`, wants to set or revise the project's
look, wants existing UI improved ("make this page look good", "fix the UI"),
or when `/iterator-implement` builds a feature that touches frontend/UI surface
(markup, styles, client-side components). If `memory/plan.md` does not exist,
tell the user to run `/iterator-plan` first and stop — the params live in the
plan's bundle.

**pi mode:** see `<skill-dir>/../iterator/PI.md`.

## Steps

### 1. Load the saved params

```sh
node <skill-dir>/../iterator/gather.mjs --step implement
```

The payload's `designFile` field is the absolute path of `memory/design.md`
when the params have been captured, or `null` on first use. (When invoked from
`/iterator-implement`, this payload is already in hand — don't gather twice.)

- `designFile` non-null → read that file and skip to step 3. Its values
  **win over the generic rules below** on any conflict: the point is
  consistency across the project's UIs, not per-feature novelty.
- `designFile` null → capture first (step 2).

### 2. First-time capture — derive, confirm once, persist

1. **Derive** a complete proposal — never ask the user to fill a blank form:
   - the plan's `# Goal` and `# Product fit` → subject, audience, tone,
     register (`brand` = expressive marketing surface, `product` = quiet
     utilitarian tool);
   - the codebase → the *real* existing design, not an invented one: Tailwind
     config, CSS custom properties, loaded fonts, component library. An
     existing app's palette is captured, not replaced;
   - the feature being built → the concrete subject matter grounding the
     direction.
2. **Confirm** with one compact summary in chat — direction and tone in a few
   words, register, display + body typefaces, 4–6 named color values
   (OKLCH or hex), spacing scale, breakpoints, and the signature element —
   and ask the user to accept or tweak. One round, not an interview.
3. **Persist** through the bundle writer (never hand-edit bundle files):

   ```sh
   node <skill-dir>/../iterator/write.mjs << 'DESIGN_WRITE'
   {
     "op": "design",
     "title": "<project> design parameters",
     "description": "<one line: the visual direction>",
     "register": "product",
     "sections": {
       "direction": "<aesthetic direction, tone, signature element, what to avoid>",
       "typography": "<families for display/body/mono, scale ratio, weights>",
       "color": "<named palette values, accent, neutral tint, dark-mode notes>",
       "spacing": "<base unit, scale steps, radii, section rhythm, and the named margin/padding constants: space-sm: 8px · space-md: 16px · space-lg: 32px (small/medium/large are mandatory)>",
       "elements": "<per-component styles, one line each: button (bg, border, radius, padding, hover), input, card, badge — concrete CSS values>",
       "responsive": "<breakpoints, fluid-type ranges, touch rules>",
       "signature": "<the one distinctive recurring element>"
     }
   }
   DESIGN_WRITE
   ```

   `direction`, `typography`, `color`, `spacing`, `elements` are required;
   `responsive` and `signature` are optional. Write **concrete values** (font
   stacks, hex/OKLCH colors, pixel scales, named spacing tokens), not
   adjectives — the next session must be able to reproduce the look from this
   file alone. The writer warns when `color` has no literal color value or
   `spacing` lacks named small/medium/large constants — fix the sections and
   re-run rather than shipping a vague file.

### 3. Apply while building

Follow the saved params plus these rules. Spend boldness in one place: the
signature element is the one memorable thing; everything around it stays
quiet and disciplined.

**Direction.** Commit to one intentional aesthetic grounded in the subject's
own world — its materials, vernacular, artifacts. Never default to the AI-slop
look: Inter/Roboto/system fonts everywhere, purple-blue gradients, uniform
nested card grids. Match implementation complexity to the vision: maximalist
directions need elaborate execution, minimal ones need precision in spacing
and type.

**Typography.** Pick one modular scale ratio (1.25, 1.333, or 1.5) and commit
— no arbitrary sizes. At most 2–3 families; pair display + body on contrasting
axes (serif + sans, geometric + humanist). Body ≥ 16px/1rem; line-height
1.5–1.7 for body, 1.1–1.2 for headings; reading measure `max-width: 65ch`.
Short all-caps labels get `letter-spacing: 0.05–0.12em`. Size in `rem`, never
`px`; never disable zoom.

**Color & contrast.** 60-30-10 visual weight: neutrals dominate, one accent
reserved for primary actions, current selection, and state — never decoration.
Tint neutrals toward the brand hue (chroma ~0.005–0.015); never pure gray or
pure black. Prefer OKLCH for palettes (vary lightness, hold hue; reduce chroma
near white/black). WCAG AA: 4.5:1 body text, 3:1 large text and UI. Never gray
text on a colored background — use a darker shade of that background instead.
Dark mode is a re-design, not an inversion: lighter surfaces mean elevation,
accents desaturate slightly, text weight drops a notch.

**Spatial.** One 4pt spacing scale (4/8/12/16/24/32/48/64/96) behind semantic
tokens; prefer `gap` over margins. Every margin and padding comes from the
named small/medium/large constants in `design.md` — never an ad-hoc value.
Rhythm comes from contrast: tight within
groups (8–12px), generous between sections (48–96px) — monotone equal spacing
kills hierarchy. Squint test: primary, secondary, and groupings must survive
blurred vision. No cards inside cards; cards only for genuinely distinct,
actionable content. Build hierarchy from 2–3 dimensions at most (size ≥ 3:1,
weight, space). Touch targets ≥ 44×44px.

**Responsive.** Mobile-first `min-width` queries. Breakpoints are
content-driven (~640/768/1024 as starting points — add one where the layout
actually breaks, not per device). `clamp()` for fluid display type, with max
≤ ~2.5× min. Detect input with `pointer: coarse` / `hover: hover` queries
instead of inferring it from width. Respect safe-area insets. Never hide core
functionality on mobile — adapt it.

**Elements.** Define each recurring component once — button, input, card,
badge, table — with its exact background, border, radius, padding, and hover
treatment, and reuse those values everywhere the component appears. Never
restyle a component per page; a deviation is a params revision (re-run the
`design` op), not a local override.

### 3b. Improving existing UI (manual invocation)

When the user points this skill at UI that already exists — a page, a
component, "make it look good" — treat it as an **audit → fix** pass over the
named surface (or the UI files of recent features if none is named):

1. Load the params (step 1; capture them first if `designFile` is null — the
   audit is against the *project's* look, not generic taste).
2. Audit the markup and styles against the params and every rule in step 3.
   Typical findings: off-scale font sizes and spacing values, more than one
   accent color doing decoration, pure-gray text, gray-on-colored text,
   contrast below AA, nested cards, monotone equal spacing, hover-only
   affordances, layouts that break below ~640px.
3. Apply the fixes directly, smallest change that brings the surface in line
   — this is a correction pass, not a redesign. Only propose a redesign if
   the UI contradicts the saved direction outright, and let the user decide.
4. Run the self-check (step 4) and summarize what was changed and why, so the
   user can review it (or run `/iterator-review` when the files belong to a
   feature).

### 4. Self-check before handing back

Scale committed (no stray sizes/spacings)? One accent, reserved? Contrast AA?
Usable at 360px width? Signature element present, everything else quiet?
Every element style and every margin/padding traceable to a value in
`design.md` (element styles, named spacing constants)?
If the user asked for a deviation from the saved params during the build,
re-run the `design` op with the updated sections so `memory/design.md` stays
the source of truth — the op preserves `created`, refreshes `timestamp`, and
logs the update.

## Revising the params

Re-run `/iterator-design` at any time: read the current `design.md`, present
it as the default, apply the user's changes through the `design` op. The root
`memory/index.md` line and `memory/log.md` entry are regenerated by the writer.
