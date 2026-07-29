import type { CardioDetails, WorkoutKind } from './workout'
import type { LogWorkoutInput } from './logWorkout'

export interface ActiveSetDraft {
  reps: number
  weightKg: number
  completedAt: string
}

export interface ActiveExerciseDraft {
  exerciseDefinitionId: string
  name: string
  targetSets: number | null
  targetReps: number | null
  sets: ActiveSetDraft[]
  skipped: boolean
}

export interface RestTimerState {
  startedAt: string
  durationSeconds: number
}

export interface ActiveWorkoutDraft {
  version: 1
  idempotencyKey: string
  kind: WorkoutKind
  templateId: string | null
  routineWorkoutId: string | null
  startedAt: string
  currentExerciseIndex: number
  exercises: ActiveExerciseDraft[]
  restTimer: RestTimerState | null
  durationMinutes: number | null
  rpe: number | null
  cardio: CardioDetails | null
  workoutDate: string
}

const STORAGE_KEY = 'plates:activeWorkoutDraft:v1'
const DEFAULT_REST_SECONDS = 90

// A same-day reload/crash should resume silently. Only past this age does a
// leftover draft likely mean an abandoned/forgotten session worth asking
// about instead of just resuming into.
export const STALE_DRAFT_HOURS = 20

// --- Pure state transitions (no localStorage access, fully unit-testable) ---

export function createDraft(input: {
  kind: WorkoutKind
  templateId: string | null
  routineWorkoutId: string | null
  workoutDate: string
  exercises: ActiveExerciseDraft[]
  cardio?: CardioDetails | null
}): ActiveWorkoutDraft {
  return {
    version: 1,
    idempotencyKey: crypto.randomUUID(),
    kind: input.kind,
    templateId: input.templateId,
    routineWorkoutId: input.routineWorkoutId,
    startedAt: new Date().toISOString(),
    currentExerciseIndex: 0,
    exercises: input.exercises,
    restTimer: null,
    durationMinutes: null,
    rpe: null,
    cardio: input.cardio ?? null,
    workoutDate: input.workoutDate,
  }
}

export function addSetToDraft(
  draft: ActiveWorkoutDraft,
  exerciseIndex: number,
  set: { reps: number; weightKg: number },
): ActiveWorkoutDraft {
  const exercises = draft.exercises.map((exercise, i) =>
    i === exerciseIndex
      ? { ...exercise, sets: [...exercise.sets, { ...set, completedAt: new Date().toISOString() }] }
      : exercise,
  )
  return startRestTimer({ ...draft, exercises }, DEFAULT_REST_SECONDS)
}

export function removeLastSetFromDraft(draft: ActiveWorkoutDraft, exerciseIndex: number): ActiveWorkoutDraft {
  const exercises = draft.exercises.map((exercise, i) =>
    i === exerciseIndex ? { ...exercise, sets: exercise.sets.slice(0, -1) } : exercise,
  )
  return { ...draft, exercises }
}

function clampExerciseIndex(draft: ActiveWorkoutDraft, index: number): number {
  return Math.max(0, Math.min(index, draft.exercises.length - 1))
}

export function advanceToNextExercise(draft: ActiveWorkoutDraft): ActiveWorkoutDraft {
  return {
    ...draft,
    currentExerciseIndex: clampExerciseIndex(draft, draft.currentExerciseIndex + 1),
    restTimer: null,
  }
}

export function skipCurrentExercise(draft: ActiveWorkoutDraft): ActiveWorkoutDraft {
  const exercises = draft.exercises.map((exercise, i) =>
    i === draft.currentExerciseIndex ? { ...exercise, skipped: true } : exercise,
  )
  return advanceToNextExercise({ ...draft, exercises })
}

export function startRestTimer(draft: ActiveWorkoutDraft, durationSeconds: number): ActiveWorkoutDraft {
  return { ...draft, restTimer: { startedAt: new Date().toISOString(), durationSeconds } }
}

export function clearRestTimer(draft: ActiveWorkoutDraft): ActiveWorkoutDraft {
  return { ...draft, restTimer: null }
}

export function setWorkoutMeta(
  draft: ActiveWorkoutDraft,
  meta: { durationMinutes?: number | null; rpe?: number | null },
): ActiveWorkoutDraft {
  return {
    ...draft,
    durationMinutes: meta.durationMinutes !== undefined ? meta.durationMinutes : draft.durationMinutes,
    rpe: meta.rpe !== undefined ? meta.rpe : draft.rpe,
  }
}

export function draftToLogWorkoutInput(draft: ActiveWorkoutDraft): LogWorkoutInput {
  if (draft.kind === 'cardio') {
    return {
      kind: 'cardio',
      workoutDate: draft.workoutDate,
      templateId: draft.templateId,
      durationMinutes: draft.durationMinutes,
      rpe: draft.rpe,
      idempotencyKey: draft.idempotencyKey,
      cardio: draft.cardio as CardioDetails,
    }
  }
  return {
    kind: 'lifting',
    workoutDate: draft.workoutDate,
    templateId: draft.templateId,
    durationMinutes: draft.durationMinutes,
    rpe: draft.rpe,
    idempotencyKey: draft.idempotencyKey,
    exercises: draft.exercises
      .filter((exercise) => exercise.sets.length > 0)
      .map((exercise) => ({
        name: exercise.name,
        exerciseDefinitionId: exercise.exerciseDefinitionId || undefined,
        sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      })),
  }
}

export function isDraftStale(draft: ActiveWorkoutDraft, now: Date = new Date()): boolean {
  const ageHours = (now.getTime() - Date.parse(draft.startedAt)) / (1000 * 60 * 60)
  return ageHours > STALE_DRAFT_HOURS
}

// --- localStorage boundary (thin, side-effecting, kept separate from the
// pure transitions above so those stay unit-testable without a DOM) ---

function isValidDraftShape(value: unknown): value is ActiveWorkoutDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    draft.version === 1 &&
    typeof draft.idempotencyKey === 'string' &&
    typeof draft.startedAt === 'string' &&
    Array.isArray(draft.exercises)
  )
}

// Always go through `window.localStorage`, not the bare `localStorage`
// global - Node's own built-in Storage implementation can otherwise shadow
// jsdom's under the test runner, silently pointing reads/writes at the
// wrong store.
//
// Never throws: localStorage can fail (quota, private-mode Safari), and a
// failed save must not crash the workout the user is mid-way through.
export function saveDraft(draft: ActiveWorkoutDraft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Best-effort persistence; the in-memory draft is still valid this session.
  }
}

// Never throws: missing, corrupt, or old-shape data is treated as "no draft"
// rather than bricking the app on reload.
export function loadDraft(): ActiveWorkoutDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidDraftShape(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearDraftStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if this fails; the key will simply be overwritten next session.
  }
}
