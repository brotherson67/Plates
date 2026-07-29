import type { WeightUnit } from './workout'

// Fixed standard-gym inventory (unlimited pairs assumed). Not
// user-configurable in this MVP - see DESIGN.md-adjacent plan notes.
const BAR_WEIGHT: Record<WeightUnit, number> = { lb: 45, kg: 20 }
const PLATE_DENOMINATIONS: Record<WeightUnit, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [20, 15, 10, 5, 2.5, 1.25],
}

// Denominations are in increments of 0.25 units at the finest (2.5/1.25),
// so scaling by 100 and rounding keeps every intermediate value an exact
// integer - avoids floating-point drift (e.g. repeated 2.5 subtraction)
// when computing how much of the per-side target has been made up.
const SCALE = 100

export interface PlateBreakdown {
  barWeight: number
  perSide: Array<{ weight: number; count: number }>
  totalWeight: number
  achievable: boolean
  remainderPerSide: number
}

export function calculatePlateBreakdown(targetWeight: number, unit: WeightUnit): PlateBreakdown {
  const barWeight = BAR_WEIGHT[unit]

  if (targetWeight <= barWeight) {
    return {
      barWeight,
      perSide: [],
      totalWeight: barWeight,
      achievable: targetWeight === barWeight,
      remainderPerSide: 0,
    }
  }

  const perSideTargetScaled = Math.round(((targetWeight - barWeight) / 2) * SCALE)
  let remaining = perSideTargetScaled
  const perSide: Array<{ weight: number; count: number }> = []

  for (const denom of PLATE_DENOMINATIONS[unit]) {
    const denomScaled = Math.round(denom * SCALE)
    const count = Math.floor(remaining / denomScaled)
    if (count > 0) {
      perSide.push({ weight: denom, count })
      remaining -= count * denomScaled
    }
  }

  const remainderPerSide = remaining / SCALE
  const achievable = remaining === 0
  const totalWeight = barWeight + 2 * ((perSideTargetScaled - remaining) / SCALE)

  return { barWeight, perSide, totalWeight, achievable, remainderPerSide }
}

// Rounds down to the nearest weight actually loadable with this inventory.
export function roundToAchievableWeight(targetWeight: number, unit: WeightUnit): number {
  return calculatePlateBreakdown(targetWeight, unit).totalWeight
}

export interface WarmupSet {
  weight: number
  reps: number
  isWorkingSet: boolean
}

// Fixed default ramp (not user-configurable this round): ascending
// percentage-of-working-weight steps with descending reps, ending at the
// working set. Steps that round below the bar, or that round to the same
// weight as the previous step, are dropped - keeps the ramp sane for very
// light working weights instead of showing duplicate/sub-bar steps.
const RAMP_STEPS: Array<{ pct: number; reps: number }> = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
  { pct: 0.9, reps: 1 },
]

export function generateWarmupSets(workingWeight: number, workingReps: number, unit: WeightUnit): WarmupSet[] {
  const barWeight = BAR_WEIGHT[unit]
  const workingSetWeight = roundToAchievableWeight(workingWeight, unit)
  const sets: WarmupSet[] = []
  let lastWeight: number | null = null

  for (const step of RAMP_STEPS) {
    const weight = roundToAchievableWeight(workingWeight * step.pct, unit)
    if (weight < barWeight) continue
    if (weight === lastWeight) continue
    if (weight === workingSetWeight) continue
    sets.push({ weight, reps: step.reps, isWorkingSet: false })
    lastWeight = weight
  }

  sets.push({ weight: workingSetWeight, reps: workingReps, isWorkingSet: true })
  return sets
}
