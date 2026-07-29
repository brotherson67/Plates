import { describe, it, expect } from 'vitest'
import { upsertRecoveryCheckin, getRecoveryCheckinForDate, listRecoveryCheckins } from './recovery'
import { fakeClientReturning } from './testSupabase'

describe('upsertRecoveryCheckin', () => {
  it('sends the correct snake_case payload and passes readiness_score through unmodified', async () => {
    const { client, from } = fakeClientReturning({
      data: {
        id: 'c1',
        checkin_date: '2026-07-28',
        sleep_log_id: 's1',
        soreness: 4,
        stress: 2,
        motivation: 5,
        readiness_score: 83,
      },
      error: null,
    })

    const result = await upsertRecoveryCheckin(client, 'u1', '2026-07-28', {
      soreness: 4,
      stress: 2,
      motivation: 5,
      sleepLogId: 's1',
      readinessScore: 83,
    })

    expect(from).toHaveBeenCalledWith('recovery_checkins')
    const builder = from.mock.results[0].value
    // The exact value passed in must reach the database untouched - this
    // module must never recompute the score itself.
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        checkin_date: '2026-07-28',
        sleep_log_id: 's1',
        soreness: 4,
        stress: 2,
        motivation: 5,
        readiness_score: 83,
      },
      { onConflict: 'user_id,checkin_date' },
    )
    expect(result).toEqual({
      id: 'c1',
      date: '2026-07-28',
      sleepLogId: 's1',
      soreness: 4,
      stress: 2,
      motivation: 5,
      readinessScore: 83,
    })
  })

  it('sends a null sleep_log_id when no sleep log is linked', async () => {
    const { client, from } = fakeClientReturning({
      data: {
        id: 'c2',
        checkin_date: '2026-07-28',
        sleep_log_id: null,
        soreness: 3,
        stress: 3,
        motivation: 3,
        readiness_score: 50,
      },
      error: null,
    })

    await upsertRecoveryCheckin(client, 'u1', '2026-07-28', {
      soreness: 3,
      stress: 3,
      motivation: 3,
      sleepLogId: null,
      readinessScore: 50,
    })

    const builder = from.mock.results[0].value
    expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({ sleep_log_id: null }), expect.anything())
  })

  it('throws when the upsert errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('rls violation') })
    await expect(
      upsertRecoveryCheckin(client, 'u1', '2026-07-28', {
        soreness: 3,
        stress: 3,
        motivation: 3,
        sleepLogId: null,
        readinessScore: 50,
      }),
    ).rejects.toThrow('rls violation')
  })
})

describe('getRecoveryCheckinForDate', () => {
  it('maps a found row', async () => {
    const { client } = fakeClientReturning({
      data: {
        id: 'c1',
        checkin_date: '2026-07-28',
        sleep_log_id: 's1',
        soreness: 4,
        stress: 2,
        motivation: 5,
        readiness_score: 83,
      },
      error: null,
    })

    const result = await getRecoveryCheckinForDate(client, 'u1', '2026-07-28')
    expect(result).toEqual({
      id: 'c1',
      date: '2026-07-28',
      sleepLogId: 's1',
      soreness: 4,
      stress: 2,
      motivation: 5,
      readinessScore: 83,
    })
  })

  it('returns null when no row exists', async () => {
    const { client } = fakeClientReturning({ data: null, error: null })
    expect(await getRecoveryCheckinForDate(client, 'u1', '2026-07-28')).toBeNull()
  })

  it('throws when the query errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('boom') })
    await expect(getRecoveryCheckinForDate(client, 'u1', '2026-07-28')).rejects.toThrow('boom')
  })
})

describe('listRecoveryCheckins', () => {
  it('orders by checkin_date descending and maps every row', async () => {
    const { client, from } = fakeClientReturning({
      data: [
        {
          id: 'c2',
          checkin_date: '2026-07-27',
          sleep_log_id: null,
          soreness: 2,
          stress: 4,
          motivation: 3,
          readiness_score: 40,
        },
      ],
      error: null,
    })

    const result = await listRecoveryCheckins(client, 'u1')

    const builder = from.mock.results[0].value
    expect(builder.order).toHaveBeenCalledWith('checkin_date', { ascending: false })
    expect(result).toEqual([
      {
        id: 'c2',
        date: '2026-07-27',
        sleepLogId: null,
        soreness: 2,
        stress: 4,
        motivation: 3,
        readinessScore: 40,
      },
    ])
  })

  it('applies sinceDate and limit only when provided', async () => {
    const { client, from } = fakeClientReturning({ data: [], error: null })
    await listRecoveryCheckins(client, 'u1', { sinceDate: '2026-06-28', limit: 30 })
    const builder = from.mock.results[0].value
    expect(builder.gte).toHaveBeenCalledWith('checkin_date', '2026-06-28')
    expect(builder.limit).toHaveBeenCalledWith(30)
  })

  it('throws when the query errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('boom') })
    await expect(listRecoveryCheckins(client, 'u1')).rejects.toThrow('boom')
  })
})
