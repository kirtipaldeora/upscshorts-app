export interface StreakDay {
  n?: number
  mains?: number
  learned?: string[]
  arcade?: {
    attempts?: number
  }
}

export interface StreakSummary {
  current: number
  longest: number
  last: string
  completedDates: string[]
}

function fromDateKey(key: string) {
  return new Date(`${key}T12:00:00`)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(key: string, amount: number) {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

export function completesDailyActivity(day: StreakDay | undefined, target: number) {
  if (!day) return false
  return (day.n ?? 0) >= Math.max(1, target)
    || (day.mains ?? 0) >= 1
    || (day.learned?.length ?? 0) >= 1
    || (day.arcade?.attempts ?? 0) >= 5
}

export function calculateStreak(
  days: Record<string, StreakDay>,
  target: number,
  today: string,
): StreakSummary {
  const completedDates = Object.keys(days)
    .filter(key => completesDailyActivity(days[key], target))
    .sort()
  const complete = new Set(completedDates)

  let longest = 0
  let run = 0
  let previous = ''
  for (const key of completedDates) {
    run = previous && shiftDate(previous, 1) === key ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = key
  }

  const currentEnd = complete.has(today)
    ? today
    : complete.has(shiftDate(today, -1))
      ? shiftDate(today, -1)
      : ''
  let current = 0
  if (currentEnd) {
    let cursor = currentEnd
    while (complete.has(cursor)) {
      current++
      cursor = shiftDate(cursor, -1)
    }
  }

  return {
    current,
    longest,
    last: completedDates[completedDates.length - 1] ?? '',
    completedDates,
  }
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const
