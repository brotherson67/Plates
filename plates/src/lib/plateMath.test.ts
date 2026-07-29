import { describe, it, expect } from 'vitest'
import { calculatePlateBreakdown, roundToAchievableWeight, generateWarmupSets } from './plateMath'

describe('calculatePlateBreakdown', () => {
  it('breaks down an exact lb target into plates (225 = 2x45/side)', () => {
    const result = calculatePlateBreakdown(225, 'lb')
    expect(result).toEqual({
      barWeight: 45,
      perSide: [{ weight: 45, count: 2 }],
      totalWeight: 225,
      achievable: true,
      remainderPerSide: 0,
    })
  })

  it('breaks down an exact lb target using mixed denominations (185 = 45+25/side)', () => {
    const result = calculatePlateBreakdown(185, 'lb')
    expect(result.perSide).toEqual([
      { weight: 45, count: 1 },
      { weight: 25, count: 1 },
    ])
    expect(result.achievable).toBe(true)
    expect(result.totalWeight).toBe(185)
  })

  it('breaks down an exact kg target (100 = 2x20/side)', () => {
    const result = calculatePlateBreakdown(100, 'kg')
    expect(result.perSide).toEqual([{ weight: 20, count: 2 }])
    expect(result.achievable).toBe(true)
    expect(result.totalWeight).toBe(100)
  })

  it('reports an unachievable target with the correct leftover per side', () => {
    const result = calculatePlateBreakdown(101, 'lb')
    expect(result.achievable).toBe(false)
    expect(result.remainderPerSide).toBe(0.5)
    expect(result.totalWeight).toBe(100)
  })

  it('handles the bar-only case (target == bar weight)', () => {
    const result = calculatePlateBreakdown(45, 'lb')
    expect(result).toEqual({
      barWeight: 45,
      perSide: [],
      totalWeight: 45,
      achievable: true,
      remainderPerSide: 0,
    })
  })

  it('clamps a target below bar weight to the bar, marked unachievable', () => {
    const result = calculatePlateBreakdown(30, 'lb')
    expect(result.perSide).toEqual([])
    expect(result.totalWeight).toBe(45)
    expect(result.achievable).toBe(false)
  })
})

describe('roundToAchievableWeight', () => {
  it('leaves an already-achievable weight unchanged', () => {
    expect(roundToAchievableWeight(225, 'lb')).toBe(225)
  })

  it('rounds an unachievable weight down to the nearest platable value', () => {
    expect(roundToAchievableWeight(101, 'lb')).toBe(100)
  })

  it('clamps a weight below the bar up to the bar weight', () => {
    expect(roundToAchievableWeight(30, 'lb')).toBe(45)
  })
})

describe('generateWarmupSets', () => {
  it('produces a deduplicated, platable, ascending ramp ending at the working set', () => {
    const sets = generateWarmupSets(225, 5, 'lb')
    expect(sets).toEqual([
      { weight: 90, reps: 5, isWorkingSet: false },
      { weight: 135, reps: 3, isWorkingSet: false },
      { weight: 180, reps: 2, isWorkingSet: false },
      { weight: 200, reps: 1, isWorkingSet: false },
      { weight: 225, reps: 5, isWorkingSet: true },
    ])
    const weights = sets.map((s) => s.weight)
    expect(weights).toEqual([...weights].sort((a, b) => a - b))
  })

  it('collapses to just the working set for a very light working weight', () => {
    const sets = generateWarmupSets(45, 5, 'lb')
    expect(sets).toEqual([{ weight: 45, reps: 5, isWorkingSet: true }])
  })
})
