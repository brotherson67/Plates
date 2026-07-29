import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import LogWorkoutForm from './LogWorkoutForm.svelte'
import { fakeClientReturning } from './testSupabase'

describe('LogWorkoutForm (integration: build up exercises/sets -> logWorkout -> atomic RPC call)', () => {
  it('logs a lifting workout with two sets on one exercise', async () => {
    const { client, rpc } = fakeClientReturning({ data: { workout_id: 'w1' }, error: null })

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
    expect(rpc).toHaveBeenCalledTimes(1)
    const [rpcName, { payload }] = rpc.mock.calls[0]
    expect(rpcName).toBe('log_workout')
    expect(payload).toMatchObject({
      kind: 'lifting',
      idempotencyKey: expect.any(String),
      exercises: [
        {
          name: 'Squat',
          exerciseDefinitionId: null,
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 5, weightKg: 105 },
          ],
        },
      ],
    })
  })

  it('logs a cardio workout with the cardio-specific fields', async () => {
    const { client, rpc } = fakeClientReturning({ data: { workout_id: 'w2' }, error: null })

    render(LogWorkoutForm, { client, userId: 'u1' })

    const kindSelect = document.querySelector('select[name="kind"]') as HTMLSelectElement
    await fireEvent.input(kindSelect, { target: { value: 'cardio' } })

    const cardioTypeSelect = document.querySelector('select[name="cardioType"]') as HTMLSelectElement
    await fireEvent.input(cardioTypeSelect, { target: { value: 'jog' } })
    await fireEvent.input(screen.getByPlaceholderText('Actual distance (km)'), { target: { value: '5.4' } })

    await fireEvent.submit(screen.getByTestId('log-workout-form'))

    expect(await screen.findByTestId('log-workout-success')).toHaveTextContent('cardio')
    const [, { payload }] = rpc.mock.calls[0]
    expect(payload).toMatchObject({
      kind: 'cardio',
      cardio: expect.objectContaining({ cardioType: 'jog', actualDistanceKm: 5.4 }),
    })
  })

  it('shows an error when logging fails (e.g. no exercises added for a lifting workout)', async () => {
    const { client, rpc } = fakeClientReturning({ data: { workout_id: 'w1' }, error: null })
    render(LogWorkoutForm, { client, userId: 'u1' })

    await fireEvent.submit(screen.getByTestId('log-workout-form'))

    expect(await screen.findByTestId('log-workout-error')).toHaveTextContent('Add at least one exercise.')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reuses the same idempotency key across a failed resubmit', async () => {
    const { client, rpc } = fakeClientReturning({ data: null, error: new Error('network drop') })
    render(LogWorkoutForm, { client, userId: 'u1' })

    await fireEvent.input(screen.getByPlaceholderText('Exercise name'), { target: { value: 'Squat' } })
    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })
    await fireEvent.click(screen.getByTestId('add-set-button'))
    await fireEvent.click(screen.getByTestId('add-exercise-to-workout-button'))

    await fireEvent.submit(screen.getByTestId('log-workout-form'))
    expect(await screen.findByTestId('log-workout-error')).toBeInTheDocument()
    await fireEvent.submit(screen.getByTestId('log-workout-form'))
    await screen.findByTestId('log-workout-error')

    expect(rpc).toHaveBeenCalledTimes(2)
    const firstKey = rpc.mock.calls[0][1].payload.idempotencyKey
    const secondKey = rpc.mock.calls[1][1].payload.idempotencyKey
    expect(firstKey).toBe(secondKey)
  })
})
