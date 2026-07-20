import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import type { SupabaseClient } from '@supabase/supabase-js'
import LoginForm from './LoginForm.svelte'

function fakeClient(signInWithPassword: ReturnType<typeof vi.fn>): SupabaseClient {
  return { auth: { signInWithPassword } } as unknown as SupabaseClient
}

describe('LoginForm (integration: form + auth.signInWithPassword)', () => {
  it('calls signInWithPassword with the entered email and password on submit', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null })
    render(LoginForm, { client: fakeClient(signInWithPassword) })

    await fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } })
    await fireEvent.input(screen.getByPlaceholderText('Password'), { target: { value: 'hunter22' } })
    await fireEvent.submit(screen.getByTestId('login-form'))

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'hunter22' })
  })

  it('shows the error message when sign-in fails', async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: new Error('Invalid login credentials') })
    render(LoginForm, { client: fakeClient(signInWithPassword) })

    await fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } })
    await fireEvent.input(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    await fireEvent.submit(screen.getByTestId('login-form'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Invalid login credentials')
  })
})
