import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidSet, type CardioDetails, type Exercise, type Workout, type WorkoutSet } from './workout'

export interface LogLiftingWorkoutInput {
  kind: 'lifting'
  workoutDate: string
  templateId?: string | null
  durationMinutes?: number | null
  rpe?: number | null
  idempotencyKey: string
  exercises: Array<{ name: string; exerciseDefinitionId?: string | null; sets: WorkoutSet[] }>
}

export interface LogCardioWorkoutInput {
  kind: 'cardio'
  workoutDate: string
  templateId?: string | null
  durationMinutes?: number | null
  rpe?: number | null
  idempotencyKey: string
  cardio: CardioDetails
}

export type LogWorkoutInput = LogLiftingWorkoutInput | LogCardioWorkoutInput

export function validateLogWorkoutInput(input: LogWorkoutInput): string | null {
  if (input.kind === 'lifting') {
    if (input.exercises.length === 0) return 'Add at least one exercise.'
    for (const exercise of input.exercises) {
      if (!exercise.name.trim()) return 'Every exercise needs a name.'
      if (exercise.sets.length === 0) return `${exercise.name} needs at least one set.`
      if (exercise.sets.some((set) => !isValidSet(set))) return `${exercise.name} has an invalid set.`
    }
    return null
  }
  if (!input.cardio.cardioType) return 'Choose a cardio type.'
  return null
}

function toRpcPayload(input: LogWorkoutInput): Record<string, unknown> {
  const base = {
    idempotencyKey: input.idempotencyKey,
    kind: input.kind,
    workoutDate: input.workoutDate,
    templateId: input.templateId ?? null,
    durationMinutes: input.durationMinutes ?? null,
    rpe: input.rpe ?? null,
  }

  if (input.kind === 'cardio') {
    return {
      ...base,
      cardio: {
        cardioType: input.cardio.cardioType,
        intendedDurationMinutes: input.cardio.intendedDurationMinutes,
        intendedDistanceKm: input.cardio.intendedDistanceKm,
        actualDistanceKm: input.cardio.actualDistanceKm,
        inclinePercent: input.cardio.inclinePercent,
      },
      exercises: [],
    }
  }

  return {
    ...base,
    cardio: null,
    exercises: input.exercises.map((exercise) => ({
      name: exercise.name,
      exerciseDefinitionId: exercise.exerciseDefinitionId ?? null,
      sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
    })),
  }
}

function toLoggedWorkout(workoutId: string, input: LogWorkoutInput): Workout {
  const base = {
    id: workoutId,
    date: input.workoutDate,
    kind: input.kind,
    templateId: input.templateId ?? null,
    durationMinutes: input.durationMinutes ?? null,
    rpe: input.rpe ?? null,
  }

  if (input.kind === 'cardio') {
    return { ...base, exercises: [], cardio: input.cardio }
  }

  const exercises: Exercise[] = input.exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets,
    exerciseDefinitionId: exercise.exerciseDefinitionId ?? undefined,
  }))
  return { ...base, exercises }
}

// `userId` is unused by the RPC itself (the function derives auth.uid()
// server-side) but is kept in the signature for call-site/interface
// stability rather than churning every caller and test.
export async function logWorkout(client: SupabaseClient, _userId: string, input: LogWorkoutInput): Promise<Workout> {
  const invalidReason = validateLogWorkoutInput(input)
  if (invalidReason) throw new Error(invalidReason)

  const { data, error } = await client.rpc('log_workout', { payload: toRpcPayload(input) }).single()
  if (error) throw error
  const workoutId = (data as { workout_id: string }).workout_id

  return toLoggedWorkout(workoutId, input)
}
