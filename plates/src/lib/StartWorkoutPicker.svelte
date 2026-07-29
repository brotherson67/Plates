<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, List, ListItem, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { listRoutines, listRoutineWorkouts, listWorkoutTemplates, listTemplateExercises } from './routines'
  import { listExerciseDefinitions } from './exercises'
  import { createDraft, saveDraft, type ActiveExerciseDraft } from './activeWorkoutDraft'
  import type { ExerciseDefinition, Routine, RoutineWorkout, Workout, WorkoutTemplate } from './workout'
  import LogWorkoutForm from './LogWorkoutForm.svelte'

  export let client: SupabaseClient
  export let userId: string
  export let onStarted: () => void = () => {}
  export let onLogged: (workout: Workout) => void = () => {}

  let routines: Routine[] = []
  let templates: WorkoutTemplate[] = []
  let catalog: ExerciseDefinition[] = []
  let loading = true
  let error: string | null = null

  let expandedRoutineId: string | null = null
  let routineDays: RoutineWorkout[] = []
  let loadingDays = false
  let starting = false

  let mode: 'picker' | 'freeform' = 'picker'

  onMount(async () => {
    try {
      const [routinesResult, templatesResult, catalogResult] = await Promise.all([
        listRoutines(client),
        listWorkoutTemplates(client),
        listExerciseDefinitions(client),
      ])
      routines = routinesResult
      // The guided flow is lifting-only for this round - plate math,
      // warm-ups, and prior-performance hints are all lifting concepts.
      // Cardio still logs fine via Freeform below.
      templates = templatesResult.filter((template) => template.kind === 'lifting')
      catalog = catalogResult
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load workouts to start.'
    } finally {
      loading = false
    }
  })

  function templateById(id: string): WorkoutTemplate | undefined {
    return templates.find((template) => template.id === id)
  }

  function exerciseName(id: string): string {
    return catalog.find((exercise) => exercise.id === id)?.name ?? id
  }

  async function toggleRoutine(routine: Routine) {
    if (expandedRoutineId === routine.id) {
      expandedRoutineId = null
      return
    }
    expandedRoutineId = routine.id
    loadingDays = true
    error = null
    try {
      routineDays = await listRoutineWorkouts(client, routine.id)
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not load that routine's days."
    } finally {
      loadingDays = false
    }
  }

  async function startTemplate(templateId: string, routineWorkoutId: string | null) {
    error = null
    starting = true
    try {
      const templateExercises = await listTemplateExercises(client, templateId)
      const exercises: ActiveExerciseDraft[] = templateExercises.map((templateExercise) => ({
        exerciseDefinitionId: templateExercise.exerciseDefinitionId,
        name: exerciseName(templateExercise.exerciseDefinitionId),
        targetSets: templateExercise.targetSets,
        targetReps: templateExercise.targetReps,
        sets: [],
        skipped: false,
      }))
      const draft = createDraft({
        kind: 'lifting',
        templateId,
        routineWorkoutId,
        workoutDate: new Date().toISOString().slice(0, 10),
        exercises,
      })
      saveDraft(draft)
      onStarted()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not start that workout.'
      starting = false
    }
  }
</script>

<BlockTitle>Start a workout</BlockTitle>
{#if loading}
  <Block strong inset>
    <p data-testid="start-workout-loading">Loading…</p>
  </Block>
{:else if mode === 'freeform'}
  <LogWorkoutForm {client} {userId} {onLogged} />
{:else}
  {#if error}
    <Block strong inset>
      <p data-testid="start-workout-error">{error}</p>
    </Block>
  {/if}

  {#if routines.length > 0}
    <List strong inset data-testid="routine-list">
      {#each routines as routine (routine.id)}
        <ListItem
          title={routine.name}
          link
          onClick={() => toggleRoutine(routine)}
          data-testid={`routine-item-${routine.id}`}
        />
        {#if expandedRoutineId === routine.id}
          {#if loadingDays}
            <ListItem title="Loading days…" />
          {:else}
            {#each routineDays as day (day.id)}
              <ListItem
                title={`Day ${day.dayIndex}`}
                after={templateById(day.templateId)?.name ?? ''}
                link
                onClick={() => startTemplate(day.templateId, day.id)}
                data-testid={`routine-day-${day.id}`}
              />
            {/each}
          {/if}
        {/if}
      {/each}
    </List>
  {/if}

  {#if templates.length > 0}
    <List strong inset data-testid="template-list">
      {#each templates as template (template.id)}
        <ListItem
          title={template.name}
          link
          onClick={() => startTemplate(template.id, null)}
          data-testid={`template-item-${template.id}`}
        />
      {/each}
    </List>
  {/if}

  <Block strong inset>
    <Button type="button" disabled={starting} onClick={() => (mode = 'freeform')} data-testid="freeform-button">
      {starting ? 'Starting…' : 'Freeform'}
    </Button>
  </Block>
{/if}
