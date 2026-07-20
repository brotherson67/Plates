import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInWithPassword, signOut, setNewPassword, isPasswordRecoveryUrl, validateNewPassword } from './auth'

function fakeClient(authOverrides: Record<string, unknown> = {}): SupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: 'abc' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      ...authOverrides,
    },
  } as unknown as SupabaseClient
}

describe('signInWithPassword', () => {
  it('returns the session on success', async () => {
    const client = fakeClient()
    const session = await signInWithPassword(client, 'a@b.com', 'hunter22')
    expect(session).toEqual({ access_token: 'abc' })
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'hunter22' })
  })

  it('throws the Supabase error on failure', async () => {
    const client = fakeClient({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: new Error('Invalid credentials') }),
    })
    await expect(signInWithPassword(client, 'a@b.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })

  it('throws a clear error if there is no error but also no session', async () => {
    const client = fakeClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    })
    await expect(signInWithPassword(client, 'a@b.com', 'x')).rejects.toThrow(/no session/i)
  })
})

describe('signOut', () => {
  it('calls supabase signOut', async () => {
    const client = fakeClient()
    await signOut(client)
    expect(client.auth.signOut).toHaveBeenCalled()
  })

  it('throws on error', async () => {
    const client = fakeClient({ signOut: vi.fn().mockResolvedValue({ error: new Error('network down') }) })
    await expect(signOut(client)).rejects.toThrow('network down')
  })
})

describe('setNewPassword', () => {
  it('calls updateUser with the new password', async () => {
    const client = fakeClient()
    await setNewPassword(client, 'newpassword123')
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
  })

  it('throws on error', async () => {
    const client = fakeClient({ updateUser: vi.fn().mockResolvedValue({ error: new Error('weak password') }) })
    await expect(setNewPassword(client, 'x')).rejects.toThrow('weak password')
  })
})

describe('isPasswordRecoveryUrl', () => {
  it('detects an invite link', () => {
    expect(isPasswordRecoveryUrl('https://app.example.com/#access_token=abc&type=invite')).toBe(true)
  })

  it('detects a recovery link', () => {
    expect(isPasswordRecoveryUrl('https://app.example.com/#access_token=abc&type=recovery')).toBe(true)
  })

  it('returns false for a normal sign-in redirect type', () => {
    expect(isPasswordRecoveryUrl('https://app.example.com/#access_token=abc&type=magiclink')).toBe(false)
  })

  it('returns false when there is no hash at all', () => {
    expect(isPasswordRecoveryUrl('https://app.example.com/')).toBe(false)
  })
})

describe('validateNewPassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validateNewPassword('short', 'short')).toMatch(/at least 8/)
  })

  it('rejects mismatched confirmation', () => {
    expect(validateNewPassword('longenough1', 'longenough2')).toBe('Passwords do not match.')
  })

  it('accepts a valid matching password', () => {
    expect(validateNewPassword('longenough1', 'longenough1')).toBeNull()
  })
})
