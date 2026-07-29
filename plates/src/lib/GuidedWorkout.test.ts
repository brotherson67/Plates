import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import type { SupabaseClient } from '@supabase/supabase-js'
import GuidedWorkout from './GuidedWorkout.svelte'
import { fakeQueryBuilder, type FakeResult } from './testSupabase'
import { createDraft, saveDraft, loadDraft, clearDraftStorage, type ActiveExerciseDraft } from './activeWorkoutDraft'

function twoExerciseDraft() {
  const exercises: ActiveExerciseDraft[] = [
    { exerciseDefinitionId: 'ex-squat', name: 'Squat', targetSets: 3, targetReps: 5, sets: [], skipped: false },
    { exerciseDefinitionId: 'ex-bench', name: 'Bench Press', targetSets: 3, targetReps: 8, sets: [], skipped: false },
  ]
  return createDraft({
    kind: 'lifting',
    templateId: 't1',
    routineWorkoutId: null,
    workoutDate: '2026-07-20',
    exercises,
  })
}

function fakeClient(fromResult: FakeResult, rpcResult: FakeResult): { client: SupabaseClient; rpc: ReturnType<typeof vi.fn> } {
  const fromBuilder = fakeQueryBuilder(fromResult)
  const rpcBuilder = fakeQueryBuilder(rpcResult)
  const from = vi.fn(() => fromBuilder)
  const rpc = vi.fn(() => rpcBuilder)
  return { client: { from, rpc } as unknown as SupabaseClient, rpc }
}

const NO_PRIOR_PERFORMANCE: FakeResult = { data: null, error: null }

describe('GuidedWorkout (integration: stepping through a draft -> atomic save)', () => {
  beforeEach(() => {
    clearDraftStorage()
  })

  it('resumes from a saved draft and shows the current exercise', async () => {
    saveDraft(twoExerciseDraft())
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })

    render(GuidedWorkout, { client, userId: 'u1' })

    expect(await screen.findByTestId('current-exercise-name')).toHaveTextContent('Squat')
    expect(screen.getByTestId('exercise-progress')).toHaveTextContent('Exercise 1 of 2')
  })

  it('shows a prior-performance hint and fills the inputs from "Use last time"', async () => {
    saveDraft(twoExerciseDraft())
    const { client } = fakeClient(
      {
        data: {
          workouts: { workout_date: '2026-07-19', created_at: '2026-07-19T10:00:00Z' },
          workout_sets: [{ reps: 5, weight_kg: 100, position: 0 }],
        },
        error: null,
      },
      { data: null, error: null },
    )

    render(GuidedWorkout, { client, userId: 'u1' })

    expect(await screen.findByTestId('prior-performance-hint')).toHaveTextContent('5x100kg')
    await fireEvent.click(screen.getByTestId('use-last-performance-button'))

    expect(screen.getByPlaceholderText('Reps')).toHaveValue(5)
    expect(screen.getByPlaceholderText('Weight (kg)')).toHaveValue(100)
  })

  it('shows a live plate breakdown as the weight input changes', async () => {
    saveDraft(twoExerciseDraft())
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })
    render(GuidedWorkout, { client, userId: 'u1' })
    await screen.findByTestId('current-exercise-name')

    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })

    expect(await screen.findByTestId('plate-breakdown')).toHaveTextContent('Bar 20kg')
    expect(screen.getByTestId('plate-breakdown')).toHaveTextContent('2x20kg/side')
  })

  it('logs a set, persists it to the draft, and starts a rest timer', async () => {
    saveDraft(twoExerciseDraft())
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })
    render(GuidedWorkout, { client, userId: 'u1' })
    await screen.findByTestId('current-exercise-name')

    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })
    await fireEvent.click(screen.getByTestId('log-set-button'))

    expect(screen.getByTestId('logged-sets-list')).toHaveTextContent('Set 1')
    expect(screen.getByTestId('logged-sets-list')).toHaveTextContent('5 x 100kg')
    expect(await screen.findByTestId('rest-timer')).toBeInTheDocument()

    const persisted = loadDraft()
    expect(persisted?.exercises[0].sets).toEqual([{ reps: 5, weightKg: 100, completedAt: expect.any(String) }])
  })

  it('advances to the next exercise and clears prior sets state for it', async () => {
    saveDraft(twoExerciseDraft())
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })
    render(GuidedWorkout, { client, userId: 'u1' })
    await screen.findByTestId('current-exercise-name')

    await fireEvent.click(screen.getByTestId('next-exercise-button'))

    expect(await screen.findByTestId('current-exercise-name')).toHaveTextContent('Bench Press')
    expect(screen.getByTestId('exercise-progress')).toHaveTextContent('Exercise 2 of 2')
    expect(screen.queryByTestId('next-exercise-button')).not.toBeInTheDocument()
  })

  it('finishes and saves the workout via the atomic RPC, then clears the draft', async () => {
    saveDraft(twoExerciseDraft())
    const { client, rpc } = fakeClient(NO_PRIOR_PERFORMANCE, { data: { workout_id: 'w1' }, error: null })
    const onLogged = vi.fn()
    render(GuidedWorkout, { client, userId: 'u1', onLogged })
    await screen.findByTestId('current-exercise-name')

    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })
    await fireEvent.click(screen.getByTestId('log-set-button'))

    await fireEvent.click(screen.getByTestId('finish-workout-button'))
    await fireEvent.input(screen.getByPlaceholderText('Duration (minutes)'), { target: { value: '40' } })
    await fireEvent.click(screen.getByTestId('confirm-finish-button'))

    await waitFor(() => expect(onLogged).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(loadDraft()).toBeNull()
  })

  it('keeps the draft intact and offers a retry when the save fails', async () => {
    saveDraft(twoExerciseDraft())
    const { client, rpc } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: new Error('network drop') })
    render(GuidedWorkout, { client, userId: 'u1' })
    await screen.findByTestId('current-exercise-name')

    await fireEvent.input(screen.getByPlaceholderText('Reps'), { target: { value: '5' } })
    await fireEvent.input(screen.getByPlaceholderText('Weight (kg)'), { target: { value: '100' } })
    await fireEvent.click(screen.getByTestId('log-set-button'))

    await fireEvent.click(screen.getByTestId('finish-workout-button'))
    await fireEvent.click(screen.getByTestId('confirm-finish-button'))

    expect(await screen.findByTestId('finish-error')).toBeInTheDocument()
    expect(loadDraft()).not.toBeNull()
    // confirmFinish's internal retry loop makes SAVE_RETRIES + 1 attempts before giving up
    const callsAfterFirstAttempt = rpc.mock.calls.length
    expect(callsAfterFirstAttempt).toBeGreaterThanOrEqual(1)

    await fireEvent.click(screen.getByTestId('retry-save-button'))
    await waitFor(() => expect(rpc.mock.calls.length).toBeGreaterThan(callsAfterFirstAttempt))
  })

  it('shows a resume/discard prompt for a stale draft, and discard clears it', async () => {
    const staleDraft = { ...twoExerciseDraft(), startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }
    saveDraft(staleDraft)
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })
    const onDiscarded = vi.fn()
    render(GuidedWorkout, { client, userId: 'u1', onDiscarded })

    expect(await screen.findByTestId('guided-workout-resume-prompt')).toBeInTheDocument()
    expect(screen.queryByTestId('current-exercise-name')).not.toBeInTheDocument()

    await fireEvent.click(screen.getByTestId('discard-draft-button'))

    expect(onDiscarded).toHaveBeenCalled()
    expect(loadDraft()).toBeNull()
  })

  it('resumes a stale draft into the normal flow when the user chooses to', async () => {
    const staleDraft = { ...twoExerciseDraft(), startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }
    saveDraft(staleDraft)
    const { client } = fakeClient(NO_PRIOR_PERFORMANCE, { data: null, error: null })
    render(GuidedWorkout, { client, userId: 'u1' })

    await fireEvent.click(await screen.findByTestId('resume-draft-button'))

    expect(await screen.findByTestId('current-exercise-name')).toHaveTextContent('Squat')
  })
})
