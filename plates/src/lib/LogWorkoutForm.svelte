<script lang="ts">
  import { Block, BlockTitle, List, ListItem, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { logWorkout, type LogWorkoutInput } from './logWorkout'
  import type { CardioType, Workout, WorkoutKind, WorkoutSet } from './workout'

  export let client: SupabaseClient
  export let userId: string
  export let onLogged: (workout: Workout) => void = () => {}

  const CARDIO_TYPES: CardioType[] = ['steady_state', 'hiit', 'jog', 'walk', 'sprints']
  const today = new Date().toISOString().slice(0, 10)

  let kind: WorkoutKind = 'lifting'
  let workoutDate = today
  let durationMinutes = ''
  let rpe = ''
  let error: string | null = null
  let submitting = false
  let logged: Workout | null = null

  let exercises: Array<{ name: string; sets: WorkoutSet[] }> = []
  let draftName = ''
  let draftSets: WorkoutSet[] = []
  let draftReps = ''
  let draftWeightKg = ''

  function addSetToDraft() {
    const reps = Number(draftReps)
    const weightKg = Number(draftWeightKg)
    if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weightKg) || weightKg < 0) return
    draftSets = [...draftSets, { reps, weightKg }]
    draftReps = ''
    draftWeightKg = ''
  }

  function addExerciseToWorkout() {
    if (!draftName.trim() || draftSets.length === 0) return
    exercises = [...exercises, { name: draftName.trim(), sets: draftSets }]
    draftName = ''
    draftSets = []
  }

  let cardioType: CardioType = 'steady_state'
  let intendedDurationMinutes = ''
  let intendedDistanceKm = ''
  let actualDistanceKm = ''
  let inclinePercent = ''

  function toNumberOrNull(value: string): number | null {
    return value === '' ? null : Number(value)
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    error = null
    submitting = true
    try {
      const input: LogWorkoutInput =
        kind === 'lifting'
          ? {
              kind: 'lifting',
              workoutDate,
              durationMinutes: toNumberOrNull(durationMinutes),
              rpe: toNumberOrNull(rpe),
              exercises,
            }
          : {
              kind: 'cardio',
              workoutDate,
              durationMinutes: toNumberOrNull(durationMinutes),
              rpe: toNumberOrNull(rpe),
              cardio: {
                cardioType,
                intendedDurationMinutes: toNumberOrNull(intendedDurationMinutes),
                intendedDistanceKm: toNumberOrNull(intendedDistanceKm),
                actualDistanceKm: toNumberOrNull(actualDistanceKm),
                inclinePercent: toNumberOrNull(inclinePercent),
              },
            }
      logged = await logWorkout(client, userId, input)
      onLogged(logged)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not log the workout.'
    } finally {
      submitting = false
    }
  }
</script>

<BlockTitle>Log a workout</BlockTitle>
{#if logged}
  <Block strong inset>
    <p data-testid="log-workout-success">Logged {logged.kind} workout for {logged.date}.</p>
  </Block>
{:else}
  <form on:submit={handleSubmit} data-testid="log-workout-form">
    <List strong inset>
      <ListInput type="select" label="Kind" name="kind" bind:value={kind}>
        <option value="lifting">lifting</option>
        <option value="cardio">cardio</option>
      </ListInput>
      <ListInput label="Date" type="date" bind:value={workoutDate} />
      <ListInput label="Duration (minutes)" type="number" placeholder="Duration (minutes)" bind:value={durationMinutes} />
      <ListInput label="RPE" type="number" placeholder="RPE" bind:value={rpe} />
    </List>

    {#if kind === 'lifting'}
      <List strong inset data-testid="log-workout-exercises">
        {#each exercises as exercise, i (i)}
          <ListItem title={exercise.name} after={`${exercise.sets.length} sets`} />
        {/each}
      </List>
      <List strong inset>
        <ListInput label="Exercise name" placeholder="Exercise name" bind:value={draftName} />
        <ListInput label="Reps" type="number" placeholder="Reps" bind:value={draftReps} />
        <ListInput label="Weight (kg)" type="number" placeholder="Weight (kg)" bind:value={draftWeightKg} />
      </List>
      <Block strong inset>
        <p data-testid="log-workout-draft-sets">{draftSets.length} set(s) added to this exercise</p>
        <Button type="button" onClick={addSetToDraft} data-testid="add-set-button">Add set</Button>
        <Button type="button" onClick={addExerciseToWorkout} data-testid="add-exercise-to-workout-button">
          Add exercise to workout
        </Button>
      </Block>
    {:else}
      <List strong inset>
        <ListInput type="select" label="Cardio type" name="cardioType" bind:value={cardioType}>
          {#each CARDIO_TYPES as type (type)}
            <option value={type}>{type}</option>
          {/each}
        </ListInput>
        <ListInput
          label="Intended duration (min)"
          type="number"
          placeholder="Intended duration (min)"
          bind:value={intendedDurationMinutes}
        />
        <ListInput
          label="Intended distance (km)"
          type="number"
          placeholder="Intended distance (km)"
          bind:value={intendedDistanceKm}
        />
        <ListInput
          label="Actual distance (km)"
          type="number"
          placeholder="Actual distance (km)"
          bind:value={actualDistanceKm}
        />
        <ListInput label="Incline (%)" type="number" placeholder="Incline (%)" bind:value={inclinePercent} />
      </List>
    {/if}

    {#if error}
      <Block strong inset>
        <p data-testid="log-workout-error">{error}</p>
      </Block>
    {/if}
    <Block strong inset>
      <Button type="submit" disabled={submitting} data-testid="log-workout-submit">
        {submitting ? 'Logging…' : 'Log workout'}
      </Button>
    </Block>
  </form>
{/if}
