# Plates — Design System

This is the visual design system for the app, agreed on before UI
implementation went further, specifically so styling doesn't get rewritten
piecemeal as features get built. Follow this for every screen/component
unless the user explicitly directs otherwise.

Live reference mockup (sign-in + workout screens, both themes, all tokens
demonstrated): see the "Plates — Design Concept" artifact from this project's
design session. This file is the durable, versioned source of truth — treat
the artifact as illustrative, this file as authoritative if they ever drift.

## Concept

"Instrument panel," not "consumer wellness app." The app is used almost
exclusively on mobile, by a small trusted group, and should read sleek and
masculine — grounded in the actual vernacular of a gym: machined steel, iron
plates, control-panel labeling, chronograph/stopwatch numerals. Explicitly
avoid the generic AI-default aesthetics (warm cream + serif + terracotta,
near-black + neon accent, purple-blue gradients, `rounded-lg` everywhere,
accent-rail cards) and avoid the generic *fitness-app* aesthetic too (pastel
gradients, soft rounded cards, motivational-poster energy). Flat panels,
hairline dividers, numbers that read like a scoreboard.

## Palette

One accent only: a desaturated "blued steel" blue (the color of
heat-treated tool steel / watch hands) — not the red/green most gym apps
default to. Neutrals are warm-graphite, not cold blue-grey and not pure
black/white, so the cool accent has something to contrast against.

| Token | Dark (default) | Light |
|---|---|---|
| `--bg` (ground) | `#171716` | `#efede7` |
| `--surface` (raised panel) | `#211f1d` | `#ffffff` |
| `--surface-2` | `#262421` | `#f4f2ec` |
| `--border` (hairline) | `#38352f` | `#d8d4ca` |
| `--text` | `#edeae3` | `#201e1a` |
| `--text-muted` | `#9c978c` | `#6e6a60` |
| `--accent` | `#4a7a9e` | `#2c5878` |
| `--accent-strong` (hover/active) | `#6fa0c4` | `#1e4560` |
| `--error` | `#c96b5e` | `#9c3d33` |

Dark is the default/primary theme (gym-at-night use, and better for
battery/OLED on the older phones this targets); light must still be
supported and get equal care, not a naive inversion.

Semantic color (error, and any future success/warning state) stays visually
separate from `--accent` — don't reuse the accent hue for status.

## Typography

**System fonts only. No custom/webfont downloads, ever.** This isn't a
stopgap — it's a deliberate constraint tied directly to the project's
"runs well on old phones" requirement (see the project's original hosting/
framework decision). The masculine/sleek character comes from weight, case,
scale, and tracking, not from an exotic typeface.

Three roles, one stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial,
sans-serif`) except where noted:

- **Display** (headings, nav title, section labels): heavy weight (800),
  uppercase, tight/negative letter-spacing on larger sizes, `text-wrap:
  balance` on headings.
- **Body** (paragraphs, form labels, button text): medium/semibold weight
  (500–600), sentence case, normal spacing, comfortable line-height (~1.5).
- **Data** (any weight, rep count, or total — anything numeric that should
  read like an instrument readout): monospace stack (`ui-monospace, "SF
  Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace`), semibold
  (600), always `font-variant-numeric: tabular-nums` so columns of numbers
  align.

## Layout

- Flat panels divided by 1px hairlines — not rounded floating cards. Corner
  radius is minimal (2–3px) and reserved for interactive controls (buttons,
  inputs), not containers.
- Uppercase, letter-tracked section labels function like control-panel
  labeling (e.g. "TODAY", "TOTAL VOLUME").
- Numeric data (weights, totals) is right-aligned / tabular, visually
  distinct from labels via the monospace data role above.
- Generous touch targets (44–48px+) — mobile-only, thumb-operated.

## Glass (iOS-style frosted translucency)

Reserved for **floating/persistent chrome only** — matching how iOS actually
uses it, not applied everywhere:
- The navbar (translucent + blurred, sits above scrolling content)
- A promoted "headline stat" bar fixed to the bottom of a scrollable screen
  (e.g. total volume) — this is both a material choice and an information-
  hierarchy choice: the one number that matters gets a distinct raised
  treatment
- Small persistent controls, as a pill (e.g. sign-out) — glass is the one
  place a fully-rounded (pill) shape is allowed, deliberately contrasting
  with the otherwise-flat/sharp panel language

List rows, form fields, and the palette/type tokens themselves stay flat
matte. If glass starts showing up on every card or row, that's a sign it's
being used as decoration rather than the deliberate accent it's meant to be.

Implementation values (add alongside the palette tokens above):

| Token | Dark | Light |
|---|---|---|
| `--glass-fill` | `rgba(33,31,29,0.55)` | `rgba(255,255,255,0.55)` |
| `--glass-edge` | `rgba(237,234,227,0.10)` | `rgba(0,0,0,0.06)` |
| `--glass-accent-fill` | `rgba(74,122,158,0.22)` | `rgba(44,88,120,0.14)` |
| `--glass-accent-fill-2` | `rgba(74,122,158,0.07)` | `rgba(44,88,120,0.05)` |
| `--glass-accent-edge` | `rgba(111,160,196,0.4)` | `rgba(44,88,120,0.35)` |
| `--accent-glow` | `rgba(74,122,158,0.14)` | `rgba(44,88,120,0.10)` |

`backdrop-filter: blur(20px) saturate(180%)` (navbar/footer), `blur(14px)`
for the smaller sign-out pill. Always pair with `-webkit-backdrop-filter`
for Safari/iOS.

## Implementing this in code

- Define these as CSS custom properties on `:root`, redefined under `@media
  (prefers-color-scheme: dark)` and again under `:root[data-theme="dark"]` /
  `:root[data-theme="light"]` so both the OS preference and an in-app toggle
  work — style components through the tokens, never hardcode a hex value in
  a component.
- Tailwind v4 (already installed, see `vite.config.ts`) can surface these as
  theme values via `@theme` in `src/app.css`.
- **Konsta UI's default components lean soft/rounded/consumer-app** (its
  built-in iOS/Material theming), which actively works against this system.
  Expect to override Konsta's own CSS variables and/or its default corner
  radii and card chrome — don't assume swapping colors alone is enough.
  Check Konsta's current theming docs for the actual variable names before
  wiring this up, rather than guessing.
