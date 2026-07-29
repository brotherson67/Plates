import { describe, it, expect } from 'vitest'
import { getPriorPerformance } from './priorPerformance'
import { fakeClientReturning } from './testSupabase'

describe('getPriorPerformance', () => {
  it('maps the most recent workout row to sets sorted by position', async () => {
    const { client, from } = fakeClientReturning({
      data: {
        workouts: { workout_date: '2026-07-20', created_at: '2026-07-20T10:00:00Z' },
        workout_sets: [
          { reps: 5, weight_kg: 105, position: 1 },
          { reps: 5, weight_kg: 100, position: 0 },
        ],
      },
      error: null,
    })

    const result = await getPriorPerformance(client, 'u1', 'ex-squat')

    expect(from).toHaveBeenCalledWith('exercises')
    const builder = from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('exercise_definition_id', 'ex-squat')
    expect(builder.eq).toHaveBeenCalledWith('workouts.user_id', 'u1')
    expect(builder.limit).toHaveBeenCalledWith(1)

    expect(result).toEqual({
      workoutDate: '2026-07-20',
      sets: [
        { reps: 5, weightKg: 100 },
        { reps: 5, weightKg: 105 },
      ],
    })
  })

  it('returns null when there is no prior workout for this exercise/user', async () => {
    const { client } = fakeClientReturning({ data: null, error: null })
    const result = await getPriorPerformance(client, 'u1', 'ex-new')
    expect(result).toBeNull()
  })

  it('throws when the query fails', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('query failed') })
    await expect(getPriorPerformance(client, 'u1', 'ex-squat')).rejects.toThrow('query failed')
  })
})
