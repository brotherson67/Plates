<script lang="ts">
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
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
  import StartWorkoutPicker from './lib/StartWorkoutPicker.svelte'
  import GuidedWorkout from './lib/GuidedWorkout.svelte'
  import Trends from './lib/Trends.svelte'
  import { loadDraft } from './lib/activeWorkoutDraft'
  import type { Workout } from './lib/workout'

  export let client: SupabaseClient = getSupabase()

  type Tab = 'workouts' | 'routines' | 'exercises' | 'trends'
  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'workouts', label: 'Workouts' },
    { key: 'routines', label: 'Routines' },
    { key: 'exercises', label: 'Exercises' },
    { key: 'trends', label: 'Trends' },
  ]

  let session: Session | null = null
  let loading = true
  let needsNewPassword = isPasswordRecoveryUrl(typeof window !== 'undefined' ? window.location.href : '')
  let activeTab: Tab = 'workouts'
  let hasActiveDraft = false
  let reducedMotion = false

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

    hasActiveDraft = loadDraft() !== null
    reducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return () => subscription.unsubscribe()
  })

  function tabEnter(node: Element) {
    return fly(node, { y: 8, duration: reducedMotion ? 0 : 160 })
  }

  function handlePasswordSet() {
    needsNewPassword = false
  }

  function handleWorkoutLogged(_workout: Workout) {
    hasActiveDraft = false
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
        <p data-testid="loading"><span class="spinner" aria-hidden="true"></span>Loading…</p>
      </Block>
    {:else if !session}
      <LoginForm {client} />
    {:else if needsNewPassword}
      <SetPasswordForm {client} onDone={handlePasswordSet} />
    {:else}
      {#if activeTab === 'workouts'}
        <div data-testid="tab-panel-workouts" in:tabEnter>
          <WorkoutSummary workout={sampleWorkout} />
          {#if hasActiveDraft}
            <GuidedWorkout
              {client}
              userId={session.user.id}
              onLogged={handleWorkoutLogged}
              onDiscarded={() => (hasActiveDraft = false)}
            />
          {:else}
            <StartWorkoutPicker
              {client}
              userId={session.user.id}
              onStarted={() => (hasActiveDraft = true)}
              onLogged={handleWorkoutLogged}
            />
          {/if}
        </div>
      {:else if activeTab === 'routines'}
        <div data-testid="tab-panel-routines" in:tabEnter>
          <RoutineForm {client} userId={session.user.id} />
          <TemplateForm {client} userId={session.user.id} />
        </div>
      {:else if activeTab === 'trends'}
        <div data-testid="tab-panel-trends" in:tabEnter>
          <Trends {client} userId={session.user.id} />
        </div>
      {:else}
        <div data-testid="tab-panel-exercises" in:tabEnter>
          <ExerciseCatalog {client} />
        </div>
      {/if}

      <Block class="h-16" />
    {/if}
  </Page>

  {#if session && !needsNewPassword}
    {#snippet tabIcon(key: Tab)}
      {#if key === 'workouts'}
        <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9v6" /><path d="M21 9v6" /><path d="M7 7v10" /><path d="M17 7v10" /><path d="M7 12h10" />
        </svg>
      {:else if key === 'routines'}
        <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="1" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" />
        </svg>
      {:else if key === 'exercises'}
        <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6.5C10.3 5.2 8 4.5 5.5 4.5c-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.5 0 4.8.7 6.5 2 1.7-1.3 4-2 6.5-2 .8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5-2.5 0-4.8.7-6.5 2z" />
          <path d="M12 6.5v13" />
        </svg>
      {:else}
        <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 16l4.5-5 4 4L20 6.5" /><circle cx="20" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      {/if}
    {/snippet}

    <Tabbar labels icons class="fixed bottom-0 left-0 z-50">
      {#each TABS as tab (tab.key)}
        {#snippet icon()}
          {@render tabIcon(tab.key)}
        {/snippet}
        <TabbarLink
          active={activeTab === tab.key}
          label={tab.label}
          {icon}
          onclick={() => (activeTab = tab.key)}
          data-testid={`tab-${tab.key}`}
        />
      {/each}
    </Tabbar>
  {/if}
</App>
