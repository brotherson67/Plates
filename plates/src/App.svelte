<script lang="ts">
  import { onMount } from 'svelte'
  import { App, Page, Navbar, Tabbar, TabbarLink, Block, Button } from 'konsta/svelte'
  import type { SupabaseClient, Session } from '@supabase/supabase-js'
  import { getSupabase } from './lib/supabase'
  import { isPasswordRecoveryUrl, signOut } from './lib/auth'
  import LoginForm from './lib/LoginForm.svelte'
  import SetPasswordForm from './lib/SetPasswordForm.svelte'
  import WorkoutSummary from './lib/WorkoutSummary.svelte'
  import ExerciseCatalog from './lib/ExerciseCatalog.svelte'
  import TemplateForm from './lib/TemplateForm.svelte'
  import RoutineForm from './lib/RoutineForm.svelte'
  import LogWorkoutForm from './lib/LogWorkoutForm.svelte'
  import type { Workout } from './lib/workout'

  export let client: SupabaseClient = getSupabase()

  type Tab = 'workouts' | 'routines' | 'exercises'
  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'workouts', label: 'Workouts' },
    { key: 'routines', label: 'Routines' },
    { key: 'exercises', label: 'Exercises' },
  ]

  let session: Session | null = null
  let loading = true
  let needsNewPassword = isPasswordRecoveryUrl(typeof window !== 'undefined' ? window.location.href : '')
  let activeTab: Tab = 'workouts'

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
    if (!window.confirm('Sign out of Plates?')) return
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
    <Navbar title="Plates">
      {#snippet right()}
        {#if session && !needsNewPassword}
          <form on:submit={handleSignOut}>
            <Button clear type="submit" data-testid="sign-out-button">Sign out</Button>
          </form>
        {/if}
      {/snippet}
    </Navbar>

    {#if loading}
      <Block>
        <p data-testid="loading">Loading…</p>
      </Block>
    {:else if !session}
      <LoginForm {client} />
    {:else if needsNewPassword}
      <SetPasswordForm {client} onDone={handlePasswordSet} />
    {:else}
      {#if activeTab === 'workouts'}
        <div data-testid="tab-panel-workouts">
          <WorkoutSummary workout={sampleWorkout} />
          <LogWorkoutForm {client} userId={session.user.id} />
        </div>
      {:else if activeTab === 'routines'}
        <div data-testid="tab-panel-routines">
          <RoutineForm {client} userId={session.user.id} />
          <TemplateForm {client} userId={session.user.id} />
        </div>
      {:else}
        <div data-testid="tab-panel-exercises">
          <ExerciseCatalog {client} />
        </div>
      {/if}

      <Block class="h-16" />
    {/if}
  </Page>

  {#if session && !needsNewPassword}
    <Tabbar labels class="fixed bottom-0 left-0 z-50">
      {#each TABS as tab (tab.key)}
        <TabbarLink
          active={activeTab === tab.key}
          label={tab.label}
          onclick={() => (activeTab = tab.key)}
          data-testid={`tab-${tab.key}`}
        />
      {/each}
    </Tabbar>
  {/if}
</App>
