<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, List, ListItem, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { listWorkoutTemplates, createRoutine, addRoutineWorkout } from './routines'
  import type { Routine, RoutineWorkout, WorkoutTemplate } from './workout'

  export let client: SupabaseClient
  export let userId: string
  export let onCreated: (routine: Routine) => void = () => {}

  let templates: WorkoutTemplate[] = []
  let name = ''
  let lengthDays = ''
  let error: string | null = null
  let submitting = false

  let routine: Routine | null = null
  let days: RoutineWorkout[] = []

  let selectedTemplateId = ''
  let dayIndex = ''
  let dayError: string | null = null
  let addingDay = false

  onMount(async () => {
    try {
      templates = await listWorkoutTemplates(client)
      selectedTemplateId = templates[0]?.id ?? ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load workout templates.'
    }
  })

  function templateName(id: string): string {
    return templates.find((template) => template.id === id)?.name ?? id
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault()
    error = null
    if (!name.trim()) {
      error = 'Name the routine.'
      return
    }
    submitting = true
    try {
      routine = await createRoutine(client, userId, name.trim(), lengthDays ? Number(lengthDays) : null)
      onCreated(routine)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not create the routine.'
    } finally {
      submitting = false
    }
  }

  async function handleAddDay(event: SubmitEvent) {
    event.preventDefault()
    dayError = null
    if (!routine) return
    if (!selectedTemplateId) {
      dayError = 'Choose a workout template.'
      return
    }
    if (dayIndex === '') {
      dayError = 'Enter a day number.'
      return
    }
    addingDay = true
    try {
      const added = await addRoutineWorkout(client, routine.id, selectedTemplateId, Number(dayIndex), days.length)
      days = [...days, added].sort((a, b) => a.dayIndex - b.dayIndex)
      dayIndex = ''
    } catch (err) {
      dayError = err instanceof Error ? err.message : 'Could not add that day.'
    } finally {
      addingDay = false
    }
  }
</script>

<BlockTitle>New routine</BlockTitle>
{#if !routine}
  <form on:submit={handleCreate} data-testid="routine-form">
    <List strong inset>
      <ListInput label="Routine name" placeholder="Routine name" bind:value={name} />
      <ListInput label="Length (days)" type="number" placeholder="Length (days)" bind:value={lengthDays} />
    </List>
    {#if error}
      <Block strong inset>
        <p data-testid="routine-error">{error}</p>
      </Block>
    {/if}
    <Block strong inset>
      <Button type="submit" disabled={submitting} data-testid="create-routine-button">
        {submitting ? 'Creating…' : 'Create routine'}
      </Button>
    </Block>
  </form>
{:else}
  <List strong inset data-testid="routine-days-list">
    {#each days as day (day.id)}
      <ListItem title={`Day ${day.dayIndex}`} after={templateName(day.templateId)} />
    {/each}
  </List>
  <form on:submit={handleAddDay} data-testid="add-routine-day-form">
    <List strong inset>
      <ListInput type="select" label="Workout" name="templateId" bind:value={selectedTemplateId}>
        {#each templates as template (template.id)}
          <option value={template.id}>{template.name}</option>
        {/each}
      </ListInput>
      <ListInput label="Day" type="number" placeholder="Day" bind:value={dayIndex} />
    </List>
    {#if dayError}
      <Block strong inset>
        <p data-testid="routine-day-error">{dayError}</p>
      </Block>
    {/if}
    <Block strong inset>
      <Button type="submit" disabled={addingDay} data-testid="add-routine-day-button">
        {addingDay ? 'Adding…' : 'Add day'}
      </Button>
    </Block>
  </form>
{/if}
