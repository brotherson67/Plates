<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, List, ListItem, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { Workout } from './workout'
  import { logWorkout, type LogWorkoutInput } from './logWorkout'
  import {
    loadDraft,
    saveDraft,
    clearDraftStorage,
    addSetToDraft,
    removeLastSetFromDraft,
    advanceToNextExercise,
    skipCurrentExercise,
    clearRestTimer,
    setWorkoutMeta,
    draftToLogWorkoutInput,
    isDraftStale,
    type ActiveWorkoutDraft,
  } from './activeWorkoutDraft'
  import { getPriorPerformance, type PriorPerformance } from './priorPerformance'
  import { calculatePlateBreakdown, generateWarmupSets } from './plateMath'

  export let client: SupabaseClient
  export let userId: string
  export let onLogged: (workout: Workout) => void = () => {}
  export let onDiscarded: () => void = () => {}

  const UNIT = 'kg' as const
  const SAVE_RETRIES = 2
  const RETRY_DELAY_MS = 300

  let draft: ActiveWorkoutDraft | null = null
  let staleChoicePending = false

  let draftReps = ''
  let draftWeightKg = ''

  let priorPerformance: PriorPerformance | null = null
  let lastFetchedExerciseId: string | null = null

  let now = Date.now()

  let isFinishing = false
  let finishDurationMinutes = ''
  let finishRpe = ''
  let finishError: string | null = null
  let saving = false

  onMount(() => {
    const loaded = loadDraft()
    draft = loaded
    if (loaded && isDraftStale(loaded)) staleChoicePending = true

    const intervalId = setInterval(tick, 500)
    return () => clearInterval(intervalId)
  })

  function tick() {
    now = Date.now()
    if (draft?.restTimer) {
      const elapsed = Math.floor((now - Date.parse(draft.restTimer.startedAt)) / 1000)
      if (elapsed >= draft.restTimer.durationSeconds) {
        draft = clearRestTimer(draft)
        saveDraft(draft)
      }
    }
  }

  function resumeDraft() {
    staleChoicePending = false
  }

  function discardDraft() {
    clearDraftStorage()
    draft = null
    staleChoicePending = false
    onDiscarded()
  }

  async function loadPriorPerformance(exerciseDefinitionId: string) {
    priorPerformance = null
    try {
      priorPerformance = await getPriorPerformance(client, userId, exerciseDefinitionId)
    } catch {
      priorPerformance = null
    }
  }

  $: currentExercise = draft ? draft.exercises[draft.currentExerciseIndex] : undefined
  $: isLastExercise = draft ? draft.currentExerciseIndex >= draft.exercises.length - 1 : true
  $: if (currentExercise && currentExercise.exerciseDefinitionId !== lastFetchedExerciseId) {
    lastFetchedExerciseId = currentExercise.exerciseDefinitionId
    loadPriorPerformance(currentExercise.exerciseDefinitionId)
  }

  $: weightNum = Number(draftWeightKg)
  $: repsNum = Number(draftReps)
  $: hasValidWeight = draftWeightKg !== '' && Number.isFinite(weightNum) && weightNum > 0
  $: hasValidReps = draftReps !== '' && Number.isFinite(repsNum) && repsNum > 0
  $: plateBreakdown = hasValidWeight ? calculatePlateBreakdown(weightNum, UNIT) : null
  $: warmupSets = hasValidWeight && hasValidReps ? generateWarmupSets(weightNum, repsNum, UNIT).filter((s) => !s.isWorkingSet) : []

  $: restRemainingSeconds = draft?.restTimer
    ? Math.max(0, draft.restTimer.durationSeconds - Math.floor((now - Date.parse(draft.restTimer.startedAt)) / 1000))
    : null

  function useLastPerformance() {
    if (!priorPerformance || priorPerformance.sets.length === 0) return
    const lastSet = priorPerformance.sets[priorPerformance.sets.length - 1]
    draftReps = String(lastSet.reps)
    draftWeightKg = String(lastSet.weightKg)
  }

  function logSet() {
    if (!draft || !hasValidReps || !hasValidWeight) return
    draft = addSetToDraft(draft, draft.currentExerciseIndex, { reps: repsNum, weightKg: weightNum })
    saveDraft(draft)
    draftReps = ''
    draftWeightKg = ''
  }

  function undoLastSet() {
    if (!draft) return
    draft = removeLastSetFromDraft(draft, draft.currentExerciseIndex)
    saveDraft(draft)
  }

  function nextExercise() {
    if (!draft) return
    draft = advanceToNextExercise(draft)
    saveDraft(draft)
  }

  function skipExercise() {
    if (!draft) return
    draft = skipCurrentExercise(draft)
    saveDraft(draft)
  }

  function dismissRestTimer() {
    if (!draft) return
    draft = clearRestTimer(draft)
    saveDraft(draft)
  }

  function toNumberOrNull(value: string): number | null {
    return value === '' ? null : Number(value)
  }

  function openFinish() {
    isFinishing = true
    finishError = null
  }

  function cancelFinish() {
    isFinishing = false
    finishError = null
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function logWorkoutWithRetry(input: LogWorkoutInput): Promise<Workout> {
    let lastError: unknown
    for (let attempt = 0; attempt <= SAVE_RETRIES; attempt++) {
      try {
        return await logWorkout(client, userId, input)
      } catch (err) {
        lastError = err
        if (attempt < SAVE_RETRIES) await delay(RETRY_DELAY_MS)
      }
    }
    throw lastError
  }

  async function confirmFinish() {
    if (!draft) return
    draft = setWorkoutMeta(draft, {
      durationMinutes: toNumberOrNull(finishDurationMinutes),
      rpe: toNumberOrNull(finishRpe),
    })
    saveDraft(draft)
    await saveWorkout()
  }

  async function saveWorkout() {
    if (!draft) return
    finishError = null
    saving = true
    try {
      const input = draftToLogWorkoutInput(draft)
      const workout = await logWorkoutWithRetry(input)
      clearDraftStorage()
      onLogged(workout)
    } catch (err) {
      finishError = err instanceof Error ? err.message : 'Could not save the workout. Your progress is still saved on this device.'
    } finally {
      saving = false
    }
  }
</script>

<BlockTitle>Active workout</BlockTitle>

{#if !draft}
  <Block strong inset>
    <p data-testid="guided-workout-empty">No active workout.</p>
  </Block>
{:else if staleChoicePending}
  <Block strong inset data-testid="guided-workout-resume-prompt">
    <p>You have an unfinished workout from a while ago. Resume it, or start fresh?</p>
    <Button type="button" onClick={resumeDraft} data-testid="resume-draft-button">Resume</Button>
    <Button type="button" onClick={discardDraft} data-testid="discard-draft-button">Discard</Button>
  </Block>
{:else if isFinishing}
  <List strong inset data-testid="finish-workout-form">
    <ListInput label="Duration (minutes)" type="number" placeholder="Duration (minutes)" bind:value={finishDurationMinutes} />
    <ListInput label="RPE" type="number" placeholder="RPE" bind:value={finishRpe} />
  </List>
  {#if finishError}
    <Block strong inset>
      <p data-testid="finish-error">{finishError}</p>
    </Block>
  {/if}
  <Block strong inset>
    {#if finishError}
      <Button type="button" disabled={saving} onClick={saveWorkout} data-testid="retry-save-button">
        {saving ? 'Retrying…' : 'Retry save'}
      </Button>
    {:else}
      <Button type="button" disabled={saving} onClick={confirmFinish} data-testid="confirm-finish-button">
        {saving ? 'Saving…' : 'Save workout'}
      </Button>
    {/if}
    <Button type="button" disabled={saving} onClick={cancelFinish} data-testid="cancel-finish-button">Back</Button>
  </Block>
{:else}
  <Block strong inset data-testid="exercise-progress">
    <p>Exercise {draft.currentExerciseIndex + 1} of {draft.exercises.length}</p>
  </Block>

  {#if currentExercise}
    <Block strong inset>
      <p data-testid="current-exercise-name" class="data-value">{currentExercise.name}</p>
      {#if currentExercise.targetSets || currentExercise.targetReps}
        <p>Target: {currentExercise.targetSets ?? '-'}x{currentExercise.targetReps ?? '-'}</p>
      {/if}
    </Block>

    {#if priorPerformance}
      <Block strong inset data-testid="prior-performance-hint">
        <p>
          Last time ({priorPerformance.workoutDate}):
          {#each priorPerformance.sets as set, i (i)}
            <span class="data-value">{set.reps}x{set.weightKg}kg</span>{i < priorPerformance.sets.length - 1 ? ', ' : ''}
          {/each}
        </p>
        <Button type="button" onClick={useLastPerformance} data-testid="use-last-performance-button">Use last time</Button>
      </Block>
    {/if}

    {#if draft.restTimer && restRemainingSeconds !== null}
      <Block strong inset data-testid="rest-timer">
        <p>Rest: <span class="data-value">{restRemainingSeconds}s</span></p>
        <Button type="button" onClick={dismissRestTimer} data-testid="dismiss-rest-timer-button">Skip rest</Button>
      </Block>
    {/if}

    <List strong inset>
      <ListInput label="Reps" type="number" placeholder="Reps" bind:value={draftReps} />
      <ListInput label="Weight (kg)" type="number" placeholder="Weight (kg)" bind:value={draftWeightKg} />
    </List>

    {#if plateBreakdown}
      <Block strong inset data-testid="plate-breakdown">
        <p>
          Bar {plateBreakdown.barWeight}kg
          {#each plateBreakdown.perSide as plate (plate.weight)}
            + {plate.count}x{plate.weight}kg/side
          {/each}
          {#if !plateBreakdown.achievable}
            <span data-testid="plate-breakdown-remainder">(+{plateBreakdown.remainderPerSide}kg/side not platable)</span>
          {/if}
        </p>
      </Block>
    {/if}

    {#if warmupSets.length > 0}
      <Block strong inset data-testid="warmup-sets">
        <p>Warm-up:</p>
        {#each warmupSets as set, i (i)}
          <p class="data-value">{set.reps}x{set.weight}kg</p>
        {/each}
      </Block>
    {/if}

    <Block strong inset>
      <Button type="button" disabled={!hasValidReps || !hasValidWeight} onClick={logSet} data-testid="log-set-button">
        Log set
      </Button>
      {#if currentExercise.sets.length > 0}
        <Button type="button" onClick={undoLastSet} data-testid="undo-last-set-button">Undo last set</Button>
      {/if}
    </Block>

    <List strong inset data-testid="logged-sets-list">
      {#each currentExercise.sets as set, i (i)}
        <ListItem title={`Set ${i + 1}`} after={`${set.reps} x ${set.weightKg}kg`} />
      {/each}
    </List>

    <Block strong inset>
      <Button type="button" onClick={skipExercise} data-testid="skip-exercise-button">Skip exercise</Button>
      {#if !isLastExercise}
        <Button type="button" onClick={nextExercise} data-testid="next-exercise-button">Next exercise</Button>
      {/if}
    </Block>
  {:else}
    <Block strong inset>
      <p data-testid="no-exercises">No exercises in this workout.</p>
    </Block>
  {/if}

  <Block strong inset>
    <Button type="button" onClick={openFinish} data-testid="finish-workout-button">Finish workout</Button>
  </Block>
{/if}
