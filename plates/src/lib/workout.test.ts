import { describe, it, expect } from 'vitest'
import {
  isValidSet,
  calculateSetVolume,
  calculateExerciseVolume,
  calculateWorkoutVolume,
  convertWeight,
  formatWeight,
  type Workout,
} from './workout'

describe('isValidSet', () => {
  it('accepts a normal set', () => {
    expect(isValidSet({ reps: 5, weightKg: 100 })).toBe(true)
  })

  it('accepts a bodyweight set with zero weight', () => {
    expect(isValidSet({ reps: 10, weightKg: 0 })).toBe(true)
  })

  it('rejects zero reps', () => {
    expect(isValidSet({ reps: 0, weightKg: 50 })).toBe(false)
  })

  it('rejects negative reps', () => {
    expect(isValidSet({ reps: -1, weightKg: 50 })).toBe(false)
  })

  it('rejects negative weight', () => {
    expect(isValidSet({ reps: 5, weightKg: -10 })).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(isValidSet({ reps: NaN, weightKg: 50 })).toBe(false)
    expect(isValidSet({ reps: 5, weightKg: Infinity })).toBe(false)
  })
})

describe('calculateSetVolume', () => {
  it('multiplies reps by weight', () => {
    expect(calculateSetVolume({ reps: 5, weightKg: 100 })).toBe(500)
  })

  it('returns 0 for an invalid set instead of a nonsense number', () => {
    expect(calculateSetVolume({ reps: -1, weightKg: 100 })).toBe(0)
  })
})

describe('calculateExerciseVolume', () => {
  it('sums volume across all sets', () => {
    const exercise = {
      name: 'Squat',
      sets: [
        { reps: 5, weightKg: 100 },
        { reps: 5, weightKg: 100 },
        { reps: 3, weightKg: 110 },
      ],
    }
    expect(calculateExerciseVolume(exercise)).toBe(5 * 100 + 5 * 100 + 3 * 110)
  })

  it('returns 0 for an exercise with no sets', () => {
    expect(calculateExerciseVolume({ name: 'Rest day', sets: [] })).toBe(0)
  })

  it('ignores invalid sets while still summing valid ones', () => {
    const exercise = {
      name: 'Mixed',
      sets: [
        { reps: 5, weightKg: 50 },
        { reps: -1, weightKg: 999 },
      ],
    }
    expect(calculateExerciseVolume(exercise)).toBe(250)
  })
})

describe('calculateWorkoutVolume (integration of set + exercise volume)', () => {
  const workout: Workout = {
    id: 'w1',
    date: '2026-07-20',
    exercises: [
      { name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] },
      { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
    ],
  }

  it('sums volume across every exercise, each of which sums across its own sets', () => {
    const expected = calculateExerciseVolume(workout.exercises[0]) + calculateExerciseVolume(workout.exercises[1])
    expect(calculateWorkoutVolume(workout)).toBe(expected)
    expect(calculateWorkoutVolume(workout)).toBe(500 + 480)
  })

  it('returns 0 for a workout with no exercises', () => {
    expect(calculateWorkoutVolume({ id: 'empty', date: 'today', exercises: [] })).toBe(0)
  })
})

describe('convertWeight', () => {
  it('leaves kg unchanged', () => {
    expect(convertWeight(100, 'kg')).toBe(100)
  })

  it('converts kg to lb', () => {
    expect(convertWeight(100, 'lb')).toBeCloseTo(220.46, 1)
  })
})

describe('formatWeight', () => {
  it('formats kg with unit suffix', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
  })

  it('formats lb, rounded to one decimal', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })
})
