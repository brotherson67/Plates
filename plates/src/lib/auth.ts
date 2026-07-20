import type { Session, SupabaseClient } from '@supabase/supabase-js'

export async function signInWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session) throw new Error('Signed in but no session was returned.')
  return data.session
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function setNewPassword(client: SupabaseClient, password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
}

// Supabase invite/recovery emails redirect back to the app with
// #access_token=...&type=invite (or type=recovery) in the URL hash. That's
// our signal to show a "set your password" form instead of the normal app.
export function isPasswordRecoveryUrl(url: string): boolean {
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return false
  const params = new URLSearchParams(url.slice(hashIndex + 1))
  const type = params.get('type')
  return type === 'invite' || type === 'recovery'
}

const MIN_PASSWORD_LENGTH = 8

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }
  return null
}
