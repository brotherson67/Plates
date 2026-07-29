# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Plates is a personal workout tracker PWA (Svelte + Konsta UI + Supabase +
Cloudflare Pages/Workers), used almost exclusively on mobile by a small
trusted group (the owner + a few friends/family). See `README.md` for full
stack/setup/deploy details.

**Read `DESIGN.md` before writing or changing any UI.** It's the agreed
visual design system (palette, typography, layout, and glass-treatment
rules) settled on deliberately before implementation went further, so
styling doesn't get rewritten piecemeal feature-by-feature. Every screen and
component should follow it unless the user explicitly says otherwise for
that specific change. Key points: dark-default "instrument panel" aesthetic,
one accent color (desaturated blued-steel blue), system fonts only (no
webfonts — targets older phones), flat hairline-divided panels (not rounded
cards), monospace/tabular-nums for numeric data, and glass/blur reserved
only for the navbar, the bottom stat bar, and small pill controls. Konsta
UI's default theming leans soft/rounded and must be overridden, not assumed
compatible.

## Commands

```bash
npm run dev          # start Vite dev server
npm run build         # production build (svelte-check type-check, then vite build)
npm run preview       # preview the production build locally
npm run check          # svelte-check + tsc, no emit — run before considering a change done
npm run test           # run all tests once (vitest)
npm run test:watch     # vitest watch mode
npm run test:ui        # vitest UI
```

Run a single test file: `npx vitest run src/lib/workout.test.ts`
Run tests matching a name: `npx vitest run -t "some test name"`

Local setup: `npm install`, then `cp .env.example .env.local` and fill in a
Supabase project's URL + publishable key (see `.env.example` — use the new
`sb_publishable_...` key, not the legacy anon key).

## Architecture

**Data flow**: Svelte components call plain async functions in `src/lib/*.ts`
(one module per domain: `auth.ts`, `exercises.ts`, `routines.ts`,
`logWorkout.ts`, `workout.ts`), which take a `SupabaseClient` as an explicit
first argument and talk directly to Supabase's REST API — there is no
server layer of our own. `src/lib/supabase.ts` provides `getSupabase()`, a
lazy singleton client built from `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`; it only connects when first called, so importing
modules in tests never requires env vars. `src/lib/testSupabase.ts` is the
test-side helper for building a fake/mock client.

**Explicit client passing**: every `lib` function and most components take
`client: SupabaseClient` as a parameter rather than importing the singleton
directly. This is what makes components/functions testable against a mock
client — preserve this pattern in new code rather than reaching for
`getSupabase()` inside business logic.

**snake_case ↔ camelCase boundary**: Supabase/Postgres rows are snake_case;
app-facing types in `workout.ts` (`Workout`, `Exercise`, `WorkoutTemplate`,
`Routine`, etc.) are camelCase. Each `lib` module defines a private
`*Row` interface plus a `fromRow()` mapper to convert at the query boundary
— follow this convention for any new table/query rather than passing raw
rows into components.

**Domain model** (see `src/lib/workout.ts` for the full type definitions):
- A `Workout` is either `kind: 'lifting'` (has `Exercise[]`, each with
  `WorkoutSet[]` of `{ reps, weightKg }`) or `kind: 'cardio'` (has a single
  `CardioDetails` record instead).
- `ExerciseDefinition` is the reusable catalog entry (name + equipment
  type); an `Exercise` on a logged workout may optionally reference one via
  `exerciseDefinitionId`.
- `WorkoutTemplate` (name + kind + ordered `TemplateExercise[]`) is a
  reusable workout plan; a `Routine` (name + optional length in days)
  strings templates together into `RoutineWorkout` entries by day index.
- Weight is always stored/passed as kg (`weightKg`); `convertWeight` /
  `formatWeight` in `workout.ts` handle kg↔lb display conversion — never
  convert units anywhere else.

**App shell** (`src/App.svelte`): a single top-level component owns auth
session state (via `client.auth.getSession()` / `onAuthStateChange`) and
tab state (`workouts` / `routines` / `exercises`, rendered via a bottom
`Tabbar`), and conditionally renders `LoginForm` → `SetPasswordForm` (for
invite/recovery links, detected via `isPasswordRecoveryUrl` matching a
`#type=invite|recovery` URL hash) → the tabbed app. There is no router;
tabs are a local `let activeTab` switch, not URL-addressable.

**Database & auth model** (`supabase/migrations/`, numbered and applied in
order — never edit an already-applied migration, add a new numbered file
instead): everyone in the group can **read** everyone's workouts/exercises/
templates/routines (group-visible progress), but can only **write their
own**, enforced via Postgres Row Level Security policies keyed on
`auth.uid()`. When adding a new table that holds user data, it needs RLS
enabled plus this same read-all/write-own policy pair, following the
pattern in `0001_init.sql`.

**Testing**: tests live next to the code they cover (`*.test.ts`), run under
Vitest + jsdom (`src/setupTests.ts`). Two flavors: unit tests for pure
functions in `lib` (e.g. `workout.test.ts`), and integration tests that
render Svelte components via `@testing-library/svelte` against a mock
Supabase client and assert the component and `lib` functions are actually
wired together, not just individually correct (e.g. `WorkoutSummary.test.ts`,
`App.test.ts`).

**Deploy target**: Cloudflare Pages/Workers, static output from `vite build`
to `dist/` (see `wrangler.jsonc`), configured as an SPA. No custom backend
to deploy — Supabase hosts the database/auth/API.
