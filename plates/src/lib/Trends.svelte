<script lang="ts">
  import { onMount } from 'svelte'
  import { Block, BlockTitle, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { daysAgoDateString, sparklinePoints, todayDateString, type RecoveryCheckin, type SleepLog } from './health'
  import { listSleepLogs, upsertSleepLog } from './sleep'
  import { listRecoveryCheckins } from './recovery'

  export let client: SupabaseClient
  export let userId: string

  const TREND_DAYS = 30
  const today = todayDateString()
  const sinceDate = daysAgoDateString(TREND_DAYS)
  const RATINGS = [1, 2, 3, 4, 5]

  let loading = true
  let error: string | null = null
  let sleepLogs: SleepLog[] = []
  let recoveryCheckins: RecoveryCheckin[] = []

  let sleepHours = ''
  let sleepQualityInput = 3
  let savingSleep = false
  let sleepError: string | null = null

  onMount(async () => {
    try {
      const [sleepResult, checkinResult] = await Promise.all([
        listSleepLogs(client, userId, { sinceDate }),
        listRecoveryCheckins(client, userId, { sinceDate }),
      ])
      sleepLogs = sleepResult
      recoveryCheckins = checkinResult

      const existingToday = sleepResult.find((log) => log.date === today)
      if (existingToday) {
        sleepHours = existingToday.hoursSlept === null ? '' : String(existingToday.hoursSlept)
        sleepQualityInput = existingToday.quality
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load trends.'
    } finally {
      loading = false
    }
  })

  async function saveQuickSleep() {
    sleepError = null
    savingSleep = true
    try {
      const hours = sleepHours === '' ? null : Number(sleepHours)
      const saved = await upsertSleepLog(client, userId, today, hours, sleepQualityInput)
      sleepLogs = [saved, ...sleepLogs.filter((log) => log.date !== today)]
    } catch (err) {
      sleepError = err instanceof Error ? err.message : 'Could not log sleep.'
    } finally {
      savingSleep = false
    }
  }

  // Builds an explicit oldest->newest daily timeline over the trend window,
  // with `null` for any day that has no log - so the sparkline reflects
  // actual calendar gaps rather than however many sparse entries happen to
  // exist evenly spaced.
  function buildTimeline<T extends { date: string }>(logs: T[], valueOf: (item: T) => number | null): Array<number | null> {
    const byDate = new Map(logs.map((log) => [log.date, valueOf(log)]))
    const timeline: Array<number | null> = []
    for (let daysAgo = TREND_DAYS - 1; daysAgo >= 0; daysAgo--) {
      timeline.push(byDate.get(daysAgoDateString(daysAgo)) ?? null)
    }
    return timeline
  }

  const SPARKLINE = { width: 300, height: 60 }
  $: sleepSparklinePoints = sparklinePoints(buildTimeline(sleepLogs, (log) => log.hoursSlept), SPARKLINE)
  $: readinessSparklinePoints = sparklinePoints(buildTimeline(recoveryCheckins, (c) => c.readinessScore), SPARKLINE)
  $: recentSleepQualities = [...sleepLogs].slice(0, 7).reverse()
  $: latestReadiness = recoveryCheckins[0]?.readinessScore ?? null
</script>

{#snippet ratingRow(label: string, value: number, onSelect: (n: number) => void, testIdPrefix: string)}
  <div class="mb-4">
    <p class="mb-1">{label}</p>
    <div class="flex gap-2">
      {#each RATINGS as n (n)}
        <button
          type="button"
          class={`w-11 h-11 rounded-sm flex items-center justify-center ${
            n === value
              ? 'bg-[var(--accent)] text-[var(--surface)]'
              : 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]'
          }`}
          onclick={() => onSelect(n)}
          data-testid={`${testIdPrefix}-${n}`}
        >
          {n}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<BlockTitle>Trends</BlockTitle>
{#if loading}
  <Block strong inset>
    <p data-testid="trends-loading">Loading…</p>
  </Block>
{:else}
  {#if error}
    <Block strong inset>
      <p data-testid="trends-error">{error}</p>
    </Block>
  {/if}

  <Block strong inset data-testid="sleep-quick-log-form">
    <p class="mb-1">Log last night's sleep</p>
    <input
      type="number"
      placeholder="Hours (optional)"
      bind:value={sleepHours}
      data-testid="sleep-quick-log-hours"
      class="mb-2 block w-full bg-transparent border border-[var(--border)] rounded-sm p-2"
    />
    {@render ratingRow('Quality', sleepQualityInput, (n) => (sleepQualityInput = n), 'sleep-quick-log-quality')}
    {#if sleepError}
      <p data-testid="sleep-quick-log-error">{sleepError}</p>
    {/if}
    <Button type="button" disabled={savingSleep} onClick={saveQuickSleep} data-testid="sleep-quick-log-save-button">
      {savingSleep ? 'Saving…' : 'Save sleep'}
    </Button>
  </Block>

  <BlockTitle>Sleep (last {TREND_DAYS} days)</BlockTitle>
  <Block strong inset>
    <svg viewBox={`0 0 ${SPARKLINE.width} ${SPARKLINE.height}`} data-testid="sleep-trend-sparkline">
      <polyline points={sleepSparklinePoints} fill="none" stroke="var(--accent)" stroke-width="2" />
    </svg>
    <div class="flex gap-2 justify-end mt-2">
      {#each recentSleepQualities as log (log.id)}
        <span class="data-value">{log.quality}</span>
      {/each}
    </div>
  </Block>

  <BlockTitle>Readiness (last {TREND_DAYS} days)</BlockTitle>
  <Block strong inset>
    <p>
      Latest: <span class="data-value" data-testid="readiness-latest-value">{latestReadiness ?? '—'}</span>
    </p>
    <svg viewBox={`0 0 ${SPARKLINE.width} ${SPARKLINE.height}`} data-testid="readiness-trend-sparkline">
      <polyline points={readinessSparklinePoints} fill="none" stroke="var(--accent)" stroke-width="2" />
    </svg>
  </Block>
{/if}
