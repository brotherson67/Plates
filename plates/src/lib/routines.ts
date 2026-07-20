import type { SupabaseClient } from '@supabase/supabase-js'
import type { Routine, RoutineWorkout, TemplateExercise, WorkoutKind, WorkoutTemplate } from './workout'

interface WorkoutTemplateRow {
  id: string
  name: string
  kind: WorkoutKind
}

interface TemplateExerciseRow {
  id: string
  exercise_definition_id: string
  target_sets: number | null
  target_reps: number | null
  position: number
}

interface RoutineRow {
  id: string
  name: string
  length_days: number | null
}

interface RoutineWorkoutRow {
  id: string
  routine_id: string
  template_id: string
  day_index: number
  position: number
}

function templateFromRow(row: WorkoutTemplateRow): WorkoutTemplate {
  return { id: row.id, name: row.name, kind: row.kind, exercises: [] }
}

function templateExerciseFromRow(row: TemplateExerciseRow): TemplateExercise {
  return {
    id: row.id,
    exerciseDefinitionId: row.exercise_definition_id,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    position: row.position,
  }
}

function routineFromRow(row: RoutineRow): Routine {
  return { id: row.id, name: row.name, lengthDays: row.length_days }
}

function routineWorkoutFromRow(row: RoutineWorkoutRow): RoutineWorkout {
  return {
    id: row.id,
    routineId: row.routine_id,
    templateId: row.template_id,
    dayIndex: row.day_index,
    position: row.position,
  }
}

export async function createWorkoutTemplate(
  client: SupabaseClient,
  userId: string,
  name: string,
  kind: WorkoutKind,
): Promise<WorkoutTemplate> {
  const { data, error } = await client
    .from('workout_templates')
    .insert({ user_id: userId, name, kind })
    .select('id, name, kind')
    .single()
  if (error) throw error
  return templateFromRow(data as WorkoutTemplateRow)
}

export async function listWorkoutTemplates(client: SupabaseClient): Promise<WorkoutTemplate[]> {
  const { data, error } = await client.from('workout_templates').select('id, name, kind').order('name')
  if (error) throw error
  return ((data ?? []) as WorkoutTemplateRow[]).map(templateFromRow)
}

export async function addTemplateExercise(
  client: SupabaseClient,
  templateId: string,
  exerciseDefinitionId: string,
  options: { targetSets?: number | null; targetReps?: number | null; position?: number } = {},
): Promise<TemplateExercise> {
  const { data, error } = await client
    .from('template_exercises')
    .insert({
      template_id: templateId,
      exercise_definition_id: exerciseDefinitionId,
      target_sets: options.targetSets ?? null,
      target_reps: options.targetReps ?? null,
      position: options.position ?? 0,
    })
    .select('id, exercise_definition_id, target_sets, target_reps, position')
    .single()
  if (error) throw error
  return templateExerciseFromRow(data as TemplateExerciseRow)
}

export async function listTemplateExercises(client: SupabaseClient, templateId: string): Promise<TemplateExercise[]> {
  const { data, error } = await client
    .from('template_exercises')
    .select('id, exercise_definition_id, target_sets, target_reps, position')
    .eq('template_id', templateId)
    .order('position')
  if (error) throw error
  return ((data ?? []) as TemplateExerciseRow[]).map(templateExerciseFromRow)
}

export async function createRoutine(
  client: SupabaseClient,
  userId: string,
  name: string,
  lengthDays: number | null = null,
): Promise<Routine> {
  const { data, error } = await client
    .from('routines')
    .insert({ user_id: userId, name, length_days: lengthDays })
    .select('id, name, length_days')
    .single()
  if (error) throw error
  return routineFromRow(data as RoutineRow)
}

export async function listRoutines(client: SupabaseClient): Promise<Routine[]> {
  const { data, error } = await client.from('routines').select('id, name, length_days').order('name')
  if (error) throw error
  return ((data ?? []) as RoutineRow[]).map(routineFromRow)
}

export async function addRoutineWorkout(
  client: SupabaseClient,
  routineId: string,
  templateId: string,
  dayIndex: number,
  position = 0,
): Promise<RoutineWorkout> {
  const { data, error } = await client
    .from('routine_workouts')
    .insert({ routine_id: routineId, template_id: templateId, day_index: dayIndex, position })
    .select('id, routine_id, template_id, day_index, position')
    .single()
  if (error) throw error
  return routineWorkoutFromRow(data as RoutineWorkoutRow)
}

export async function listRoutineWorkouts(client: SupabaseClient, routineId: string): Promise<RoutineWorkout[]> {
  const { data, error } = await client
    .from('routine_workouts')
    .select('id, routine_id, template_id, day_index, position')
    .eq('routine_id', routineId)
    .order('day_index')
  if (error) throw error
  return ((data ?? []) as RoutineWorkoutRow[]).map(routineWorkoutFromRow)
}
