<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, List, ListItem, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { listExerciseDefinitions } from './exercises'
  import { createWorkoutTemplate, addTemplateExercise } from './routines'
  import type { ExerciseDefinition, TemplateExercise, WorkoutKind, WorkoutTemplate } from './workout'

  export let client: SupabaseClient
  export let userId: string
  export let onCreated: (template: WorkoutTemplate) => void = () => {}

  let catalog: ExerciseDefinition[] = []
  let name = ''
  let kind: WorkoutKind = 'lifting'
  let error: string | null = null
  let submitting = false

  let template: WorkoutTemplate | null = null
  let templateExercises: TemplateExercise[] = []

  let selectedExerciseId = ''
  let targetSets = ''
  let targetReps = ''
  let exerciseError: string | null = null
  let addingExercise = false

  onMount(async () => {
    try {
      catalog = await listExerciseDefinitions(client)
      selectedExerciseId = catalog[0]?.id ?? ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load the exercise catalog.'
    }
  })

  function exerciseName(id: string): string {
    return catalog.find((exercise) => exercise.id === id)?.name ?? id
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault()
    error = null
    if (!name.trim()) {
      error = 'Name the workout template.'
      return
    }
    submitting = true
    try {
      template = await createWorkoutTemplate(client, userId, name.trim(), kind)
      onCreated(template)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not create the template.'
    } finally {
      submitting = false
    }
  }

  async function handleAddExercise(event: SubmitEvent) {
    event.preventDefault()
    exerciseError = null
    if (!template) return
    if (!selectedExerciseId) {
      exerciseError = 'Choose an exercise.'
      return
    }
    addingExercise = true
    try {
      const added = await addTemplateExercise(client, template.id, selectedExerciseId, {
        targetSets: targetSets ? Number(targetSets) : null,
        targetReps: targetReps ? Number(targetReps) : null,
        position: templateExercises.length,
      })
      templateExercises = [...templateExercises, added]
      targetSets = ''
      targetReps = ''
    } catch (err) {
      exerciseError = err instanceof Error ? err.message : 'Could not add the exercise.'
    } finally {
      addingExercise = false
    }
  }
</script>

<BlockTitle>New workout template</BlockTitle>
{#if !template}
  <form on:submit={handleCreate} data-testid="template-form">
    <List strong inset>
      <ListInput label="Template name" placeholder="Template name" bind:value={name} />
      <ListInput type="select" label="Kind" name="kind" bind:value={kind}>
        <option value="lifting">lifting</option>
        <option value="cardio">cardio</option>
      </ListInput>
    </List>
    {#if error}
      <Block strong inset>
        <p data-testid="template-error">{error}</p>
      </Block>
    {/if}
    <Block strong inset>
      <Button type="submit" disabled={submitting} data-testid="create-template-button">
        {submitting ? 'Creating…' : 'Create template'}
      </Button>
    </Block>
  </form>
{:else if template.kind === 'lifting'}
  <List strong inset data-testid="template-exercises-list">
    {#each templateExercises as templateExercise (templateExercise.id)}
      <ListItem
        title={exerciseName(templateExercise.exerciseDefinitionId)}
        after={`${templateExercise.targetSets ?? '-'}x${templateExercise.targetReps ?? '-'}`}
      />
    {/each}
  </List>
  <form on:submit={handleAddExercise} data-testid="add-template-exercise-form">
    <List strong inset>
      <ListInput type="select" label="Exercise" name="exerciseDefinitionId" bind:value={selectedExerciseId}>
        {#each catalog as exercise (exercise.id)}
          <option value={exercise.id}>{exercise.name}</option>
        {/each}
      </ListInput>
      <ListInput label="Target sets" type="number" placeholder="Target sets" bind:value={targetSets} />
      <ListInput label="Target reps" type="number" placeholder="Target reps" bind:value={targetReps} />
    </List>
    {#if exerciseError}
      <Block strong inset>
        <p data-testid="template-exercise-error">{exerciseError}</p>
      </Block>
    {/if}
    <Block strong inset>
      <Button type="submit" disabled={addingExercise} data-testid="add-template-exercise-button">
        {addingExercise ? 'Adding…' : 'Add exercise'}
      </Button>
    </Block>
  </form>
{:else}
  <Block strong inset>
    <p data-testid="template-created">Cardio template "{template.name}" created.</p>
  </Block>
{/if}
