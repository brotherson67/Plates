export interface SleepLog {
  id: string
  date: string
  hoursSlept: number | null
  quality: number
}

export interface RecoveryCheckin {
  id: string
  date: string
  sleepLogId: string | null
  soreness: number
  stress: number
  motivation: number
  readinessScore: number
}

export interface ReadinessInput {
  sleepQuality: number | null
  soreness: number
  stress: number
  motivation: number
}

type Polarity = 'positive' | 'negative'

function normalize(raw: number, polarity: Polarity, label: string): number {
  if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
    throw new RangeError(`${label} must be an integer 1-5, got ${raw}`)
  }
  return polarity === 'positive' ? (raw - 1) / 4 : (5 - raw) / 4
}

// Each factor is a 1-5 tap in its most natural question framing, which
// means they don't all point the same direction: soreness/motivation/sleep
// quality are asked so 5 = the good state, but stress is asked the
// conventional way (5 = very stressed, the bad state). Normalize every
// factor to a 0-1 "goodness" scale before averaging so the polarity
// mismatch can't silently skew the score. If sleepQuality is null (no
// sleep log yet today), it's excluded from the average rather than
// defaulted to a neutral value.
export function calculateReadinessScore(input: ReadinessInput): number {
  const factors: Array<{ raw: number; polarity: Polarity; label: string }> = [
    { raw: input.soreness, polarity: 'positive', label: 'soreness' },
    { raw: input.stress, polarity: 'negative', label: 'stress' },
    { raw: input.motivation, polarity: 'positive', label: 'motivation' },
  ]
  if (input.sleepQuality !== null) {
    factors.push({ raw: input.sleepQuality, polarity: 'positive', label: 'sleepQuality' })
  }
  const normalized = factors.map((factor) => normalize(factor.raw, factor.polarity, factor.label))
  const mean = normalized.reduce((sum, value) => sum + value, 0) / normalized.length
  return Math.round(mean * 100)
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function daysAgoDateString(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export interface SparklineOptions {
  width: number
  height: number
  padding?: number
}

// Pure mapping from a (possibly sparse) list of values to an SVG polyline
// `points` string - no charting library. `null` entries are days with no
// log and are treated as gaps (skipped, not interpolated or zeroed).
export function sparklinePoints(values: Array<number | null>, options: SparklineOptions): string {
  const { width, height } = options
  const padding = options.padding ?? 4

  const present = values
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null)

  if (present.length === 0) return ''

  if (present.length === 1) {
    const y = height / 2
    return `${padding},${y} ${width - padding},${y}`
  }

  const min = Math.min(...present.map((p) => p.value))
  const max = Math.max(...present.map((p) => p.value))
  const range = max - min
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const lastIndex = values.length - 1

  return present
    .map(({ value, index }) => {
      const x = padding + (index / lastIndex) * usableWidth
      const y = range === 0 ? height / 2 : padding + usableHeight - ((value - min) / range) * usableHeight
      return `${x},${y}`
    })
    .join(' ')
}
