import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecoveryCheckin } from './health'

interface RecoveryCheckinRow {
  id: string
  checkin_date: string
  sleep_log_id: string | null
  soreness: number
  stress: number
  motivation: number
  readiness_score: number
}

function fromRow(row: RecoveryCheckinRow): RecoveryCheckin {
  return {
    id: row.id,
    date: row.checkin_date,
    sleepLogId: row.sleep_log_id,
    soreness: row.soreness,
    stress: row.stress,
    motivation: row.motivation,
    readinessScore: row.readiness_score,
  }
}

export interface UpsertRecoveryCheckinInput {
  soreness: number
  stress: number
  motivation: number
  sleepLogId: string | null
  readinessScore: number
}

const SELECT_COLUMNS = 'id, checkin_date, sleep_log_id, soreness, stress, motivation, readiness_score'

export async function upsertRecoveryCheckin(
  client: SupabaseClient,
  userId: string,
  date: string,
  input: UpsertRecoveryCheckinInput,
): Promise<RecoveryCheckin> {
  const { data, error } = await client
    .from('recovery_checkins')
    .upsert(
      {
        user_id: userId,
        checkin_date: date,
        sleep_log_id: input.sleepLogId,
        soreness: input.soreness,
        stress: input.stress,
        motivation: input.motivation,
        readiness_score: input.readinessScore,
      },
      { onConflict: 'user_id,checkin_date' },
    )
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return fromRow(data as RecoveryCheckinRow)
}

export async function getRecoveryCheckinForDate(
  client: SupabaseClient,
  userId: string,
  date: string,
): Promise<RecoveryCheckin | null> {
  const { data, error } = await client
    .from('recovery_checkins')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('checkin_date', date)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as RecoveryCheckinRow) : null
}

export async function listRecoveryCheckins(
  client: SupabaseClient,
  userId: string,
  options: { sinceDate?: string; limit?: number } = {},
): Promise<RecoveryCheckin[]> {
  let query = client
    .from('recovery_checkins')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })
  if (options.sinceDate) query = query.gte('checkin_date', options.sinceDate)
  if (options.limit) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as RecoveryCheckinRow[]).map(fromRow)
}
