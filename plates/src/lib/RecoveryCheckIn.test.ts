import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import RecoveryCheckIn from './RecoveryCheckIn.svelte'
import { fakeClientByTableSequence } from './testSupabase'
import { todayDateString, calculateReadinessScore } from './health'

const today = todayDateString()

describe('RecoveryCheckIn (integration: view/edit today’s check-in, inline sleep prompt)', () => {
  it('prompts for sleep inline when neither a check-in nor a sleep log exists today, then saves the check-in', async () => {
    const expectedScore = calculateReadinessScore({ sleepQuality: 4, soreness: 4, stress: 2, motivation: 5 })

    const { client, from } = fakeClientByTableSequence({
      recovery_checkins: [
        { data: null, error: null },
        {
          data: {
            id: 'c1',
            checkin_date: today,
            sleep_log_id: 's1',
            soreness: 4,
            stress: 2,
            motivation: 5,
            readiness_score: expectedScore,
          },
          error: null,
        },
      ],
      sleep_logs: [
        { data: null, error: null },
        { data: { id: 's1', sleep_date: today, hours_slept: 7, quality: 4 }, error: null },
      ],
    })

    render(RecoveryCheckIn, { client, userId: 'u1' })

    await screen.findByTestId('inline-sleep-log-form')
    expect(screen.getByTestId('soreness-rating-4')).toBeInTheDocument()

    await fireEvent.input(screen.getByPlaceholderText('Hours (optional)'), { target: { value: '7' } })
    await fireEvent.click(screen.getByTestId('sleep-quality-rating-4'))
    await fireEvent.click(screen.getByTestId('inline-sleep-log-save-button'))

    await waitFor(() => expect(screen.queryByTestId('inline-sleep-log-form')).not.toBeInTheDocument())
    expect(screen.getByTestId('sleep-log-quality-readonly')).toHaveTextContent('4/5')

    await fireEvent.click(screen.getByTestId('soreness-rating-4'))
    await fireEvent.click(screen.getByTestId('stress-rating-2'))
    await fireEvent.click(screen.getByTestId('motivation-rating-5'))
    await fireEvent.click(screen.getByTestId('recovery-checkin-save-button'))

    await screen.findByTestId('recovery-checkin-view')
    expect(screen.getByTestId('readiness-score-value')).toHaveTextContent(String(expectedScore))

    const sleepUpsertBuilder = from.mock.results[2].value
    expect(sleepUpsertBuilder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', sleep_date: today, hours_slept: 7, quality: 4 },
      { onConflict: 'user_id,sleep_date' },
    )

    const checkinUpsertBuilder = from.mock.results[3].value
    expect(checkinUpsertBuilder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        checkin_date: today,
        sleep_log_id: 's1',
        soreness: 4,
        stress: 2,
        motivation: 5,
        readiness_score: expectedScore,
      },
      { onConflict: 'user_id,checkin_date' },
    )
  })

  it('does not show the inline sleep prompt when a sleep log already exists today', async () => {
    const { client } = fakeClientByTableSequence({
      recovery_checkins: [{ data: null, error: null }],
      sleep_logs: [{ data: { id: 's1', sleep_date: today, hours_slept: 8, quality: 5 }, error: null }],
    })

    render(RecoveryCheckIn, { client, userId: 'u1' })

    await screen.findByTestId('recovery-checkin-edit-form')
    expect(screen.queryByTestId('inline-sleep-log-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('sleep-log-quality-readonly')).toHaveTextContent('5/5')
  })

  it('renders a read-only view with the persisted score when a check-in already exists today', async () => {
    const { client } = fakeClientByTableSequence({
      recovery_checkins: [
        {
          data: {
            id: 'c1',
            checkin_date: today,
            sleep_log_id: 's1',
            soreness: 4,
            stress: 1,
            motivation: 5,
            readiness_score: 95,
          },
          error: null,
        },
      ],
      sleep_logs: [{ data: { id: 's1', sleep_date: today, hours_slept: 8, quality: 4 }, error: null }],
    })

    render(RecoveryCheckIn, { client, userId: 'u1' })

    expect(await screen.findByTestId('recovery-checkin-view')).toBeInTheDocument()
    expect(screen.getByTestId('readiness-score-value')).toHaveTextContent('95')
    expect(screen.getByText(/Soreness 4\/5/)).toBeInTheDocument()
    expect(screen.queryByTestId('recovery-checkin-edit-form')).not.toBeInTheDocument()
  })

  it('prefills the edit form from the existing check-in and saves an update', async () => {
    const { client } = fakeClientByTableSequence({
      recovery_checkins: [
        {
          data: {
            id: 'c1',
            checkin_date: today,
            sleep_log_id: 's1',
            soreness: 4,
            stress: 1,
            motivation: 5,
            readiness_score: 95,
          },
          error: null,
        },
        {
          data: {
            id: 'c1',
            checkin_date: today,
            sleep_log_id: 's1',
            soreness: 4,
            stress: 1,
            motivation: 2,
            readiness_score: 60,
          },
          error: null,
        },
      ],
      sleep_logs: [{ data: { id: 's1', sleep_date: today, hours_slept: 8, quality: 4 }, error: null }],
    })

    render(RecoveryCheckIn, { client, userId: 'u1' })
    await screen.findByTestId('recovery-checkin-view')

    await fireEvent.click(screen.getByTestId('recovery-checkin-edit-button'))
    await screen.findByTestId('recovery-checkin-edit-form')

    // Prefill proves itself through the reactive preview: it reflects the
    // checkin's original soreness/stress/motivation (4/1/5) + the loaded
    // sleep quality (4), not the component's un-prefilled defaults (3/3/3).
    const prefillScore = calculateReadinessScore({ sleepQuality: 4, soreness: 4, stress: 1, motivation: 5 })
    expect(screen.getByTestId('readiness-score-value')).toHaveTextContent(String(prefillScore))

    await fireEvent.click(screen.getByTestId('motivation-rating-2'))
    await fireEvent.click(screen.getByTestId('recovery-checkin-save-button'))

    await screen.findByTestId('recovery-checkin-view')
    expect(screen.getByTestId('readiness-score-value')).toHaveTextContent('60')
    expect(screen.getByText(/Motivation 2\/5/)).toBeInTheDocument()
  })

  it('shows an error instead of crashing when the initial load fails', async () => {
    const { client } = fakeClientByTableSequence({
      recovery_checkins: [{ data: null, error: new Error('boom') }],
      sleep_logs: [{ data: null, error: null }],
    })

    render(RecoveryCheckIn, { client, userId: 'u1' })

    expect(await screen.findByTestId('recovery-checkin-error')).toHaveTextContent('boom')
  })
})
