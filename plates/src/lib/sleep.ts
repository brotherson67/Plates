import type { SupabaseClient } from '@supabase/supabase-js'
import type { SleepLog } from './health'

interface SleepLogRow {
  id: string
  sleep_date: string
  hours_slept: number | null
  quality: number
}

function fromRow(row: SleepLogRow): SleepLog {
  return { id: row.id, date: row.sleep_date, hoursSlept: row.hours_slept, quality: row.quality }
}

export async function upsertSleepLog(
  client: SupabaseClient,
  userId: string,
  date: string,
  hoursSlept: number | null,
  quality: number,
): Promise<SleepLog> {
  const { data, error } = await client
    .from('sleep_logs')
    .upsert(
      { user_id: userId, sleep_date: date, hours_slept: hoursSlept, quality },
      { onConflict: 'user_id,sleep_date' },
    )
    .select('id, sleep_date, hours_slept, quality')
    .single()
  if (error) throw error
  return fromRow(data as SleepLogRow)
}

export async function getSleepLogForDate(client: SupabaseClient, userId: string, date: string): Promise<SleepLog | null> {
  const { data, error } = await client
    .from('sleep_logs')
    .select('id, sleep_date, hours_slept, quality')
    .eq('user_id', userId)
    .eq('sleep_date', date)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as SleepLogRow) : null
}

export async function listSleepLogs(
  client: SupabaseClient,
  userId: string,
  options: { sinceDate?: string; limit?: number } = {},
): Promise<SleepLog[]> {
  let query = client
    .from('sleep_logs')
    .select('id, sleep_date, hours_slept, quality')
    .eq('user_id', userId)
    .order('sleep_date', { ascending: false })
  if (options.sinceDate) query = query.gte('sleep_date', options.sinceDate)
  if (options.limit) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as SleepLogRow[]).map(fromRow)
}
