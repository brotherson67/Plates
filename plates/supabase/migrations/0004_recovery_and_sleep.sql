-- Sleep + recovery-readiness tracking ("Trends" feature).
--
-- DEVIATION FROM THE REST OF THIS APP'S RLS PATTERN: every other table in
-- this schema (workouts, exercises, routines, templates, ...) uses
-- read-all/write-own policies, because workout progress is deliberately
-- visible across the whole trusted group (see 0001_init.sql). Sleep and
-- recovery check-in data is different - subjective personal health data a
-- user may not want their friends reading - so sleep_logs and
-- recovery_checkins intentionally use read-own/write-own instead:
-- `using (auth.uid() = user_id)` on SELECT too, not just insert/update/
-- delete. This is a deliberate, considered choice for these two tables
-- only - not an oversight, and should not be "fixed" to match the rest of
-- the schema without checking with the app owner first.

create extension if not exists pgcrypto;

-- One row per user per calendar day. hours_slept is nullable (a user might
-- log quality only); quality is required (the one thing recovery check-ins
-- always need). Upserted by the app via
-- `.upsert(row, { onConflict: 'user_id,sleep_date' })` against the unique
-- constraint below - the simplest correct way to get "re-logging today
-- updates today's row" without a trigger.
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sleep_date date not null,
  hours_slept numeric check (hours_slept >= 0 and hours_slept <= 24),
  quality int not null check (quality between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, sleep_date)
);

-- One row per user per calendar day. sleep_log_id is a genuine nullable FK
-- (not a duplicated value) so the check-in's "sleep quality" factor always
-- reflects that day's actual sleep_logs row via a join, and stays correct
-- if that sleep log is later edited. readiness_score is computed once at
-- write time by the app (see src/lib/health.ts's calculateReadinessScore)
-- and persisted here, not recomputed live from history, so historical
-- scores stay stable if the scoring formula is ever tweaked later.
create table if not exists public.recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_date date not null,
  sleep_log_id uuid references public.sleep_logs (id) on delete set null,
  soreness int not null check (soreness between 1 and 5),
  stress int not null check (stress between 1 and 5),
  motivation int not null check (motivation between 1 and 5),
  readiness_score numeric not null check (readiness_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

-- Indexes for trend queries (recent-N-days per user, most-recent-first).
create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs (user_id, sleep_date desc);
create index if not exists recovery_checkins_user_date_idx
  on public.recovery_checkins (user_id, checkin_date desc);
create index if not exists recovery_checkins_sleep_log_id_idx
  on public.recovery_checkins (sleep_log_id);

alter table public.sleep_logs enable row level security;
alter table public.recovery_checkins enable row level security;

create policy "sleep_logs are readable only by their owner" on public.sleep_logs
  for select using (auth.uid() = user_id);

create policy "sleep_logs are writable only by their owner" on public.sleep_logs
  for insert with check (auth.uid() = user_id);

create policy "sleep_logs are updatable only by their owner" on public.sleep_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sleep_logs are deletable only by their owner" on public.sleep_logs
  for delete using (auth.uid() = user_id);

-- recovery_checkins insert/update additionally guard that a linked
-- sleep_log_id (if any) actually belongs to the same user - defense in
-- depth on top of sleep_logs' own read-own RLS, which already means a user
-- could never discover another user's sleep_log id through the app.
create policy "recovery_checkins are readable only by their owner" on public.recovery_checkins
  for select using (auth.uid() = user_id);

create policy "recovery_checkins are writable only by their owner" on public.recovery_checkins
  for insert with check (
    auth.uid() = user_id
    and (
      sleep_log_id is null
      or exists (
        select 1 from public.sleep_logs s
        where s.id = recovery_checkins.sleep_log_id and s.user_id = auth.uid()
      )
    )
  );

create policy "recovery_checkins are updatable only by their owner" on public.recovery_checkins
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      sleep_log_id is null
      or exists (
        select 1 from public.sleep_logs s
        where s.id = recovery_checkins.sleep_log_id and s.user_id = auth.uid()
      )
    )
  );

create policy "recovery_checkins are deletable only by their owner" on public.recovery_checkins
  for delete using (auth.uid() = user_id);
