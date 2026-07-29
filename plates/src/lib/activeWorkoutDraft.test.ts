import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDraft,
  addSetToDraft,
  removeLastSetFromDraft,
  advanceToNextExercise,
  skipCurrentExercise,
  startRestTimer,
  clearRestTimer,
  setWorkoutMeta,
  draftToLogWorkoutInput,
  isDraftStale,
  saveDraft,
  loadDraft,
  clearDraftStorage,
  STALE_DRAFT_HOURS,
  type ActiveExerciseDraft,
  type ActiveWorkoutDraft,
} from './activeWorkoutDraft'

function baseExercises(): ActiveExerciseDraft[] {
  return [
    { exerciseDefinitionId: 'ex-squat', name: 'Squat', targetSets: 3, targetReps: 5, sets: [], skipped: false },
    { exerciseDefinitionId: 'ex-bench', name: 'Bench Press', targetSets: 3, targetReps: 8, sets: [], skipped: false },
  ]
}

function baseDraft(overrides: Partial<ActiveWorkoutDraft> = {}): ActiveWorkoutDraft {
  return {
    ...createDraft({
      kind: 'lifting',
      templateId: 't1',
      routineWorkoutId: null,
      workoutDate: '2026-07-20',
      exercises: baseExercises(),
    }),
    ...overrides,
  }
}

describe('createDraft', () => {
  it('builds a draft with a fresh idempotency key and starting state', () => {
    const draft = createDraft({
      kind: 'lifting',
      templateId: 't1',
      routineWorkoutId: 'rw1',
      workoutDate: '2026-07-20',
      exercises: baseExercises(),
    })

    expect(draft.version).toBe(1)
    expect(draft.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(draft.currentExerciseIndex).toBe(0)
    expect(draft.restTimer).toBeNull()
    expect(draft.templateId).toBe('t1')
    expect(draft.routineWorkoutId).toBe('rw1')
    expect(draft.exercises).toHaveLength(2)
  })

  it('gives two drafts different idempotency keys', () => {
    const a = createDraft({ kind: 'lifting', templateId: null, routineWorkoutId: null, workoutDate: 'x', exercises: [] })
    const b = createDraft({ kind: 'lifting', templateId: null, routineWorkoutId: null, workoutDate: 'x', exercises: [] })
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })
})

describe('addSetToDraft', () => {
  it('appends a set to the given exercise and starts a rest timer', () => {
    const draft = addSetToDraft(baseDraft(), 0, { reps: 5, weightKg: 100 })
    expect(draft.exercises[0].sets).toHaveLength(1)
    expect(draft.exercises[0].sets[0]).toMatchObject({ reps: 5, weightKg: 100 })
    expect(draft.exercises[0].sets[0].completedAt).toEqual(expect.any(String))
    expect(draft.exercises[1].sets).toHaveLength(0)
    expect(draft.restTimer).not.toBeNull()
  })

  it('does not mutate the original draft', () => {
    const original = baseDraft()
    addSetToDraft(original, 0, { reps: 5, weightKg: 100 })
    expect(original.exercises[0].sets).toHaveLength(0)
  })
})

describe('removeLastSetFromDraft', () => {
  it('removes only the most recently added set for that exercise', () => {
    let draft = addSetToDraft(baseDraft(), 0, { reps: 5, weightKg: 100 })
    draft = addSetToDraft(draft, 0, { reps: 5, weightKg: 105 })
    draft = removeLastSetFromDraft(draft, 0)
    expect(draft.exercises[0].sets).toEqual([{ reps: 5, weightKg: 100, completedAt: expect.any(String) }])
  })
})

describe('advanceToNextExercise / skipCurrentExercise', () => {
  it('moves to the next exercise and clears the rest timer', () => {
    const draft = startRestTimer(baseDraft(), 90)
    const advanced = advanceToNextExercise(draft)
    expect(advanced.currentExerciseIndex).toBe(1)
    expect(advanced.restTimer).toBeNull()
  })

  it('clamps at the last exercise instead of going out of bounds', () => {
    const draft = advanceToNextExercise(advanceToNextExercise(baseDraft()))
    expect(draft.currentExerciseIndex).toBe(1)
  })

  it('marks the current exercise skipped and advances', () => {
    const draft = skipCurrentExercise(baseDraft())
    expect(draft.exercises[0].skipped).toBe(true)
    expect(draft.currentExerciseIndex).toBe(1)
  })
})

describe('startRestTimer / clearRestTimer', () => {
  it('sets and clears the rest timer state', () => {
    const started = startRestTimer(baseDraft(), 90)
    expect(started.restTimer).toEqual({ startedAt: expect.any(String), durationSeconds: 90 })
    expect(clearRestTimer(started).restTimer).toBeNull()
  })
})

describe('setWorkoutMeta', () => {
  it('updates duration and rpe without touching other fields', () => {
    const draft = setWorkoutMeta(baseDraft(), { durationMinutes: 45, rpe: 8 })
    expect(draft.durationMinutes).toBe(45)
    expect(draft.rpe).toBe(8)
  })

  it('leaves a field unchanged when omitted from the update', () => {
    const draft = setWorkoutMeta(setWorkoutMeta(baseDraft(), { durationMinutes: 45 }), { rpe: 8 })
    expect(draft.durationMinutes).toBe(45)
    expect(draft.rpe).toBe(8)
  })
})

describe('draftToLogWorkoutInput', () => {
  it('maps a lifting draft, dropping exercises with no logged sets', () => {
    let draft = baseDraft({ durationMinutes: 45, rpe: 8 })
    draft = addSetToDraft(draft, 0, { reps: 5, weightKg: 100 })

    const input = draftToLogWorkoutInput(draft)
    expect(input).toEqual({
      kind: 'lifting',
      workoutDate: '2026-07-20',
      templateId: 't1',
      durationMinutes: 45,
      rpe: 8,
      idempotencyKey: draft.idempotencyKey,
      exercises: [{ name: 'Squat', exerciseDefinitionId: 'ex-squat', sets: [{ reps: 5, weightKg: 100 }] }],
    })
  })

  it('maps a cardio draft', () => {
    const cardio = {
      cardioType: 'jog' as const,
      intendedDurationMinutes: 30,
      intendedDistanceKm: 5,
      actualDistanceKm: null,
      inclinePercent: null,
    }
    const draft = createDraft({
      kind: 'cardio',
      templateId: null,
      routineWorkoutId: null,
      workoutDate: '2026-07-20',
      exercises: [],
      cardio,
    })

    const input = draftToLogWorkoutInput(draft)
    expect(input).toEqual({
      kind: 'cardio',
      workoutDate: '2026-07-20',
      templateId: null,
      durationMinutes: null,
      rpe: null,
      idempotencyKey: draft.idempotencyKey,
      cardio,
    })
  })
})

describe('isDraftStale', () => {
  it('is not stale right after starting', () => {
    expect(isDraftStale(baseDraft())).toBe(false)
  })

  it(`is stale past ${STALE_DRAFT_HOURS} hours old`, () => {
    const draft = baseDraft()
    const past = new Date(Date.parse(draft.startedAt) + (STALE_DRAFT_HOURS + 1) * 60 * 60 * 1000)
    expect(isDraftStale(draft, past)).toBe(true)
  })

  it(`is not stale just under ${STALE_DRAFT_HOURS} hours old`, () => {
    const draft = baseDraft()
    const past = new Date(Date.parse(draft.startedAt) + (STALE_DRAFT_HOURS - 1) * 60 * 60 * 1000)
    expect(isDraftStale(draft, past)).toBe(false)
  })
})

describe('saveDraft / loadDraft / clearDraftStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a draft through localStorage', () => {
    const draft = baseDraft()
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('returns null when nothing is stored', () => {
    expect(loadDraft()).toBeNull()
  })

  it('returns null for malformed JSON instead of throwing', () => {
    window.localStorage.setItem('plates:activeWorkoutDraft:v1', '{not json')
    expect(loadDraft()).toBeNull()
  })

  it('returns null for a wrong-version or missing-field draft', () => {
    window.localStorage.setItem('plates:activeWorkoutDraft:v1', JSON.stringify({ version: 2, idempotencyKey: 'x' }))
    expect(loadDraft()).toBeNull()
  })

  it('clears the stored draft', () => {
    saveDraft(baseDraft())
    clearDraftStorage()
    expect(loadDraft()).toBeNull()
  })
})
