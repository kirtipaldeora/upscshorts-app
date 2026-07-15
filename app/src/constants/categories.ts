import type { Category } from '@/types/article'

// Category color map (matches original CC constant)
export const CATEGORY_COLORS: Record<Category, string> = {
  'Polity': '#F0A3A3',
  'Economy': '#E8C48C',
  'International Relations': '#9DBCE8',
  'Environment': '#96D4AC',
  'Science and Tech': '#C4ABE8',
  'Governance': '#EBA8CF',
  'Social Issues': '#F0BA96',
  'Security': '#E89A9A',
  'Ethics': '#93D6CE',
  'Schemes': '#A9B4EC',
  'Reports and Indices': '#92CBD8',
}

// Category icon map (Font Awesome icon names, matches original CI constant)
export const CATEGORY_ICONS: Record<Category, string> = {
  'Polity': 'fa-landmark',
  'Economy': 'fa-chart-line',
  'International Relations': 'fa-globe',
  'Environment': 'fa-leaf',
  'Science and Tech': 'fa-flask',
  'Governance': 'fa-building-columns',
  'Social Issues': 'fa-people-group',
  'Security': 'fa-shield-halved',
  'Ethics': 'fa-scale-balanced',
  'Schemes': 'fa-hand-holding-heart',
  'Reports and Indices': 'fa-chart-bar',
}

export const CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[]

// Date helpers
export const toDateStr = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export const fmtShort = (d: string): string =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const fmtFull = (d: string): string =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const dayName = (d: string): string =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })

export const TODAY = toDateStr(new Date())
export const YESTERDAY = toDateStr(new Date(Date.now() - 864e5))
export const DAY_BEFORE = toDateStr(new Date(Date.now() - 1728e5))
