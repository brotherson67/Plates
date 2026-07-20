import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import type { SupabaseClient } from '@supabase/supabase-js'
import ExerciseCatalog from './ExerciseCatalog.svelte'
import { fakeClientReturning } from './testSupabase'

describe('ExerciseCatalog (integration: list on mount + add via createExerciseDefinition)', () => {
  it('loads and shows the catalog on mount', async () => {
    const { client } = fakeClientReturning({
      data: [{ id: '1', name: 'Bench Press', equipment_type: 'barbell' }],
      error: null,
    })
    render(ExerciseCatalog, { client })
    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
  })

  it('adds an exercise and shows it in the list without a reload', async () => {
    const { client, from } = fakeClientReturning({ data: [], error: null })
    render(ExerciseCatalog, { client })
    await screen.findByTestId('exercise-catalog-list')

    from.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '2', name: 'Goblet Squat', equipment_type: 'dumbbell' }, error: null }),
    } as unknown as ReturnType<SupabaseClient['from']>)

    await fireEvent.input(screen.getByPlaceholderText('Exercise name'), { target: { value: 'Goblet Squat' } })
    await fireEvent.submit(screen.getByTestId('add-exercise-form'))

    expect(await screen.findByText('Goblet Squat')).toBeInTheDocument()
  })

  it('shows an error and does not add a blank-named exercise', async () => {
    const { client } = fakeClientReturning({ data: [], error: null })
    render(ExerciseCatalog, { client })
    await screen.findByTestId('exercise-catalog-list')

    await fireEvent.submit(screen.getByTestId('add-exercise-form'))

    expect(await screen.findByTestId('exercise-catalog-error')).toHaveTextContent('Name the exercise.')
  })
})
