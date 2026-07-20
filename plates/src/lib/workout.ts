export interface WorkoutSet {
  reps: number
  weightKg: number
}

export interface Exercise {
  name: string
  sets: WorkoutSet[]
  exerciseDefinitionId?: string
  equipmentType?: EquipmentType
}

export type WorkoutKind = 'lifting' | 'cardio'
export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'other'
export type CardioType = 'steady_state' | 'hiit' | 'jog' | 'walk' | 'sprints'

export interface CardioDetails {
  cardioType: CardioType
  intendedDurationMinutes: number | null
  intendedDistanceKm: number | null
  actualDistanceKm: number | null
  inclinePercent: number | null
}

export interface Workout {
  id: string
  date: string
  exercises: Exercise[]
  kind?: WorkoutKind
  templateId?: string | null
  durationMinutes?: number | null
  rpe?: number | null
  cardio?: CardioDetails | null
}

export interface ExerciseDefinition {
  id: string
  name: string
  equipmentType: EquipmentType
}

export interface TemplateExercise {
  id: string
  exerciseDefinitionId: string
  targetSets: number | null
  targetReps: number | null
  position: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  kind: WorkoutKind
  exercises: TemplateExercise[]
}

export interface Routine {
  id: string
  name: string
  lengthDays: number | null
}

export interface RoutineWorkout {
  id: string
  routineId: string
  templateId: string
  dayIndex: number
  position: number
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
