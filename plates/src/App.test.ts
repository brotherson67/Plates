import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import App from './App.svelte'

function fakeClient(session: Session | null): SupabaseClient {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient
}

const fakeSession = { access_token: 'abc', user: { id: 'u1' } } as unknown as Session

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App (integration: auth gating + Konsta shell + WorkoutSummary)', () => {
  it('shows the login form when there is no session', async () => {
    render(App, { client: fakeClient(null) })
    expect(await screen.findByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByText('Squat')).not.toBeInTheDocument()
  })

  it('shows the workout summary and a sign-out button once signed in', async () => {
    render(App, { client: fakeClient(fakeSession) })
    expect(await screen.findByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByTestId('sign-out-button')).toBeInTheDocument()
    expect(screen.getByTestId('workout-total')).toBeInTheDocument()
  })

  it('calls client.auth.signOut only after the user confirms', async () => {
    const client = fakeClient(fakeSession)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(App, { client })
    const signOutButton = await screen.findByTestId('sign-out-button')
    const form = signOutButton.closest('form')
    expect(form).not.toBeNull()

    await fireEvent.submit(form as HTMLFormElement)

    expect(confirmSpy).toHaveBeenCalledWith('Sign out of Plates?')
    expect(client.auth.signOut).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('does not sign out if the user declines the confirmation', async () => {
    const client = fakeClient(fakeSession)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(App, { client })
    const signOutButton = await screen.findByTestId('sign-out-button')
    const form = signOutButton.closest('form')

    await fireEvent.submit(form as HTMLFormElement)

    expect(confirmSpy).toHaveBeenCalled()
    expect(client.auth.signOut).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('shows the set-password form instead of the app when the URL is an invite/recovery link', async () => {
    window.history.replaceState(null, '', '/#access_token=abc&type=invite')
    render(App, { client: fakeClient(fakeSession) })
    expect(await screen.findByTestId('set-password-form')).toBeInTheDocument()
    expect(screen.queryByText('Squat')).not.toBeInTheDocument()
  })

  it('defaults to the Workouts tab and shows the bottom tab bar once signed in', async () => {
    render(App, { client: fakeClient(fakeSession) })
    expect(await screen.findByTestId('tab-panel-workouts')).toBeInTheDocument()
    expect(screen.getByTestId('tab-workouts')).toBeInTheDocument()
    expect(screen.getByTestId('tab-routines')).toBeInTheDocument()
    expect(screen.getByTestId('tab-exercises')).toBeInTheDocument()
  })

  it('switches panels when a different tab is tapped, without losing the sign-out control', async () => {
    render(App, { client: fakeClient(fakeSession) })
    await screen.findByTestId('tab-panel-workouts')

    await fireEvent.click(screen.getByTestId('tab-routines'))
    expect(await screen.findByTestId('tab-panel-routines')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-panel-workouts')).not.toBeInTheDocument()
    expect(screen.getByTestId('sign-out-button')).toBeInTheDocument()

    await fireEvent.click(screen.getByTestId('tab-exercises'))
    expect(await screen.findByTestId('tab-panel-exercises')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-panel-routines')).not.toBeInTheDocument()
  })

  it('does not show the tab bar before signing in', async () => {
    render(App, { client: fakeClient(null) })
    await screen.findByTestId('login-form')
    expect(screen.queryByTestId('tab-workouts')).not.toBeInTheDocument()
  })
})
