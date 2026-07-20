import { describe, it, expect } from 'vitest'
import { listExerciseDefinitions, createExerciseDefinition } from './exercises'
import { fakeClientReturning } from './testSupabase'

describe('listExerciseDefinitions', () => {
  it('maps rows to ExerciseDefinition and queries the right table/columns', async () => {
    const { client, from } = fakeClientReturning({
      data: [
        { id: '1', name: 'Bench Press', equipment_type: 'barbell' },
        { id: '2', name: 'Goblet Squat', equipment_type: 'dumbbell' },
      ],
      error: null,
    })

    const result = await listExerciseDefinitions(client)

    expect(from).toHaveBeenCalledWith('exercise_definitions')
    expect(result).toEqual([
      { id: '1', name: 'Bench Press', equipmentType: 'barbell' },
      { id: '2', name: 'Goblet Squat', equipmentType: 'dumbbell' },
    ])
  })

  it('returns an empty array when there are no rows', async () => {
    const { client } = fakeClientReturning({ data: [], error: null })
    expect(await listExerciseDefinitions(client)).toEqual([])
  })

  it('throws when the query errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('boom') })
    await expect(listExerciseDefinitions(client)).rejects.toThrow('boom')
  })
})

describe('createExerciseDefinition (integration: insert payload -> mapped result)', () => {
  it('sends a snake_case payload and maps the returned row back to camelCase', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: '3', name: 'Kettlebell Swing', equipment_type: 'other' },
      error: null,
    })

    const result = await createExerciseDefinition(client, 'Kettlebell Swing', 'other')

    expect(from).toHaveBeenCalledWith('exercise_definitions')
    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({ name: 'Kettlebell Swing', equipment_type: 'other' })
    expect(result).toEqual({ id: '3', name: 'Kettlebell Swing', equipmentType: 'other' })
  })

  it('throws when the insert errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('duplicate name') })
    await expect(createExerciseDefinition(client, 'Bench Press', 'barbell')).rejects.toThrow('duplicate name')
  })
})
