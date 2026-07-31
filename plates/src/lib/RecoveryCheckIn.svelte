<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { calculateReadinessScore, todayDateString, type RecoveryCheckin, type SleepLog } from './health'
  import { getRecoveryCheckinForDate, upsertRecoveryCheckin } from './recovery'
  import { getSleepLogForDate, upsertSleepLog } from './sleep'

  export let client: SupabaseClient
  export let userId: string

  const today = todayDateString()
  const RATINGS = [1, 2, 3, 4, 5]

  let loading = true
  let error: string | null = null
  let checkin: RecoveryCheckin | null = null
  let sleepLog: SleepLog | null = null
  let mode: 'view' | 'edit' = 'edit'
  let saving = false

  let soreness = 3
  let stress = 3
  let motivation = 3

  let sleepHours = ''
  let sleepQualityInput = 3
  let savingSleep = false
  let sleepError: string | null = null

  onMount(async () => {
    try {
      const [checkinResult, sleepResult] = await Promise.all([
        getRecoveryCheckinForDate(client, userId, today),
        getSleepLogForDate(client, userId, today),
      ])
      checkin = checkinResult
      sleepLog = sleepResult
      if (checkin) {
        mode = 'view'
        soreness = checkin.soreness
        stress = checkin.stress
        motivation = checkin.motivation
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load today’s recovery check-in.'
    } finally {
      loading = false
    }
  })

  function startEdit() {
    if (checkin) {
      soreness = checkin.soreness
      stress = checkin.stress
      motivation = checkin.motivation
    }
    mode = 'edit'
  }

  async function saveInlineSleep() {
    sleepError = null
    savingSleep = true
    try {
      const hours = sleepHours === '' ? null : Number(sleepHours)
      sleepLog = await upsertSleepLog(client, userId, today, hours, sleepQualityInput)
    } catch (err) {
      sleepError = err instanceof Error ? err.message : 'Could not log sleep.'
    } finally {
      savingSleep = false
    }
  }

  $: previewScore = calculateReadinessScore({
    sleepQuality: sleepLog?.quality ?? null,
    soreness,
    stress,
    motivation,
  })

  async function saveCheckin() {
    error = null
    saving = true
    try {
      checkin = await upsertRecoveryCheckin(client, userId, today, {
        soreness,
        stress,
        motivation,
        sleepLogId: sleepLog?.id ?? null,
        readinessScore: previewScore,
      })
      mode = 'view'
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save the check-in.'
    } finally {
      saving = false
    }
  }
</script>

{#snippet ratingRow(label: string, value: number, onSelect: (n: number) => void, testIdPrefix: string)}
  <div class="mb-4">
    <p class="field-label mb-1">{label}</p>
    <div class="flex gap-2">
      {#each RATINGS as n (n)}
        <button
          type="button"
          class="rating-pill {n === value ? 'rating-pill--active' : ''}"
          onclick={() => onSelect(n)}
          data-testid={`${testIdPrefix}-${n}`}
        >
          {n}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<BlockTitle>Recovery check-in</BlockTitle>
{#if loading}
  <Block strong inset>
    <p data-testid="recovery-checkin-loading"><span class="spinner" aria-hidden="true"></span>Loading…</p>
  </Block>
{:else}
  {#if error}
    <Block strong inset>
      <p data-testid="recovery-checkin-error">{error}</p>
    </Block>
  {/if}

  {#if mode === 'view' && checkin}
    <Block strong inset data-testid="recovery-checkin-view">
      <p>
        Readiness: <span class="data-value" data-testid="readiness-score-value">{checkin.readinessScore}</span>
      </p>
      <p>Soreness {checkin.soreness}/5 · Stress {checkin.stress}/5 · Motivation {checkin.motivation}/5</p>
      <Button type="button" onClick={startEdit} data-testid="recovery-checkin-edit-button">Edit</Button>
    </Block>
  {:else}
    <Block strong inset data-testid="recovery-checkin-edit-form">
      {#if !sleepLog}
        <div data-testid="inline-sleep-log-form">
          <p class="field-label mb-1">Last night's sleep</p>
          <input
            type="number"
            placeholder="Hours (optional)"
            bind:value={sleepHours}
            class="mb-2 block w-full bg-transparent border border-[var(--border)] rounded-sm p-2"
          />
          {@render ratingRow('Sleep quality', sleepQualityInput, (n) => (sleepQualityInput = n), 'sleep-quality-rating')}
          {#if sleepError}
            <p data-testid="inline-sleep-log-error">{sleepError}</p>
          {/if}
          <Button
            type="button"
            disabled={savingSleep}
            onClick={saveInlineSleep}
            data-testid="inline-sleep-log-save-button"
          >
            {savingSleep ? 'Saving…' : 'Log sleep'}
          </Button>
        </div>
      {:else}
        <p class="mb-4" data-testid="sleep-log-quality-readonly">
          Sleep quality (from today's sleep log): <span class="data-value">{sleepLog.quality}/5</span>
        </p>
      {/if}

      {@render ratingRow('Soreness (5 = not sore)', soreness, (n) => (soreness = n), 'soreness-rating')}
      {@render ratingRow('Stress (1 = calm)', stress, (n) => (stress = n), 'stress-rating')}
      {@render ratingRow('Motivation', motivation, (n) => (motivation = n), 'motivation-rating')}

      <p class="mb-2">
        Readiness preview: <span class="data-value" data-testid="readiness-score-value">{previewScore}</span>
      </p>

      <Button type="button" disabled={saving} onClick={saveCheckin} data-testid="recovery-checkin-save-button">
        {saving ? 'Saving…' : 'Save check-in'}
      </Button>
    </Block>
  {/if}
{/if}
