export interface WorkoutSet {
  reps: number
  weightKg: number
}

export interface Exercise {
  name: string
  sets: WorkoutSet[]
}

export interface Workout {
  id: string
  date: string
  exercises: Exercise[]
}

export type WeightUnit = 'kg' | 'lb'

const KG_TO_LB = 2.2046226218

export function isValidSet(set: WorkoutSet): boolean {
  return Number.isFinite(set.reps) && set.reps > 0 && Number.isFinite(set.weightKg) && set.weightKg >= 0
}

export function calculateSetVolume(set: WorkoutSet): number {
  if (!isValidSet(set)) return 0
  return set.reps * set.weightKg
}

export function calculateExerciseVolume(exercise: Exercise): number {
  return exercise.sets.reduce((total, set) => total + calculateSetVolume(set), 0)
}

export function calculateWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + calculateExerciseVolume(exercise), 0)
}

export function convertWeight(weightKg: number, unit: WeightUnit): number {
  return unit === 'lb' ? weightKg * KG_TO_LB : weightKg
}

export function formatWeight(weightKg: number, unit: WeightUnit): string {
  const value = convertWeight(weightKg, unit)
  const rounded = Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}

export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  return formatWeight(volumeKg, unit)
}
