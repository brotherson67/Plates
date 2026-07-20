import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import LogWorkoutForm from './LogWorkoutForm.svelte'
import { fakeClientSequence } from './testSupabase'

describe('LogWorkoutForm (integration: build up exercises/sets -> logWorkout -> workouts/exercises/workout_sets rows)', () => {
  it('logs a lifting workout with two sets on one exercise', async () => {
    const { client, from } = fakeClientSequence([
      { data: { id: 'w1' }, error: null },
      { data: { id: 'e1' }, error: null },
      { data: null, error: null },
    ])

    render(LogWorkoutForm, { client, userId: 'u1' })

    await fireEvent.input(screen.getByPlaceholderText('Exercise name'), { target: { value: 'Squat' } })
    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })
    await fireEvent.click(screen.getByTestId('add-set-button'))
    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '105' } })
    await fireEvent.click(screen.getByTestId('add-set-button'))

    expect(screen.getByTestId('log-workout-draft-sets')).toHaveTextContent('2 set(s) added')

    await fireEvent.click(screen.getByTestId('add-exercise-to-workout-button'))
    expect(screen.getByTestId('log-workout-exercises')).toHaveTextContent('Squat')
    expect(screen.getByTestId('log-workout-exercises')).toHaveTextContent('2 sets')

    await fireEvent.submit(screen.getByTestId('log-workout-form'))

    expect(await screen.findByTestId('log-workout-success')).toHaveTextContent('lifting')
    expect(from).toHaveBeenNthCalledWith(1, 'workouts')
    expect(from.mock.results[1].value.insert).toHaveBeenCalledWith(
      expect.objectContaining({ workout_id: 'w1', name: 'Squat', position: 0 }),
    )
    expect(from.mock.results[2].value.insert).toHaveBeenCalledWith([
      { exercise_id: 'e1', reps: 5, weight_kg: 100, position: 0 },
      { exercise_id: 'e1', reps: 5, weight_kg: 105, position: 1 },
    ])
  })

  it('logs a cardio workout with the cardio-specific fields', async () => {
    const { client, from } = fakeClientSequence([
      { data: { id: 'w2' }, error: null },
      { data: null, error: null },
    ])

    render(LogWorkoutForm, { client, userId: 'u1' })

    const kindSelect = document.querySelector('select[name="kind"]') as HTMLSelectElement
    await fireEvent.input(kindSelect, { target: { value: 'cardio' } })

    const cardioTypeSelect = document.querySelector('select[name="cardioType"]') as HTMLSelectElement
    await fireEvent.input(cardioTypeSelect, { target: { value: 'jog' } })
    await fireEvent.input(screen.getByPlaceholderText('Actual distance (km)'), { target: { value: '5.4' } })

    await fireEvent.submit(screen.getByTestId('log-workout-form'))

    expect(await screen.findByTestId('log-workout-success')).toHaveTextContent('cardio')
    expect(from).toHaveBeenNthCalledWith(2, 'cardio_details')
    expect(from.mock.results[1].value.insert).toHaveBeenCalledWith(
      expect.objectContaining({ workout_id: 'w2', cardio_type: 'jog', actual_distance_km: 5.4 }),
    )
  })

  it('shows an error when logging fails (e.g. no exercises added for a lifting workout)', async () => {
    const { client } = fakeClientSequence([])
    render(LogWorkoutForm, { client, userId: 'u1' })

    await fireEvent.submit(screen.getByTestId('log-workout-form'))

    expect(await screen.findByTestId('log-workout-error')).toHaveTextContent('Add at least one exercise.')
  })
})
