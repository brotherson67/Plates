import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import RoutineForm from './RoutineForm.svelte'
import { fakeClientSequence, fakeClientReturning } from './testSupabase'

describe('RoutineForm (integration: create routine -> attach template days)', () => {
  it('creates a routine, then attaches a workout template to a day', async () => {
    const { client } = fakeClientSequence([
      { data: [{ id: 't1', name: 'Push Day A', kind: 'lifting' }], error: null },
      { data: { id: 'r1', name: 'Summer Cut', length_days: 56 }, error: null },
      { data: { id: 'rw1', routine_id: 'r1', template_id: 't1', day_index: 0, position: 0 }, error: null },
    ])

    render(RoutineForm, { client, userId: 'u1' })
    await screen.findByPlaceholderText('Routine name')

    await fireEvent.input(screen.getByPlaceholderText('Routine name'), { target: { value: 'Summer Cut' } })
    await fireEvent.input(screen.getByPlaceholderText('Length (days)'), { target: { value: '56' } })
    await fireEvent.submit(screen.getByTestId('routine-form'))

    await screen.findByTestId('routine-days-list')

    await fireEvent.input(screen.getByPlaceholderText('Day'), { target: { value: '0' } })
    await fireEvent.submit(screen.getByTestId('add-routine-day-form'))

    expect(await screen.findByText('Day 0')).toBeInTheDocument()
    expect(screen.getByTestId('routine-days-list')).toHaveTextContent('Push Day A')
  })

  it('shows an error and does not create a blank-named routine', async () => {
    const { client } = fakeClientReturning({ data: [], error: null })
    render(RoutineForm, { client, userId: 'u1' })
    await screen.findByPlaceholderText('Routine name')

    await fireEvent.submit(screen.getByTestId('routine-form'))

    expect(await screen.findByTestId('routine-error')).toHaveTextContent('Name the routine.')
  })

  it('requires a day number before attaching a template', async () => {
    const { client } = fakeClientSequence([
      { data: [{ id: 't1', name: 'Push Day A', kind: 'lifting' }], error: null },
      { data: { id: 'r1', name: 'Summer Cut', length_days: null }, error: null },
    ])

    render(RoutineForm, { client, userId: 'u1' })
    await screen.findByPlaceholderText('Routine name')
    await fireEvent.input(screen.getByPlaceholderText('Routine name'), { target: { value: 'Summer Cut' } })
    await fireEvent.submit(screen.getByTestId('routine-form'))
    await screen.findByTestId('routine-days-list')

    await fireEvent.submit(screen.getByTestId('add-routine-day-form'))

    expect(await screen.findByTestId('routine-day-error')).toHaveTextContent('Enter a day number.')
  })
})
