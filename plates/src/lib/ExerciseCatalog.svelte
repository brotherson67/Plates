<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, List, ListItem, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { listExerciseDefinitions, createExerciseDefinition } from './exercises'
  import type { EquipmentType, ExerciseDefinition } from './workout'

  export let client: SupabaseClient
  export let onCreated: (exercise: ExerciseDefinition) => void = () => {}

  const EQUIPMENT_TYPES: EquipmentType[] = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'other']

  let exercises: ExerciseDefinition[] = []
  let name = ''
  let equipmentType: EquipmentType = 'other'
  let error: string | null = null
  let submitting = false

  onMount(async () => {
    try {
      exercises = await listExerciseDefinitions(client)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load the exercise catalog.'
    }
  })

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    error = null
    if (!name.trim()) {
      error = 'Name the exercise.'
      return
    }
    submitting = true
    try {
      const created = await createExerciseDefinition(client, name.trim(), equipmentType)
      exercises = [...exercises, created].sort((a, b) => a.name.localeCompare(b.name))
      name = ''
      onCreated(created)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not add exercise.'
    } finally {
      submitting = false
    }
  }
</script>

<BlockTitle>Exercise catalog</BlockTitle>
<List strong inset data-testid="exercise-catalog-list">
  {#each exercises as exercise (exercise.id)}
    <ListItem title={exercise.name} after={exercise.equipmentType} />
  {/each}
</List>
<form on:submit={handleAdd} data-testid="add-exercise-form">
  <List strong inset>
    <ListInput label="Exercise name" placeholder="Exercise name" bind:value={name} />
    <ListInput type="select" label="Equipment" name="equipmentType" bind:value={equipmentType}>
      {#each EQUIPMENT_TYPES as type (type)}
        <option value={type}>{type}</option>
      {/each}
    </ListInput>
  </List>
  {#if error}
    <Block strong inset>
      <p data-testid="exercise-catalog-error">{error}</p>
    </Block>
  {/if}
  <Block strong inset>
    <Button type="submit" disabled={submitting} data-testid="add-exercise-button">
      {submitting ? 'Adding…' : 'Add exercise'}
    </Button>
  </Block>
</form>
