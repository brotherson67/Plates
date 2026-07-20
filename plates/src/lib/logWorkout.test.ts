import { describe, it, expect } from 'vitest'
import { logWorkout, validateLogWorkoutInput, type LogCardioWorkoutInput, type LogLiftingWorkoutInput } from './logWorkout'
import { fakeClientSequence, fakeClientReturning } from './testSupabase'

describe('validateLogWorkoutInput', () => {
  it('rejects a lifting workout with no exercises', () => {
    const input: LogLiftingWorkoutInput = { kind: 'lifting', workoutDate: '2026-07-20', exercises: [] }
    expect(validateLogWorkoutInput(input)).toBe('Add at least one exercise.')
  })

  it('rejects an exercise with no sets', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      exercises: [{ name: 'Squat', sets: [] }],
    }
    expect(validateLogWorkoutInput(input)).toBe('Squat needs at least one set.')
  })

  it('rejects an invalid set (zero reps)', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      exercises: [{ name: 'Squat', sets: [{ reps: 0, weightKg: 100 }] }],
    }
    expect(validateLogWorkoutInput(input)).toBe('Squat has an invalid set.')
  })

  it('accepts a valid lifting workout', () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    expect(validateLogWorkoutInput(input)).toBeNull()
  })

  it('accepts a valid cardio workout', () => {
    const input: LogCardioWorkoutInput = {
      kind: 'cardio',
      workoutDate: '2026-07-20',
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

describe('logWorkout (integration: lifting workout -> workouts + exercises + workout_sets rows)', () => {
  it('inserts the workout, each exercise, and each exercise\'s sets in order', async () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      durationMinutes: 45,
      rpe: 8,
      exercises: [
        { name: 'Squat', exerciseDefinitionId: 'ex-squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
        { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
      ],
    }

    const { client, from } = fakeClientSequence([
      { data: { id: 'w1' }, error: null },
      { data: { id: 'e1' }, error: null },
      { data: null, error: null },
      { data: { id: 'e2' }, error: null },
      { data: null, error: null },
    ])

    const workout = await logWorkout(client, 'u1', input)

    expect(from).toHaveBeenNthCalledWith(1, 'workouts')
    expect(from.mock.results[0].value.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      workout_date: '2026-07-20',
      template_id: null,
      kind: 'lifting',
      duration_minutes: 45,
      rpe: 8,
    })

    expect(from).toHaveBeenNthCalledWith(2, 'exercises')
    expect(from.mock.results[1].value.insert).toHaveBeenCalledWith({
      workout_id: 'w1',
      name: 'Squat',
      position: 0,
      exercise_definition_id: 'ex-squat',
    })

    expect(from).toHaveBeenNthCalledWith(3, 'workout_sets')
    expect(from.mock.results[2].value.insert).toHaveBeenCalledWith([
      { exercise_id: 'e1', reps: 5, weight_kg: 100, position: 0 },
      { exercise_id: 'e1', reps: 5, weight_kg: 100, position: 1 },
    ])

    expect(from).toHaveBeenNthCalledWith(4, 'exercises')
    expect(from.mock.results[3].value.insert).toHaveBeenCalledWith({
      workout_id: 'w1',
      name: 'Bench Press',
      position: 1,
      exercise_definition_id: null,
    })

    expect(from).toHaveBeenNthCalledWith(5, 'workout_sets')
    expect(from.mock.results[4].value.insert).toHaveBeenCalledWith([
      { exercise_id: 'e2', reps: 8, weight_kg: 60, position: 0 },
    ])

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

  it('throws and does not attempt to insert exercises when the workout insert fails', async () => {
    const input: LogLiftingWorkoutInput = {
      kind: 'lifting',
      workoutDate: '2026-07-20',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    const { client, from } = fakeClientReturning({ data: null, error: new Error('db down') })

    await expect(logWorkout(client, 'u1', input)).rejects.toThrow('db down')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input before making any database calls', async () => {
    const input: LogLiftingWorkoutInput = { kind: 'lifting', workoutDate: '2026-07-20', exercises: [] }
    const { client, from } = fakeClientReturning({ data: { id: 'w1' }, error: null })

    await expect(logWorkout(client, 'u1', input)).rejects.toThrow('Add at least one exercise.')
    expect(from).not.toHaveBeenCalled()
  })
})

describe('logWorkout (integration: cardio workout -> workouts + cardio_details row)', () => {
  it('inserts the workout and a matching cardio_details row', async () => {
    const input: LogCardioWorkoutInput = {
      kind: 'cardio',
      workoutDate: '2026-07-20',
      durationMinutes: 32,
      rpe: 6,
      cardio: {
        cardioType: 'jog',
        intendedDurationMinutes: 30,
        intendedDistanceKm: 5,
        actualDistanceKm: 5.4,
        inclinePercent: 1.5,
      },
    }

    const { client, from } = fakeClientSequence([
      { data: { id: 'w2' }, error: null },
      { data: null, error: null },
    ])

    const workout = await logWorkout(client, 'u1', input)

    expect(from).toHaveBeenNthCalledWith(1, 'workouts')
    expect(from.mock.results[0].value.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      workout_date: '2026-07-20',
      template_id: null,
      kind: 'cardio',
      duration_minutes: 32,
      rpe: 6,
    })

    expect(from).toHaveBeenNthCalledWith(2, 'cardio_details')
    expect(from.mock.results[1].value.insert).toHaveBeenCalledWith({
      workout_id: 'w2',
      cardio_type: 'jog',
      intended_duration_minutes: 30,
      intended_distance_km: 5,
      actual_distance_km: 5.4,
      incline_percent: 1.5,
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

  it('throws when the cardio_details insert fails', async () => {
    const input: LogCardioWorkoutInput = {
      kind: 'cardio',
      workoutDate: '2026-07-20',
      cardio: {
        cardioType: 'walk',
        intendedDurationMinutes: null,
        intendedDistanceKm: null,
        actualDistanceKm: null,
        inclinePercent: 3,
      },
    }
    const { client } = fakeClientSequence([
      { data: { id: 'w3' }, error: null },
      { data: null, error: new Error('bad cardio type') },
    ])

    await expect(logWorkout(client, 'u1', input)).rejects.toThrow('bad cardio type')
  })
})
