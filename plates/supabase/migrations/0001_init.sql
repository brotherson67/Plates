-- Initial schema for the Plates workout tracker.
-- This is a small, trusted group (the user + a few friends/family): every
-- signed-in member can VIEW everyone's workout history, but can only
-- create/edit/delete their own. There is no public/anonymous access — the
-- Supabase project's signups should be restricted to invited members only.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  reps int not null check (reps > 0),
  weight_kg numeric not null check (weight_kg >= 0),
  position int not null default 0
);

create index if not exists workouts_user_id_idx on public.workouts (user_id);
create index if not exists exercises_workout_id_idx on public.exercises (workout_id);
create index if not exists workout_sets_exercise_id_idx on public.workout_sets (exercise_id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: every user can only read/write their own data.
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;

-- profiles: any signed-in group member can see everyone's display name;
-- only the user themself can edit their own profile.
create policy "profiles are readable by any signed-in member" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles are self-updatable" on public.profiles
  for update using (auth.uid() = id);

-- workouts: any signed-in member can view everyone's workouts (so progress
-- is visible across the group); only the owner can create/edit/delete theirs.
create policy "workouts are readable by any signed-in member" on public.workouts
  for select using (auth.role() = 'authenticated');

create policy "workouts are writable only by their owner" on public.workouts
  for insert with check (auth.uid() = user_id);

create policy "workouts are updatable only by their owner" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workouts are deletable only by their owner" on public.workouts
  for delete using (auth.uid() = user_id);

-- exercises: same read-all / write-own-only pattern, scoped via the parent workout.
create policy "exercises are readable by any signed-in member" on public.exercises
  for select using (auth.role() = 'authenticated');

create policy "exercises are writable only by their workout's owner" on public.exercises
  for insert with check (
    exists (
      select 1 from public.workouts w
      where w.id = exercises.workout_id and w.user_id = auth.uid()
    )
  );

create policy "exercises are updatable only by their workout's owner" on public.exercises
  for update using (
    exists (
      select 1 from public.workouts w
      where w.id = exercises.workout_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workouts w
      where w.id = exercises.workout_id and w.user_id = auth.uid()
    )
  );

create policy "exercises are deletable only by their workout's owner" on public.exercises
  for delete using (
    exists (
      select 1 from public.workouts w
      where w.id = exercises.workout_id and w.user_id = auth.uid()
    )
  );

-- workout_sets: same read-all / write-own-only pattern, scoped via exercise -> workout.
create policy "sets are readable by any signed-in member" on public.workout_sets
  for select using (auth.role() = 'authenticated');

create policy "sets are writable only by their exercise's owner" on public.workout_sets
  for insert with check (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = workout_sets.exercise_id and w.user_id = auth.uid()
    )
  );

create policy "sets are updatable only by their exercise's owner" on public.workout_sets
  for update using (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = workout_sets.exercise_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = workout_sets.exercise_id and w.user_id = auth.uid()
    )
  );

create policy "sets are deletable only by their exercise's owner" on public.workout_sets
  for delete using (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = workout_sets.exercise_id and w.user_id = auth.uid()
    )
  );
