import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FakeResult {
  data: unknown
  error: unknown
}

export interface FakeQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (result: FakeResult) => unknown, reject?: (error: unknown) => unknown) => unknown
}

// A minimal fake for supabase-js's chainable query builder. Every chain
// method returns the same object so calls like
// `.insert(...).select(...).single()` compose the same way the real client
// does, and the object itself is a thenable resolving to the given result -
// mirroring how supabase-js lets you `await` a query directly.
export function fakeQueryBuilder(result: FakeResult): FakeQueryBuilder {
  const builder: FakeQueryBuilder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

export function fakeClientReturning(result: FakeResult): {
  client: SupabaseClient
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
} {
  const builder = fakeQueryBuilder(result)
  const from = vi.fn(() => builder)
  // `.rpc(...).single()` must resolve the same way `.from(...)` chains do.
  const rpc = vi.fn(() => builder)
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc }
}

// For flows that make multiple sequential `.from(...)` calls (e.g. create a
// parent row, then a child row referencing it) - each call in the sequence
// gets the next queued result, its own independent builder.
export function fakeClientSequence(results: FakeResult[]): { client: SupabaseClient; from: ReturnType<typeof vi.fn> } {
  const queue = [...results]
  const from = vi.fn(() => fakeQueryBuilder(queue.shift() ?? { data: null, error: null }))
  return { client: { from } as unknown as SupabaseClient, from }
}

// For flows that read from several different tables (in any order, possibly
// more than once each, e.g. loading routines/templates/catalog in parallel)
// - each `.from(table)` call gets that table's queued result, independent of
// call order or count.
export function fakeClientByTable(resultsByTable: Record<string, FakeResult>): {
  client: SupabaseClient
  from: ReturnType<typeof vi.fn>
} {
  const from = vi.fn((table: string) => fakeQueryBuilder(resultsByTable[table] ?? { data: null, error: null }))
  return { client: { from } as unknown as SupabaseClient, from }
}
