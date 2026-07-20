<script lang="ts">
  import { onMount } from 'svelte'
  import { App, Page, Navbar, Block, Button } from 'konsta/svelte'
  import type { SupabaseClient, Session } from '@supabase/supabase-js'
  import { getSupabase } from './lib/supabase'
  import { isPasswordRecoveryUrl, signOut } from './lib/auth'
  import LoginForm from './lib/LoginForm.svelte'
  import SetPasswordForm from './lib/SetPasswordForm.svelte'
  import WorkoutSummary from './lib/WorkoutSummary.svelte'
  import type { Workout } from './lib/workout'

  export let client: SupabaseClient = getSupabase()

  let session: Session | null = null
  let loading = true
  let needsNewPassword = isPasswordRecoveryUrl(typeof window !== 'undefined' ? window.location.href : '')

  onMount(() => {
    client.auth.getSession().then(({ data }) => {
      session = data.session
      loading = false
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      session = newSession
    })

    return () => subscription.unsubscribe()
  })

  function handlePasswordSet() {
    needsNewPassword = false
  }

  async function handleSignOut(event: SubmitEvent) {
    event.preventDefault()
    await signOut(client)
  }

  const sampleWorkout: Workout = {
    id: 'sample',
    date: 'Today',
    exercises: [
      { name: 'Squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
      { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
    ],
  }
</script>

<App theme="ios">
  <Page>
    <Navbar title="Plates" />

    {#if loading}
      <Block>
        <p data-testid="loading">Loading…</p>
      </Block>
    {:else if !session}
      <LoginForm {client} />
    {:else if needsNewPassword}
      <SetPasswordForm {client} onDone={handlePasswordSet} />
    {:else}
      <Block strong inset>
        <form on:submit={handleSignOut}>
          <Button type="submit" data-testid="sign-out-button">Sign out</Button>
        </form>
      </Block>
      <WorkoutSummary workout={sampleWorkout} />
    {/if}
  </Page>
</App>
