import { describe, it, expect } from 'vitest'
import { createSupabaseClient, getSupabase } from './supabase'

describe('createSupabaseClient', () => {
  it('throws a clear error when the URL is missing', () => {
    expect(() => createSupabaseClient(undefined, 'anon-key')).toThrow(/Missing Supabase configuration/)
  })

  it('throws a clear error when the anon key is missing', () => {
    expect(() => createSupabaseClient('https://example.supabase.co', undefined)).toThrow(
      /Missing Supabase configuration/,
    )
  })

  it('throws when both are missing', () => {
    expect(() => createSupabaseClient(undefined, undefined)).toThrow(/Missing Supabase configuration/)
  })

  it('creates a client when both values are present', () => {
    const client = createSupabaseClient('https://example.supabase.co', 'anon-key')
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})

describe('getSupabase (lazy singleton)', () => {
  it('throws when actually called without env vars configured, not merely on import', () => {
    // If this threw at import time, the whole test file would fail to load
    // (as it did before the fix) instead of surfacing as a normal assertion here.
    expect(() => getSupabase()).toThrow(/Missing Supabase configuration/)
  })
})
