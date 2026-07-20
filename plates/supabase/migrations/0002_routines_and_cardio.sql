-- Routines, workout templates, a shared exercise catalog, and cardio support.
--
-- Key modeling decision: a "workout" as planned (part of a routine, no
-- performance data yet) and a "workout" as logged (what actually happened,
-- with real sets/reps/weights, duration, RPE) are different things, so this
-- splits them into workout_templates (the plan) vs the existing workouts
-- table (the log). A routine can mix lifting and cardio templates on
-- different days.

create extension if not exists pgcrypto;

create type public.equipment_type as enum ('barbell', 'dumbbell', 'machine', 'bodyweight', 'other');
create type public.workout_kind as enum ('lifting', 'cardio');
create type public.cardio_type as enum ('steady_state', 'hiit', 'jog', 'walk', 'sprints');

-- Shared catalog of exercises (e.g. "Bench Press"). equipment_type drives how
-- weight is displayed in the UI (bar + plates vs. per-hand vs. no external
-- load) — it never appears in the UI itself. Shared across the whole group
-- rather than per-user, since everyone benefits from the same catalog.
create table if not exists public.exercise_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  equipment_type public.equipment_type not null default 'other',
  created_at timestamptz not null default now()
);

-- A reusable plan for a single workout (e.g. "Push Day A"), owned by whoever
-- created it. Distinct from a logged workout: no actual sets/reps/weights,
-- duration, or RPE here — those only exist once you've done it.
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind public.workout_kind not null default 'lifting',
  created_at timestamptz not null default now()
);

-- Planned exercises within a lifting workout_template (target sets/reps, not
-- actual performance). Cardio templates don't use this table.
create table if not exists public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_definition_id uuid not null references public.exercise_definitions (id),
  target_sets int check (target_sets > 0),
  target_reps int check (target_reps > 0),
  position int not null default 0
);

-- A named, optionally time-boxed grouping of templates across days
-- (e.g. "Summer Cut", 8 weeks). length_days is nullable for open-ended
-- routines with no set end date.
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  length_days int check (length_days > 0),
  created_at timestamptz not null default now()
);

-- Which template runs on which day of a routine. A routine can mix lifting
-- and cardio templates across its days.
create table if not exists public.routine_workouts (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  day_index int not null check (day_index >= 0),
  position int not null default 0
);

-- Extend the existing workout log with what template it came from (nullable
-- — freeform workouts aren't tied to any routine), what kind it is, and the
-- performance data that only exists once a workout is actually done.
alter table public.workouts
  add column if not exists template_id uuid references public.workout_templates (id) on delete set null,
  add column if not exists kind public.workout_kind not null default 'lifting',
  add column if not exists duration_minutes numeric check (duration_minutes >= 0),
  add column if not exists rpe numeric check (rpe between 1 and 10);

-- Let exercises reference the shared catalog (drives weight-display logic).
-- Nullable so existing freeform rows keep working; new entries should set it.
alter table public.exercises
  add column if not exists exercise_definition_id uuid references public.exercise_definitions (id);

-- Cardio-specific detail, 1:1 with a workout of kind = 'cardio'. Actual
-- duration and RPE live on workouts itself (they apply to any workout kind);
-- this table only holds what's specific to cardio: the activity type,
-- intended vs. actual targets, and incline.
create table if not exists public.cardio_details (
  workout_id uuid primary key references public.workouts (id) on delete cascade,
  cardio_type public.cardio_type not null,
  intended_duration_minutes numeric check (intended_duration_minutes >= 0),
  intended_distance_km numeric check (intended_distance_km >= 0),
  actual_distance_km numeric check (actual_distance_km >= 0),
  incline_percent numeric check (incline_percent >= 0)
);

create index if not exists template_exercises_template_id_idx on public.template_exercises (template_id);
create index if not exists template_exercises_exercise_definition_id_idx on public.template_exercises (exercise_definition_id);
create index if not exists routine_workouts_routine_id_idx on public.routine_workouts (routine_id);
create index if not exists routine_workouts_template_id_idx on public.routine_workouts (template_id);
create index if not exists workout_templates_user_id_idx on public.workout_templates (user_id);
create index if not exists routines_user_id_idx on public.routines (user_id);
create index if not exists workouts_template_id_idx on public.workouts (template_id);
create index if not exists exercises_exercise_definition_id_idx on public.exercises (exercise_definition_id);

-- Row Level Security.
alter table public.exercise_definitions enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_workouts enable row level security;
alter table public.cardio_details enable row level security;

-- exercise_definitions: a shared catalog everyone can read and add to (no
-- update/delete policy — renaming/removing a shared entry isn't exposed via
-- the app yet, so it's left denied by default under RLS).
create policy "exercise_definitions are readable by any signed-in member" on public.exercise_definitions
  for select using (auth.role() = 'authenticated');

create policy "exercise_definitions are insertable by any signed-in member" on public.exercise_definitions
  for insert with check (auth.role() = 'authenticated');

-- workout_templates: read-all / write-own, same pattern as workouts.
create policy "workout_templates are readable by any signed-in member" on public.workout_templates
  for select using (auth.role() = 'authenticated');

create policy "workout_templates are writable only by their owner" on public.workout_templates
  for insert with check (auth.uid() = user_id);

create policy "workout_templates are updatable only by their owner" on public.workout_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workout_templates are deletable only by their owner" on public.workout_templates
  for delete using (auth.uid() = user_id);

-- template_exercises: read-all, write scoped via the parent template's owner.
create policy "template_exercises are readable by any signed-in member" on public.template_exercises
  for select using (auth.role() = 'authenticated');

create policy "template_exercises are writable only by their template's owner" on public.template_exercises
  for insert with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

create policy "template_exercises are updatable only by their template's owner" on public.template_exercises
  for update using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

create policy "template_exercises are deletable only by their template's owner" on public.template_exercises
  for delete using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

-- routines: read-all / write-own, same pattern as workouts.
create policy "routines are readable by any signed-in member" on public.routines
  for select using (auth.role() = 'authenticated');

create policy "routines are writable only by their owner" on public.routines
  for insert with check (auth.uid() = user_id);

create policy "routines are updatable only by their owner" on public.routines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "routines are deletable only by their owner" on public.routines
  for delete using (auth.uid() = user_id);

-- routine_workouts: read-all, write scoped via the parent routine's owner.
create policy "routine_workouts are readable by any signed-in member" on public.routine_workouts
  for select using (auth.role() = 'authenticated');

create policy "routine_workouts are writable only by their routine's owner" on public.routine_workouts
  for insert with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_workouts.routine_id and r.user_id = auth.uid()
    )
  );

create policy "routine_workouts are updatable only by their routine's owner" on public.routine_workouts
  for update using (
    exists (
      select 1 from public.routines r
      where r.id = routine_workouts.routine_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_workouts.routine_id and r.user_id = auth.uid()
    )
  );

create policy "routine_workouts are deletable only by their routine's owner" on public.routine_workouts
  for delete using (
    exists (
      select 1 from public.routines r
      where r.id = routine_workouts.routine_id and r.user_id = auth.uid()
    )
  );

-- cardio_details: read-all, write scoped via the parent workout's owner.
create policy "cardio_details are readable by any signed-in member" on public.cardio_details
  for select using (auth.role() = 'authenticated');

create policy "cardio_details are writable only by their workout's owner" on public.cardio_details
  for insert with check (
    exists (
      select 1 from public.workouts w
      where w.id = cardio_details.workout_id and w.user_id = auth.uid()
    )
  );

create policy "cardio_details are updatable only by their workout's owner" on public.cardio_details
  for update using (
    exists (
      select 1 from public.workouts w
      where w.id = cardio_details.workout_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workouts w
      where w.id = cardio_details.workout_id and w.user_id = auth.uid()
    )
  );

create policy "cardio_details are deletable only by their workout's owner" on public.cardio_details
  for delete using (
    exists (
      select 1 from public.workouts w
      where w.id = cardio_details.workout_id and w.user_id = auth.uid()
    )
  );
