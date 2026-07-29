import { describe, it, expect } from 'vitest'
import { logWorkout, validateLogWorkoutInput, type LogCardioWorkoutInput, type LogLiftingWorkoutInput } from './logWorkout'
import { fakeClientReturning } from './testSupabase'

describe('validateLogWorkoutInput', () => {
  it('rejects a lifting workout with no exercises', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'key-1',
      exercises: [],
    }
    expect(validateLogWorkoutInput(input)).toBe('Add at least one exercise.')
  })

  it('rejects an exercise with no sets', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'key-1',
      exercises: [{ name: 'Squat', sets: [] }],
    }
    expect(validateLogWorkoutInput(input)).toBe('Squat needs at least one set.')
  })

  it('rejects an invalid set (zero reps)', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'key-1',
      exercises: [{ name: 'Squat', sets: [{ reps: 0, weightKg: 100 }] }],
    }
    expect(validateLogWorkoutInput(input)).toBe('Squat has an invalid set.')
  })

  it('accepts a valid lifting workout', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'key-1',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    expect(validateLogWorkoutInput(input)).toBeNull()
  })

  it('accepts a valid cardio workout', () => {
    const input: LogCardioWorkoutInput = {
      kind: 'cardio',
      workoutDate: '2026-07-20',
      idempotencyKey: 'key-1',
      cardio: {
        cardioType: 'jog',
        intendedDurationMinutes: 30,
        intendedDistanceKm: 5,
        actualDistanceKm: 5.2,
        inclinePercent: null,
      },
    }
    expect(validateLogWorkoutInput(input)).toBeNull()
  })
})

describe('logWorkout (integration: single atomic log_workout RPC call)', () => {
  it('calls the log_workout RPC with a correctly-shaped jsonb payload for a lifting workout', async () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      durationMinutes: 45,
      rpe: 8,
      idempotencyKey: 'idem-1',
      exercises: [
        { name: 'Squat', exerciseDefinitionId: 'ex-squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
        { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
      ],
    }

    const { client, rpc, from } = fakeClientReturning({ data: { workout_id: 'w1' }, error: null })

    const workout = await logWorkout(client, 'u1', input)

    expect(rpc).toHaveBeenCalledWith('log_workout', {
      payload: {
        idempotencyKey: 'idem-1',
        kind: 'lifting',
        workoutDate: '2026-07-20',
        templateId: null,
        durationMinutes: 45,
        rpe: 8,
        cardio: null,
        exercises: [
          { name: 'Squat', exerciseDefinitionId: 'ex-squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
          { name: 'Bench Press', exerciseDefinitionId: null, sets: [{ reps: 8, weightKg: 60 }] },
        ],
      },
    })
    expect(from).not.toHaveBeenCalled()

    expect(workout).toEqual({
      id: 'w1',
      date: '2026-07-20',
      kind: 'lifting',
      templateId: null,
      durationMinutes: 45,
      rpe: 8,
      exercises: [
        { name: 'Squat', exerciseDefinitionId: 'ex-squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
        { name: 'Bench Press', exerciseDefinitionId: undefined, sets: [{ reps: 8, weightKg: 60 }] },
      ],
    })
  })

  it('calls the log_workout RPC with a correctly-shaped jsonb payload for a cardio workout', async () => {
    const input: LogCardioWorkoutInput = {
      kind: 'cardio',
      workoutDate: '2026-07-20',
      durationMinutes: 32,
      rpe: 6,
      idempotencyKey: 'idem-2',
      cardio: {
        cardioType: 'jog',
        intendedDurationMinutes: 30,
        intendedDistanceKm: 5,
        actualDistanceKm: 5.4,
        inclinePercent: 1.5,
      },
    }

    const { client, rpc } = fakeClientReturning({ data: { workout_id: 'w2' }, error: null })

    const workout = await logWorkout(client, 'u1', input)

    expect(rpc).toHaveBeenCalledWith('log_workout', {
      payload: {
        idempotencyKey: 'idem-2',
        kind: 'cardio',
        workoutDate: '2026-07-20',
        templateId: null,
        durationMinutes: 32,
        rpe: 6,
        cardio: {
          cardioType: 'jog',
          intendedDurationMinutes: 30,
          intendedDistanceKm: 5,
          actualDistanceKm: 5.4,
          inclinePercent: 1.5,
        },
        exercises: [],
      },
    })

    expect(workout).toEqual({
      id: 'w2',
      date: '2026-07-20',
      exercises: [],
      kind: 'cardio',
      templateId: null,
      durationMinutes: 32,
      rpe: 6,
      cardio: input.cardio,
    })
  })

  it('throws when the RPC call returns an error', async () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'idem-3',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    const { client, rpc } = fakeClientReturning({ data: null, error: new Error('connection dropped') })

    await expect(logWorkout(client, 'u1', input)).rejects.toThrow('connection dropped')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input before making any RPC call', async () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      idempotencyKey: 'idem-4',
      exercises: [],
    }
    const { client, rpc } = fakeClientReturning({ data: { workout_id: 'w1' }, error: null })

    await expect(logWorkout(client, 'u1', input)).rejects.toThrow('Add at least one exercise.')
    expect(rpc).not.toHaveBeenCalled()
  })
})
