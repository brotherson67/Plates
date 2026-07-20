import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidSet, type CardioDetails, type Exercise, type Workout, type WorkoutSet } from './workout'

export interface LogLiftingWorkoutInput {
  kind: 'lifting'
  workoutDate: string
  templateId?: string | null
  durationMinutes?: number | null
  rpe?: number | null
  exercises: Array<{ name: string; exerciseDefinitionId?: string | null; sets: WorkoutSet[] }>
}

export interface LogCardioWorkoutInput {
  kind: 'cardio'
  workoutDate: string
  templateId?: string | null
  durationMinutes?: number | null
  rpe?: number | null
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

interface IdRow {
  id: string
}

export async function logWorkout(client: SupabaseClient, userId: string, input: LogWorkoutInput): Promise<Workout> {
  const invalidReason = validateLogWorkoutInput(input)
  if (invalidReason) throw new Error(invalidReason)

  const { data: workoutRow, error: workoutError } = await client
    .from('workouts')
    .insert({
      user_id: userId,
      workout_date: input.workoutDate,
      template_id: input.templateId ?? null,
      kind: input.kind,
      duration_minutes: input.durationMinutes ?? null,
      rpe: input.rpe ?? null,
    })
    .select('id')
    .single()
  if (workoutError) throw workoutError
  const workoutId = (workoutRow as IdRow).id

  if (input.kind === 'cardio') {
    const { error: cardioError } = await client.from('cardio_details').insert({
      workout_id: workoutId,
      cardio_type: input.cardio.cardioType,
      intended_duration_minutes: input.cardio.intendedDurationMinutes,
      intended_distance_km: input.cardio.intendedDistanceKm,
      actual_distance_km: input.cardio.actualDistanceKm,
      incline_percent: input.cardio.inclinePercent,
    })
    if (cardioError) throw cardioError

    return {
      id: workoutId,
      date: input.workoutDate,
      exercises: [],
      kind: 'cardio',
      templateId: input.templateId ?? null,
      durationMinutes: input.durationMinutes ?? null,
      rpe: input.rpe ?? null,
      cardio: input.cardio,
    }
  }

  const exercises: Exercise[] = []
  for (let position = 0; position < input.exercises.length; position++) {
    const exerciseInput = input.exercises[position]
    const { data: exerciseRow, error: exerciseError } = await client
      .from('exercises')
      .insert({
        workout_id: workoutId,
        name: exerciseInput.name,
        position,
        exercise_definition_id: exerciseInput.exerciseDefinitionId ?? null,
      })
      .select('id')
      .single()
    if (exerciseError) throw exerciseError
    const exerciseId = (exerciseRow as IdRow).id

    const { error: setsError } = await client.from('workout_sets').insert(
      exerciseInput.sets.map((set, setPosition) => ({
        exercise_id: exerciseId,
        reps: set.reps,
        weight_kg: set.weightKg,
        position: setPosition,
      })),
    )
    if (setsError) throw setsError

    exercises.push({
      name: exerciseInput.name,
      sets: exerciseInput.sets,
      exerciseDefinitionId: exerciseInput.exerciseDefinitionId ?? undefined,
    })
  }

  return {
    id: workoutId,
    date: input.workoutDate,
    exercises,
    kind: 'lifting',
    templateId: input.templateId ?? null,
    durationMinutes: input.durationMinutes ?? null,
    rpe: input.rpe ?? null,
  }
}
