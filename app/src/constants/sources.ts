// News source registry: powers the per-source feed toggles and maps each
// article's free-form `source` string onto a toggleable source key.

export type SourceKey = 'hindu' | 'ie' | 'pib' | 'prs' | 'airdd'

export interface NewsSource {
  key: SourceKey
  label: string
  match: RegExp
}

export const NEWS_SOURCES: NewsSource[] = [
  { key: 'hindu', label: 'The Hindu', match: /\bhindu\b/i },
  { key: 'ie', label: 'Indian Express', match: /indian express|\bie\b/i },
  { key: 'pib', label: 'PIB', match: /\bpib\b|press information bureau/i },
  { key: 'prs', label: 'PRS India', match: /\bprs\b/i },
  { key: 'airdd', label: 'AIR / DD News', match: /\bair\b|\bdd\b|akashvani|doordarshan|news ?on ?air/i },
]

export type SourceFilter = Record<SourceKey, boolean>

export const DEFAULT_SOURCE_FILTER: SourceFilter = {
  hindu: true,
  ie: true,
  pib: true,
  prs: true,
  airdd: true,
}

// Which toggle keys does an article's source string belong to?
// Combined bylines ("The Hindu / Indian Express") map to several keys.
export function sourceKeysFor(source: string): SourceKey[] {
  return NEWS_SOURCES.filter(s => s.match.test(source)).map(s => s.key)
}

// An article stays visible if ANY of its mapped sources is enabled.
// Articles from unrecognized sources are never hidden.
export function isSourceVisible(source: string, filter: SourceFilter): boolean {
  const keys = sourceKeysFor(source)
  if (keys.length === 0) return true
  return keys.some(k => filter[k])
}

export function loadSourceFilter(): SourceFilter {
  try {
    const raw = localStorage.getItem('u4src')
    if (raw) return { ...DEFAULT_SOURCE_FILTER, ...JSON.parse(raw) }
  } catch { /* fall through to defaults */ }
  return { ...DEFAULT_SOURCE_FILTER }
}

export function saveSourceFilter(filter: SourceFilter) {
  try { localStorage.setItem('u4src', JSON.stringify(filter)) } catch { /* noop */ }
}
