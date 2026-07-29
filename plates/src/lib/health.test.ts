import { describe, it, expect, vi, afterEach } from 'vitest'
import { calculateReadinessScore, todayDateString, daysAgoDateString, sparklinePoints } from './health'

describe('calculateReadinessScore', () => {
  it('scores 100 when every factor is at its best', () => {
    expect(calculateReadinessScore({ sleepQuality: 5, soreness: 5, stress: 1, motivation: 5 })).toBe(100)
  })

  it('scores 0 when every factor is at its worst', () => {
    expect(calculateReadinessScore({ sleepQuality: 1, soreness: 1, stress: 5, motivation: 1 })).toBe(0)
  })

  it('averages over 3 factors (not a defaulted 4th) when sleepQuality is null', () => {
    const withoutSleep = calculateReadinessScore({ sleepQuality: null, soreness: 5, stress: 1, motivation: 5 })
    expect(withoutSleep).toBe(100)

    // If null were silently defaulted to a worst-case sleep value instead
    // of excluded, this would also be 100 - it isn't, proving exclusion.
    const withWorstSleep = calculateReadinessScore({ sleepQuality: 1, soreness: 5, stress: 1, motivation: 5 })
    expect(withWorstSleep).toBe(75)
    expect(withWorstSleep).not.toBe(withoutSleep)
  })

  it('lowers the score as stress rises (negative polarity)', () => {
    const base = { sleepQuality: 3, soreness: 3, motivation: 3 }
    const lowStress = calculateReadinessScore({ ...base, stress: 1 })
    const highStress = calculateReadinessScore({ ...base, stress: 5 })
    expect(highStress).toBeLessThan(lowStress)
    expect(lowStress).toBe(63)
    expect(highStress).toBe(38)
  })

  it('raises the score as soreness/motivation/sleep quality rise (positive polarity)', () => {
    const base = { stress: 1, motivation: 3, sleepQuality: 3 }
    const lowSoreness = calculateReadinessScore({ ...base, soreness: 1 })
    const highSoreness = calculateReadinessScore({ ...base, soreness: 5 })
    expect(highSoreness).toBeGreaterThan(lowSoreness)
  })

  it('rounds a fractional average to the nearest integer', () => {
    expect(calculateReadinessScore({ sleepQuality: null, soreness: 2, stress: 2, motivation: 2 })).toBe(42)
  })

  it('throws a RangeError for an out-of-range or non-integer factor', () => {
    const valid = { sleepQuality: 3, soreness: 3, stress: 3, motivation: 3 }
    expect(() => calculateReadinessScore({ ...valid, soreness: 0 })).toThrow(RangeError)
    expect(() => calculateReadinessScore({ ...valid, soreness: 6 })).toThrow(RangeError)
    expect(() => calculateReadinessScore({ ...valid, stress: 2.5 })).toThrow(RangeError)
    expect(() => calculateReadinessScore({ ...valid, motivation: 0 })).toThrow(RangeError)
    expect(() => calculateReadinessScore({ ...valid, sleepQuality: 0 })).toThrow(RangeError)
    expect(() => calculateReadinessScore({ ...valid, sleepQuality: 2.5 })).toThrow(RangeError)
  })
})

describe('todayDateString / daysAgoDateString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats today as yyyy-mm-dd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T15:00:00Z'))
    expect(todayDateString()).toBe('2026-07-28')
  })

  it('offsets by the given number of days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T15:00:00Z'))
    expect(daysAgoDateString(30)).toBe('2026-06-28')
    expect(daysAgoDateString(0)).toBe('2026-07-28')
  })
})

describe('sparklinePoints', () => {
  const opts = { width: 100, height: 40, padding: 4 }

  it('returns an empty string for an empty array', () => {
    expect(sparklinePoints([], opts)).toBe('')
  })

  it('returns an empty string when every value is null', () => {
    expect(sparklinePoints([null, null, null], opts)).toBe('')
  })

  it('returns a flat centered line for a single value', () => {
    expect(sparklinePoints([5], opts)).toBe('4,20 96,20')
  })

  it('avoids divide-by-zero for constant values', () => {
    expect(sparklinePoints([3, 3, 3], opts)).toBe('4,20 50,20 96,20')
  })

  it('skips null gaps instead of interpolating or zeroing them', () => {
    expect(sparklinePoints([1, null, 5], opts)).toBe('4,36 96,4')
  })
})
