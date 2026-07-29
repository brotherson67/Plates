import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import Trends from './Trends.svelte'
import { fakeClientByTable, fakeClientByTableSequence } from './testSupabase'
import { todayDateString, daysAgoDateString } from './health'

const today = todayDateString()

describe('Trends (integration: sleep/readiness sparklines + sleep quick-log)', () => {
  it('renders sleep and readiness sparklines from loaded data', async () => {
    const { client } = fakeClientByTable({
      sleep_logs: {
        data: [
          { id: 's2', sleep_date: today, hours_slept: 7.5, quality: 4 },
          { id: 's1', sleep_date: daysAgoDateString(1), hours_slept: 6, quality: 3 },
        ],
        error: null,
      },
      recovery_checkins: {
        data: [
          {
            id: 'c2',
            checkin_date: today,
            sleep_log_id: 's2',
            soreness: 4,
            stress: 2,
            motivation: 5,
            readiness_score: 82,
          },
          {
            id: 'c1',
            checkin_date: daysAgoDateString(1),
            sleep_log_id: 's1',
            soreness: 3,
            stress: 3,
            motivation: 3,
            readiness_score: 55,
          },
        ],
        error: null,
      },
    })

    render(Trends, { client, userId: 'u1' })

    expect(await screen.findByTestId('readiness-latest-value')).toHaveTextContent('82')
    const sleepPolyline = screen.getByTestId('sleep-trend-sparkline').querySelector('polyline')
    const readinessPolyline = screen.getByTestId('readiness-trend-sparkline').querySelector('polyline')
    expect(sleepPolyline?.getAttribute('points')).not.toBe('')
    expect(readinessPolyline?.getAttribute('points')).not.toBe('')
  })

  it('renders without error and shows empty sparklines when there is no data yet', async () => {
    const { client } = fakeClientByTable({
      sleep_logs: { data: [], error: null },
      recovery_checkins: { data: [], error: null },
    })

    render(Trends, { client, userId: 'u1' })

    await screen.findByTestId('sleep-quick-log-form')
    expect(screen.queryByTestId('trends-error')).not.toBeInTheDocument()
    expect(screen.getByTestId('readiness-latest-value')).toHaveTextContent('—')
    expect(screen.getByTestId('sleep-trend-sparkline').querySelector('polyline')?.getAttribute('points')).toBe('')
    expect(screen.getByTestId('readiness-trend-sparkline').querySelector('polyline')?.getAttribute('points')).toBe('')
  })

  it('logs sleep via the quick-log form and updates the sleep trend', async () => {
    const { client, from } = fakeClientByTableSequence({
      sleep_logs: [
        { data: [], error: null },
        { data: { id: 's-new', sleep_date: today, hours_slept: 8, quality: 5 }, error: null },
      ],
      recovery_checkins: [{ data: [], error: null }],
    })

    render(Trends, { client, userId: 'u1' })
    await screen.findByTestId('sleep-quick-log-form')
    expect(screen.getByTestId('sleep-trend-sparkline').querySelector('polyline')?.getAttribute('points')).toBe('')

    await fireEvent.input(screen.getByTestId('sleep-quick-log-hours'), { target: { value: '8' } })
    await fireEvent.click(screen.getByTestId('sleep-quick-log-quality-5'))
    await fireEvent.click(screen.getByTestId('sleep-quick-log-save-button'))

    await waitFor(() =>
      expect(screen.getByTestId('sleep-trend-sparkline').querySelector('polyline')?.getAttribute('points')).not.toBe(''),
    )

    const upsertBuilder = from.mock.results[2].value
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', sleep_date: today, hours_slept: 8, quality: 5 },
      { onConflict: 'user_id,sleep_date' },
    )
  })
})
