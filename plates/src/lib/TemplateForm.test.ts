import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import TemplateForm from './TemplateForm.svelte'
import { fakeClientSequence, fakeClientReturning } from './testSupabase'

describe('TemplateForm (integration: create template -> add exercises from catalog)', () => {
  it('creates a lifting template, then lets you add catalog exercises with target sets/reps', async () => {
    const { client } = fakeClientSequence([
      { data: [{ id: 'ex1', name: 'Bench Press', equipment_type: 'barbell' }], error: null },
      { data: { id: 't1', name: 'Push Day A', kind: 'lifting' }, error: null },
      {
        data: { id: 'te1', exercise_definition_id: 'ex1', target_sets: 4, target_reps: 8, position: 0 },
        error: null,
      },
    ])

    render(TemplateForm, { client, userId: 'u1' })

    await fireEvent.input(screen.getByPlaceholderText('Template name'), { target: { value: 'Push Day A' } })
    await fireEvent.submit(screen.getByTestId('template-form'))

    await screen.findByTestId('template-exercises-list')

    await fireEvent.input(screen.getByPlaceholderText('Target sets'), { target: { value: '4' } })
    await fireEvent.input(screen.getByPlaceholderText('Target reps'), { target: { value: '8' } })
    await fireEvent.submit(screen.getByTestId('add-template-exercise-form'))

    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('4x8')).toBeInTheDocument()
  })

  it('creates a cardio template and skips the exercise-adding step entirely', async () => {
    const { client, from } = fakeClientSequence([
      { data: [], error: null },
      { data: { id: 't2', name: 'Sunday Jog', kind: 'cardio' }, error: null },
    ])

    render(TemplateForm, { client, userId: 'u1' })
    await screen.findByPlaceholderText('Template name')

    await fireEvent.input(screen.getByPlaceholderText('Template name'), { target: { value: 'Sunday Jog' } })
    const kindSelect = document.querySelector('select[name="kind"]') as HTMLSelectElement
    await fireEvent.input(kindSelect, { target: { value: 'cardio' } })
    await fireEvent.submit(screen.getByTestId('template-form'))

    expect(from.mock.results[1].value.insert).toHaveBeenCalledWith({ user_id: 'u1', name: 'Sunday Jog', kind: 'cardio' })
    expect(await screen.findByTestId('template-created')).toHaveTextContent('Sunday Jog')
    expect(screen.queryByTestId('add-template-exercise-form')).not.toBeInTheDocument()
  })

  it('shows an error and does not create a blank-named template', async () => {
    const { client } = fakeClientReturning({ data: [], error: null })
    render(TemplateForm, { client, userId: 'u1' })
    await screen.findByPlaceholderText('Template name')

    await fireEvent.submit(screen.getByTestId('template-form'))

    expect(await screen.findByTestId('template-error')).toHaveTextContent('Name the workout template.')
  })
})
