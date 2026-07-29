import { describe, it, expect } from 'vitest'
import { upsertSleepLog, getSleepLogForDate, listSleepLogs } from './sleep'
import { fakeClientReturning } from './testSupabase'

describe('upsertSleepLog', () => {
  it('sends the correct snake_case payload with onConflict, and maps the result back to camelCase', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 's1', sleep_date: '2026-07-28', hours_slept: 7.5, quality: 4 },
      error: null,
    })

    const result = await upsertSleepLog(client, 'u1', '2026-07-28', 7.5, 4)

    expect(from).toHaveBeenCalledWith('sleep_logs')
    const builder = from.mock.results[0].value
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', sleep_date: '2026-07-28', hours_slept: 7.5, quality: 4 },
      { onConflict: 'user_id,sleep_date' },
    )
    expect(result).toEqual({ id: 's1', date: '2026-07-28', hoursSlept: 7.5, quality: 4 })
  })

  it('allows a null hoursSlept (quality-only log)', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 's2', sleep_date: '2026-07-28', hours_slept: null, quality: 3 },
      error: null,
    })

    await upsertSleepLog(client, 'u1', '2026-07-28', null, 3)

    const builder = from.mock.results[0].value
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', sleep_date: '2026-07-28', hours_slept: null, quality: 3 },
      { onConflict: 'user_id,sleep_date' },
    )
  })

  it('throws when the upsert errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('constraint violation') })
    await expect(upsertSleepLog(client, 'u1', '2026-07-28', 7, 4)).rejects.toThrow('constraint violation')
  })
})

describe('getSleepLogForDate', () => {
  it('maps a found row', async () => {
    const { client, from } = fakeClientReturning({
      data: { id: 's1', sleep_date: '2026-07-28', hours_slept: 6, quality: 2 },
      error: null,
    })

    const result = await getSleepLogForDate(client, 'u1', '2026-07-28')

    const builder = from.mock.results[0].value
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'u1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'sleep_date', '2026-07-28')
    expect(result).toEqual({ id: 's1', date: '2026-07-28', hoursSlept: 6, quality: 2 })
  })

  it('returns null when no row exists', async () => {
    const { client } = fakeClientReturning({ data: null, error: null })
    expect(await getSleepLogForDate(client, 'u1', '2026-07-28')).toBeNull()
  })

  it('throws when the query errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('boom') })
    await expect(getSleepLogForDate(client, 'u1', '2026-07-28')).rejects.toThrow('boom')
  })
})

describe('listSleepLogs', () => {
  it('orders by sleep_date descending and maps every row', async () => {
    const { client, from } = fakeClientReturning({
      data: [
        { id: 's2', sleep_date: '2026-07-27', hours_slept: 8, quality: 5 },
        { id: 's1', sleep_date: '2026-07-26', hours_slept: 6, quality: 3 },
      ],
      error: null,
    })

    const result = await listSleepLogs(client, 'u1')

    const builder = from.mock.results[0].value
    expect(builder.order).toHaveBeenCalledWith('sleep_date', { ascending: false })
    expect(builder.gte).not.toHaveBeenCalled()
    expect(builder.limit).not.toHaveBeenCalled()
    expect(result).toEqual([
      { id: 's2', date: '2026-07-27', hoursSlept: 8, quality: 5 },
      { id: 's1', date: '2026-07-26', hoursSlept: 6, quality: 3 },
    ])
  })

  it('applies sinceDate and limit only when provided', async () => {
    const { client, from } = fakeClientReturning({ data: [], error: null })

    await listSleepLogs(client, 'u1', { sinceDate: '2026-06-28', limit: 30 })

    const builder = from.mock.results[0].value
    expect(builder.gte).toHaveBeenCalledWith('sleep_date', '2026-06-28')
    expect(builder.limit).toHaveBeenCalledWith(30)
  })

  it('returns an empty array when there are no rows', async () => {
    const { client } = fakeClientReturning({ data: [], error: null })
    expect(await listSleepLogs(client, 'u1')).toEqual([])
  })

  it('throws when the query errors', async () => {
    const { client } = fakeClientReturning({ data: null, error: new Error('boom') })
    await expect(listSleepLogs(client, 'u1')).rejects.toThrow('boom')
  })
})
