# Plates

A personal workout tracker PWA for mobile devices. Built for a small trusted
group (you + a few friends/family) to run entirely for free, with an easy
exit path if any provider ever stops being free.

## Stack

- **Frontend**: Svelte + Vite, chosen for the smallest JS runtime/bundle
  footprint of the mainstream frameworks — this matters because the app
  targets older phones (older Android devices, iPhone 11).
- **Mobile UI**: [Konsta UI](https://konstaui.com/) — Tailwind-based, native
  iOS/Material-feeling components (navbars, lists, blocks) without a heavy
  component runtime.
- **PWA**: `vite-plugin-pwa` (installable, offline-capable, auto-updating
  service worker).
- **Backend**: [Supabase](https://supabase.com/) (hosted free tier) — Postgres
  database, authentication, and an auto-generated REST API. No custom server
  to write or host.
- **Hosting**: [Cloudflare Pages](https://pages.cloudflare.com/) free tier,
  deployed to a free `*.pages.dev` subdomain — no domain purchase required.

## Data model

Everyone in the group can **view** everyone's workout history (so progress is
visible across the group), but can only **create/edit/delete their own**
workouts. See `supabase/migrations/0001_init.sql` for the schema and Row
Level Security policies that enforce this.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project's URL + anon key
npm run dev
```

## Testing

```bash
npm run test        # run once
npm run test:watch  # watch mode
npm run test:ui     # Vitest UI
```

Tests live next to the code they cover (`*.test.ts`), split into:
- Unit tests for pure functions (`src/lib/workout.test.ts`,
  `src/lib/supabase.test.ts`)
- Integration tests that render components and assert the underlying
  functions are actually wired together correctly, not just individually
  correct (`src/lib/WorkoutSummary.test.ts`, `src/App.test.ts`)

## Setting up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com/) — no
   credit card required.
2. In the Supabase SQL editor, run the contents of
   `supabase/migrations/0001_init.sql` (or use the Supabase CLI to apply
   migrations from this folder).
3. In **Authentication > Providers**, keep email/password (or add others).
   Since this is an invite-only group, consider disabling public sign-ups
   in **Authentication > Settings** and inviting members directly.
4. Copy the **Project URL** and **anon public key** from **Project Settings
   > API** into `.env.local` (see `.env.example`).

## Deploying to Cloudflare Pages (one-time)

1. Push this repo to GitHub (or GitLab).
2. In the Cloudflare dashboard, create a free Pages project connected to the
   repo.
3. Build command: `npm run build` — Output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages environment
   variables (Settings > Environment variables) with the same values as your
   `.env.local`.
5. Deploy. The app will be live at a free `*.pages.dev` subdomain with
   automatic HTTPS — installable as a PWA from there directly, no custom
   domain needed.

## Keeping this portable if a free tier ever changes

- The database is plain Postgres. If Supabase's free tier ever stops working
  for this project, export with `pg_dump` and restore into any other
  Postgres host — or self-host the entire Supabase stack via their
  [Docker Compose bundle](https://supabase.com/docs/guides/self-hosting/docker).
- Schema changes should be added as new numbered files in
  `supabase/migrations/`, not made ad hoc through the Supabase dashboard, so
  the schema can always be replayed from scratch on any Postgres instance.
- Periodically take a manual `pg_dump` backup as insurance, independent of
  Supabase's own backup promises.
