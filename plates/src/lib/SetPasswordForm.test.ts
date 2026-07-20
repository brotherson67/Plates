import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import type { SupabaseClient } from '@supabase/supabase-js'
import SetPasswordForm from './SetPasswordForm.svelte'

function fakeClient(updateUser: ReturnType<typeof vi.fn>): SupabaseClient {
  return { auth: { updateUser } } as unknown as SupabaseClient
}

describe('SetPasswordForm (integration: form + validation + auth.setNewPassword)', () => {
  it('rejects mismatched passwords without calling Supabase at all', async () => {
    const updateUser = vi.fn()
    render(SetPasswordForm, { client: fakeClient(updateUser) })

    await fireEvent.input(screen.getByPlaceholderText('New password'), { target: { value: 'longenough1' } })
    await fireEvent.input(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'longenough2' } })
    await fireEvent.submit(screen.getByTestId('set-password-form'))

    expect(await screen.findByTestId('set-password-error')).toHaveTextContent('Passwords do not match.')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('calls updateUser and onDone when the password is valid', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    const onDone = vi.fn()
    render(SetPasswordForm, { client: fakeClient(updateUser), onDone })

    await fireEvent.input(screen.getByPlaceholderText('New password'), { target: { value: 'longenough1' } })
    await fireEvent.input(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'longenough1' } })
    await fireEvent.submit(screen.getByTestId('set-password-form'))

    expect(updateUser).toHaveBeenCalledWith({ password: 'longenough1' })
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
