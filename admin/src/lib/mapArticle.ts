import type {
  Article,
  Category,
  DeepDive,
  DeepDiveHindi,
  GeoLocation,
  GsPaper,
  PrelimQuestion,
} from '@penni/types/article'

/**
 * The row <-> Article boundary.
 *
 * Everything the CMS publishes goes through toArticle(), so this file is the
 * single place where a mistake could produce JSON that Penni can't parse. Keep
 * it total: never emit undefined for a field Penni treats as required, and
 * never let a malformed jsonb column throw at publish time.
 */

export interface ArticleRow {
  id: string
  date: string
  headline: string
  source: string
  category: string
  gs_paper: string
  summary: string
  why_it_matters: string
  hindi: unknown
  deep_dive: unknown
  audio_script: string | null
  audio_script_hi: string | null
  prelims_qs: unknown
  key_terms: string[] | null
  location: unknown
  status: 'draft' | 'published'
  sort_order: number
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export const CATEGORIES: Category[] = [
  'Polity',
  'Economy',
  'International Relations',
  'Environment',
  'Science and Tech',
  'Governance',
  'Social Issues',
  'Security',
  'Ethics',
  'Schemes',
  'Reports and Indices',
]

export const GS_PAPERS: GsPaper[] = ['GS 1', 'GS 2', 'GS 3', 'GS 4']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
    : []
}

function toConcepts(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const concept = asRecord(item)
        const term = asString(concept.term).trim()
        const definition = asString(concept.definition).trim()
        return term && definition ? [{ term, definition }] : []
      })
    : []
}

function toHindiDeepDive(value: unknown): DeepDiveHindi | undefined {
  const raw = asRecord(value)
  const hindi: DeepDiveHindi = {
    syllabusLinkage: asString(raw.syllabusLinkage).trim(),
    context: asString(raw.context).trim(),
    keyHighlights: toStringList(raw.keyHighlights),
    keyConcepts: toConcepts(raw.keyConcepts),
    wayForward: toStringList(raw.wayForward),
    possibleMainsQuestion: asString(raw.possibleMainsQuestion).trim(),
  }
  const hasContent = hindi.syllabusLinkage || hindi.context || hindi.keyHighlights.length ||
    hindi.keyConcepts.length || hindi.wayForward.length || hindi.possibleMainsQuestion
  return hasContent ? hindi : undefined
}

function toHindiArticle(value: unknown): Article['hindi'] | undefined {
  const raw = asRecord(value)
  const hindi = {
    headline: asString(raw.headline).trim(),
    summary: asString(raw.summary).trim(),
    whyItMatters: asString(raw.whyItMatters).trim(),
  }
  return hindi.headline || hindi.summary || hindi.whyItMatters ? hindi : undefined
}

function toDeepDive(value: unknown): DeepDive {
  const raw = asRecord(value)
  const keyHighlights = toStringList(raw.keyHighlights)
  const wayForward = toStringList(raw.wayForward)
  const keyConcepts = toConcepts(raw.keyConcepts)
  const hindi = toHindiDeepDive(raw.hindi)
  return {
    explanation: asString(raw.explanation),
    possibleMainsQuestion: asString(raw.possibleMainsQuestion),
    ...(typeof raw.syllabusLinkage === 'string' && raw.syllabusLinkage.trim() ? { syllabusLinkage: raw.syllabusLinkage.trim() } : {}),
    ...(typeof raw.context === 'string' && raw.context.trim() ? { context: raw.context.trim() } : {}),
    ...(keyHighlights.length ? { keyHighlights } : {}),
    ...(keyConcepts.length ? { keyConcepts } : {}),
    ...(wayForward.length ? { wayForward } : {}),
    ...(hindi ? { hindi } : {}),
  }
}

/** Drops anything that isn't a well-formed question rather than shipping a broken one. */
function toPrelimsQs(value: unknown): PrelimQuestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): PrelimQuestion[] => {
    const raw = asRecord(entry)
    const options = Array.isArray(raw.options) ? raw.options.filter((o): o is string => typeof o === 'string') : []
    const answer = typeof raw.answer === 'number' ? raw.answer : -1
    const q = asString(raw.q)
    if (!q || options.length < 2 || answer < 0 || answer >= options.length) return []
    const rawHindi = asRecord(raw.hindi)
    const hindiOptions = Array.isArray(rawHindi.options)
      ? rawHindi.options.filter((option): option is string => typeof option === 'string')
      : []
    const hindiQuestion = asString(rawHindi.q).trim()
    const hindi = hindiQuestion && hindiOptions.length === options.length
      ? {
          q: hindiQuestion,
          options: hindiOptions,
          explanation: asString(rawHindi.explanation),
          ...(typeof rawHindi.ref === 'string' && rawHindi.ref ? { ref: rawHindi.ref } : {}),
        }
      : undefined
    return [{
      q,
      options,
      answer,
      explanation: asString(raw.explanation),
      ...(typeof raw.ref === 'string' && raw.ref ? { ref: raw.ref } : {}),
      ...(hindi ? { hindi } : {}),
    }]
  })
}

function toLocation(value: unknown): GeoLocation | undefined {
  const raw = asRecord(value)
  const { lat, lon, place } = raw
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined
  return { lat, lon, place: asString(place) }
}

/** Row -> the exact object Penni's feed expects. */
export function toArticle(row: ArticleRow): Article {
  const prelimsQs = toPrelimsQs(row.prelims_qs)
  const keyTerms = (row.key_terms ?? []).filter(Boolean)
  const location = toLocation(row.location)
  const hindi = toHindiArticle(row.hindi)
  return {
    id: row.id,
    headline: row.headline,
    date: row.date,
    source: row.source,
    category: (CATEGORIES.includes(row.category as Category) ? row.category : 'Polity') as Category,
    gsPaper: (GS_PAPERS.includes(row.gs_paper as GsPaper) ? row.gs_paper : 'GS 2') as GsPaper,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    ...(hindi ? { hindi } : {}),
    deepDive: toDeepDive(row.deep_dive),
    // Optional fields are omitted rather than set to null: Penni checks
    // `article.audioScript?.trim()`, and null would read as present-but-empty.
    ...(row.audio_script ? { audioScript: row.audio_script } : {}),
    ...(row.audio_script_hi ? { audioScriptHi: row.audio_script_hi } : {}),
    ...(prelimsQs.length ? { prelimsQs } : {}),
    ...(keyTerms.length ? { keyTerms } : {}),
    ...(location ? { location } : {}),
  }
}

/** Article -> row, for importing pipeline output or saving the editor form. */
export function toRow(article: Article, status: 'draft' | 'published' = 'draft', sortOrder = 0): ArticleRow {
  return {
    id: article.id,
    date: article.date,
    headline: article.headline,
    source: article.source,
    category: article.category,
    gs_paper: article.gsPaper,
    summary: article.summary,
    why_it_matters: article.whyItMatters,
    hindi: article.hindi ?? {},
    deep_dive: article.deepDive ?? { explanation: '', possibleMainsQuestion: '' },
    audio_script: article.audioScript ?? null,
    audio_script_hi: article.audioScriptHi ?? null,
    prelims_qs: article.prelimsQs ?? [],
    key_terms: article.keyTerms ?? [],
    location: article.location ?? null,
    status,
    sort_order: sortOrder,
  }
}

/** A blank row for the "new article" form. */
export function emptyRow(date: string): ArticleRow {
  return {
    id: `${date}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    headline: '',
    source: '',
    category: 'Polity',
    gs_paper: 'GS 2',
    summary: '',
    why_it_matters: '',
    hindi: {
      headline: '',
      summary: '',
      whyItMatters: '',
    },
    deep_dive: {
      syllabusLinkage: '',
      context: '',
      keyHighlights: [],
      keyConcepts: [],
      wayForward: [],
      explanation: '',
      possibleMainsQuestion: '',
      hindi: {
        syllabusLinkage: '',
        context: '',
        keyHighlights: [],
        keyConcepts: [],
        wayForward: [],
        possibleMainsQuestion: '',
      },
    },
    audio_script: null,
    audio_script_hi: null,
    prelims_qs: [],
    key_terms: [],
    location: null,
    status: 'draft',
    sort_order: 0,
  }
}
