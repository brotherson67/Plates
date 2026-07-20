import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(url: string | undefined, anonKey: string | undefined): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
    )
  }
  return createClient(url, anonKey)
}

let cachedClient: SupabaseClient | undefined

// Lazy singleton: only throws/connects when something actually calls this,
// so importing this module (e.g. from tests) never requires env vars to be set.
export function getSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  }
  return cachedClient
}
