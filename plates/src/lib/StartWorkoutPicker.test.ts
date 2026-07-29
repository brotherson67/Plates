import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import StartWorkoutPicker from './StartWorkoutPicker.svelte'
import { fakeClientByTable } from './testSupabase'
import { loadDraft, clearDraftStorage } from './activeWorkoutDraft'

function renderPicker(overrides: Record<string, { data: unknown; error: unknown }> = {}) {
  const { client, from } = fakeClientByTable({
    routines: { data: [{ id: 'r1', name: 'Push Pull Legs', length_days: 3 }], error: null },
    workout_templates: {
      data: [
        { id: 't1', name: 'Push Day', kind: 'lifting' },
        { id: 't2', name: 'Cardio Day', kind: 'cardio' },
      ],
      error: null,
    },
    exercise_definitions: {
      data: [{ id: 'ex1', name: 'Bench Press', equipment_type: 'barbell' }],
      error: null,
    },
    routine_workouts: {
      data: [{ id: 'rw1', routine_id: 'r1', template_id: 't1', day_index: 0, position: 0 }],
      error: null,
    },
    template_exercises: {
      data: [{ id: 'te1', template_id: 't1', exercise_definition_id: 'ex1', target_sets: 3, target_reps: 5, position: 0 }],
      error: null,
    },
    ...overrides,
  })
  const onStarted = vi.fn()
  const onLogged = vi.fn()
  render(StartWorkoutPicker, { client, userId: 'u1', onStarted, onLogged })
  return { client, from, onStarted, onLogged }
}

describe('StartWorkoutPicker (integration: pick a routine/template -> creates an active-workout draft)', () => {
  beforeEach(() => {
    clearDraftStorage()
  })

  it('lists routines and lifting templates, filtering out cardio templates', async () => {
    renderPicker()
    expect(await screen.findByTestId('routine-item-r1')).toHaveTextContent('Push Pull Legs')
    expect(screen.getByTestId('template-item-t1')).toHaveTextContent('Push Day')
    expect(screen.queryByText('Cardio Day')).not.toBeInTheDocument()
  })

  it('expands a routine to show its days, and starting a day creates the draft', async () => {
    const { onStarted } = renderPicker()
    await screen.findByTestId('routine-item-r1')

    await fireEvent.click(screen.getByTestId('routine-item-r1'))
    const day = await screen.findByTestId('routine-day-rw1')
    expect(day).toHaveTextContent('Day 0')
    expect(day).toHaveTextContent('Push Day')

    await fireEvent.click(day)

    expect(onStarted).toHaveBeenCalled()
    const draft = loadDraft()
    expect(draft?.templateId).toBe('t1')
    expect(draft?.routineWorkoutId).toBe('rw1')
    expect(draft?.exercises).toEqual([
      { exerciseDefinitionId: 'ex1', name: 'Bench Press', targetSets: 3, targetReps: 5, sets: [], skipped: false },
    ])
  })

  it('starts a template directly without a routine', async () => {
    const { onStarted } = renderPicker()
    await fireEvent.click(await screen.findByTestId('template-item-t1'))

    expect(onStarted).toHaveBeenCalled()
    const draft = loadDraft()
    expect(draft?.templateId).toBe('t1')
    expect(draft?.routineWorkoutId).toBeNull()
  })

  it('switches to the freeform LogWorkoutForm without creating a draft', async () => {
    renderPicker()
    await fireEvent.click(await screen.findByTestId('freeform-button'))

    expect(await screen.findByTestId('log-workout-form')).toBeInTheDocument()
    expect(loadDraft()).toBeNull()
  })
})
