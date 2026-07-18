const SYNODIC_MONTH_DAYS = 29.530588853
const DAY_MS = 86_400_000
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14)

const PHASE_NAMES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const

export interface LunarPhase {
  index: number
  name: (typeof PHASE_NAMES)[number]
  illumination: number
  apparentScale: number
}

export function getLunarPhase(date = new Date()): LunarPhase {
  // Local noon keeps the phase stable for the user's whole calendar day.
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  const elapsedDays = (localNoon.getTime() - NEW_MOON_EPOCH_MS) / DAY_MS
  const fraction = ((elapsedDays / SYNODIC_MONTH_DAYS) % 1 + 1) % 1
  const illumination = (1 - Math.cos(fraction * Math.PI * 2)) / 2
  const index = Math.round(fraction * 8) % 8

  return {
    index,
    name: PHASE_NAMES[index],
    illumination,
    apparentScale: 0.9 + illumination * 0.1,
  }
}
