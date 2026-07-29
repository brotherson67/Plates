-- Idempotent, atomic workout save: wraps the workout + exercises + sets
-- (or cardio_details) insert in a single Postgres function so a dropped
-- connection mid-save can never leave an orphaned/partial workout, and a
-- client-side retry after a failure can't create a duplicate.

alter table public.workouts
  add column if not exists idempotency_key uuid;

create unique index if not exists workouts_user_idempotency_key_idx
  on public.workouts (user_id, idempotency_key)
  where idempotency_key is not null;

-- Payload shape (jsonb) passed from the client, mirroring LogWorkoutInput:
-- {
--   "idempotencyKey": uuid,
--   "kind": "lifting" | "cardio",
--   "workoutDate": "yyyy-mm-dd",
--   "templateId": uuid | null,
--   "durationMinutes": number | null,
--   "rpe": number | null,
--   "exercises": [{ "name": text, "exerciseDefinitionId": uuid | null,
--                    "sets": [{ "reps": int, "weightKg": numeric }] }],
--   "cardio": { ... } | null
-- }
create or replace function public.log_workout(payload jsonb)
returns table (workout_id uuid)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_idempotency_key uuid := (payload ->> 'idempotencyKey')::uuid;
  v_existing_id uuid;
  v_workout_id uuid;
  v_exercise jsonb;
  v_exercise_id uuid;
  v_position int := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotent short-circuit: same user + key already saved -> return it,
  -- rather than insert a duplicate. Retries always resend the same payload
  -- under the same key, so no reconciliation of the row contents is needed.
  select id into v_existing_id
  from public.workouts
  where user_id = v_user_id and idempotency_key = v_idempotency_key;

  if v_existing_id is not null then
    return query select v_existing_id;
    return;
  end if;

  insert into public.workouts (user_id, workout_date, template_id, kind, duration_minutes, rpe, idempotency_key)
  values (
    v_user_id,
    (payload ->> 'workoutDate')::date,
    nullif(payload ->> 'templateId', '')::uuid,
    (payload ->> 'kind')::public.workout_kind,
    (payload ->> 'durationMinutes')::numeric,
    (payload ->> 'rpe')::numeric,
    v_idempotency_key
  )
  returning id into v_workout_id;

  if (payload ->> 'kind') = 'cardio' then
    insert into public.cardio_details (
      workout_id, cardio_type, intended_duration_minutes, intended_distance_km, actual_distance_km, incline_percent
    )
    select
      v_workout_id,
      (payload -> 'cardio' ->> 'cardioType')::public.cardio_type,
      (payload -> 'cardio' ->> 'intendedDurationMinutes')::numeric,
      (payload -> 'cardio' ->> 'intendedDistanceKm')::numeric,
      (payload -> 'cardio' ->> 'actualDistanceKm')::numeric,
      (payload -> 'cardio' ->> 'inclinePercent')::numeric;
  else
    for v_exercise in select * from jsonb_array_elements(payload -> 'exercises')
    loop
      insert into public.exercises (workout_id, name, position, exercise_definition_id)
      values (
        v_workout_id,
        v_exercise ->> 'name',
        v_position,
        nullif(v_exercise ->> 'exerciseDefinitionId', '')::uuid
      )
      returning id into v_exercise_id;

      insert into public.workout_sets (exercise_id, reps, weight_kg, position)
      select
        v_exercise_id,
        (s.value ->> 'reps')::int,
        (s.value ->> 'weightKg')::numeric,
        s.ordinality - 1
      from jsonb_array_elements(v_exercise -> 'sets') with ordinality as s(value, ordinality);

      v_position := v_position + 1;
    end loop;
  end if;

  return query select v_workout_id;
end;
$$;

grant execute on function public.log_workout(jsonb) to authenticated;
