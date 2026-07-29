import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkoutSet } from './workout'

export interface PriorPerformance {
  workoutDate: string
  sets: WorkoutSet[]
}

interface PriorPerformanceRow {
  workouts: { workout_date: string; created_at: string }
  workout_sets: Array<{ reps: number; weight_kg: number; position: number }>
}

function fromRow(row: PriorPerformanceRow): PriorPerformance {
  return {
    workoutDate: row.workouts.workout_date,
    sets: [...row.workout_sets]
      .sort((a, b) => a.position - b.position)
      .map((set) => ({ reps: set.reps, weightKg: set.weight_kg })),
  }
}

// The current user's most recently logged sets for a given exercise
// (by workout_date desc, then created_at desc as a tiebreaker) - "your last
// time doing this lift," not the group's. Returns null if it's never been
// logged before.
export async function getPriorPerformance(
  client: SupabaseClient,
  userId: string,
  exerciseDefinitionId: string,
): Promise<PriorPerformance | null> {
  const { data, error } = await client
    .from('exercises')
    .select('workouts!inner(workout_date, created_at, user_id), workout_sets(reps, weight_kg, position)')
    .eq('exercise_definition_id', exerciseDefinitionId)
    .eq('workouts.user_id', userId)
    .order('workout_date', { referencedTable: 'workouts', ascending: false })
    .order('created_at', { referencedTable: 'workouts', ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  // supabase-js infers `workouts!inner(...)` as an array without generated
  // Database types to confirm the join is many-to-one; at runtime Postgrest
  // still returns a single object for `!inner`, so this cast reflects the
  // actual row shape, not the client's best-guess type.
  return fromRow(data as unknown as PriorPerformanceRow)
}
