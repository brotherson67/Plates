import { describe, it, expect } from 'vitest'
import {
  createWorkoutTemplate,
  listWorkoutTemplates,
  addTemplateExercise,
  listTemplateExercises,
  createRoutine,
  listRoutines,
  addRoutineWorkout,
  listRoutineWorkouts,
} from './routines'
import { fakeClientReturning, fakeClientSequence } from './testSupabase'

describe('workout templates', () => {
  it('creates a template with a snake_case payload and maps the row back', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 't1', name: 'Push Day A', kind: 'lifting' },
      error: null,
    })

    const template = await createWorkoutTemplate(client, 'u1', 'Push Day A', 'lifting')

    expect(from).toHaveBeenCalledWith('workout_templates')
    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', name: 'Push Day A', kind: 'lifting' })
    expect(template).toEqual({ id: 't1', name: 'Push Day A', kind: 'lifting', exercises: [] })
  })

  it('lists templates ordered by name', async () => {
    const { client, from } = fakeClientReturning({
      data: [{ id: 't1', name: 'Push Day A', kind: 'lifting' }],
      error: null,
    })
    const templates = await listWorkoutTemplates(client)
    expect(from).toHaveBeenCalledWith('workout_templates')
    expect(templates).toEqual([{ id: 't1', name: 'Push Day A', kind: 'lifting', exercises: [] }])
  })

  it('throws when creating a template fails', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('nope') })
    await expect(createWorkoutTemplate(client, 'u1', 'Push Day A', 'lifting')).rejects.toThrow('nope')
  })
})

describe('template exercises', () => {
  it('adds an exercise to a template with default target/position values', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 'te1', exercise_definition_id: 'ex1', target_sets: null, target_reps: null, position: 0 },
      error: null,
    })

    const result = await addTemplateExercise(client, 't1', 'ex1')

    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({
      template_id: 't1',
      exercise_definition_id: 'ex1',
      target_sets: null,
      target_reps: null,
      position: 0,
    })
    expect(result).toEqual({ id: 'te1', exerciseDefinitionId: 'ex1', targetSets: null, targetReps: null, position: 0 })
  })

  it('passes through explicit target sets/reps/position', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 'te2', exercise_definition_id: 'ex2', target_sets: 4, target_reps: 8, position: 2 },
      error: null,
    })

    await addTemplateExercise(client, 't1', 'ex2', { targetSets: 4, targetReps: 8, position: 2 })

    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({
      template_id: 't1',
      exercise_definition_id: 'ex2',
      target_sets: 4,
      target_reps: 8,
      position: 2,
    })
  })

  it('lists a template exercises scoped to that template, ordered by position', async () => {
    const { client, from } = fakeClientReturning({
      data: [{ id: 'te1', exercise_definition_id: 'ex1', target_sets: 4, target_reps: 8, position: 0 }],
      error: null,
    })

    const result = await listTemplateExercises(client, 't1')

    const builder = from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('template_id', 't1')
    expect(result).toEqual([{ id: 'te1', exerciseDefinitionId: 'ex1', targetSets: 4, targetReps: 8, position: 0 }])
  })
})

describe('routines', () => {
  it('creates a routine with a nullable length_days', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 'r1', name: 'Summer Cut', length_days: 56 },
      error: null,
    })

    const routine = await createRoutine(client, 'u1', 'Summer Cut', 56)

    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', name: 'Summer Cut', length_days: 56 })
    expect(routine).toEqual({ id: 'r1', name: 'Summer Cut', lengthDays: 56 })
  })

  it('defaults length_days to null for an open-ended routine', async () => {
    const { client, from } = fakeClientReturning({ data: { id: 'r2', name: 'Ongoing', length_days: null }, error: null })
    await createRoutine(client, 'u1', 'Ongoing')
    const builder = from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', name: 'Ongoing', length_days: null })
  })

  it('lists routines', async () => {
    const { client } = fakeClientReturning({ data: [{ id: 'r1', name: 'Summer Cut', length_days: 56 }], error: null })
    expect(await listRoutines(client)).toEqual([{ id: 'r1', name: 'Summer Cut', lengthDays: 56 }])
  })
})

describe('routine workouts (integration: create routine -> attach template days -> list back)', () => {
  it('attaches a template to a day of a routine and lists it back in day order', async () => {
    const { client } = fakeClientSequence([
      { data: { id: 'r1', name: 'Summer Cut', length_days: 56 }, error: null },
      { data: { id: 'rw1', routine_id: 'r1', template_id: 't1', day_index: 0, position: 0 }, error: null },
      { data: { id: 'rw2', routine_id: 'r1', template_id: 't2', day_index: 2, position: 0 }, error: null },
      {
        data: [
          { id: 'rw1', routine_id: 'r1', template_id: 't1', day_index: 0, position: 0 },
          { id: 'rw2', routine_id: 'r1', template_id: 't2', day_index: 2, position: 0 },
        ],
        error: null,
      },
    ])

    const routine = await createRoutine(client, 'u1', 'Summer Cut', 56)
    await addRoutineWorkout(client, routine.id, 't1', 0)
    await addRoutineWorkout(client, routine.id, 't2', 2)
    const days = await listRoutineWorkouts(client, routine.id)

    expect(days).toEqual([
      { id: 'rw1', routineId: 'r1', templateId: 't1', dayIndex: 0, position: 0 },
      { id: 'rw2', routineId: 'r1', templateId: 't2', dayIndex: 2, position: 0 },
    ])
  })

  it('throws when attaching a routine workout fails', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('bad template') })
    await expect(addRoutineWorkout(client, 'r1', 't1', 0)).rejects.toThrow('bad template')
  })
})
