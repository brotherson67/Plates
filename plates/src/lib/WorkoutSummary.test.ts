import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import WorkoutSummary from './WorkoutSummary.svelte'
import { calculateWorkoutVolume, formatVolume, type Workout } from './workout'

const workout: Workout = {
  id: 'w1',
  date: '2026-07-20',
  exercises: [
    { name: 'Squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
    { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
  ],
}

describe('WorkoutSummary (integration: component + workout math)', () => {
  it('renders every exercise name', () => {
    render(WorkoutSummary, { workout })
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
  })

  it('renders a total that matches calculateWorkoutVolume, not a hardcoded number', () => {
    render(WorkoutSummary, { workout })
    const expectedTotal = formatVolume(calculateWorkoutVolume(workout), 'kg')
    expect(screen.getByTestId('workout-total')).toHaveTextContent(expectedTotal)
  })

  it('re-renders correctly for a workout with no exercises', () => {
    const emptyWorkout: Workout = { id: 'empty', date: 'Rest day', exercises: [] }
    render(WorkoutSummary, { workout: emptyWorkout })
    expect(screen.getByText('Rest day')).toBeInTheDocument()
    expect(screen.getByTestId('workout-total')).toHaveTextContent('Total volume: 0 kg')
  })

  it('switches units end-to-end when the unit prop changes', () => {
    render(WorkoutSummary, { workout, unit: 'lb' })
    const expectedTotal = formatVolume(calculateWorkoutVolume(workout), 'lb')
    expect(screen.getByTestId('workout-total')).toHaveTextContent(expectedTotal)
  })
})
