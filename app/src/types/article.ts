// ─── Prelims Question ─────────────────────────────────────────
export interface PrelimQuestion {
  q: string
  options: string[]
  answer: number  // 0-indexed correct option
  explanation: string
  ref?: string
}

// ─── DeepDive ────────────────────────────────────────────────
export interface DeepDive {
  explanation: string          // HTML string (contains <strong> tags)
  possibleMainsQuestion: string
}

// ─── Article ─────────────────────────────────────────────────
export type GsPaper = 'GS 1' | 'GS 2' | 'GS 3' | 'GS 4'

export type Category =
  | 'Polity'
  | 'Economy'
  | 'International Relations'
  | 'Environment'
  | 'Science and Tech'
  | 'Governance'
  | 'Social Issues'
  | 'Security'
  | 'Ethics'
  | 'Schemes'
  | 'Reports and Indices'

export interface Article {
  id: string
  headline: string
  date: string             // ISO date string YYYY-MM-DD
  source: string
  category: Category
  gsPaper: GsPaper
  summary: string
  whyItMatters: string
  deepDive: DeepDive
  prelimsQs?: PrelimQuestion[]   // Penni: article-level MCQ practice questions
  keyTerms?: string[]            // Optional glossary metadata from article imports
}

// ─── Data shape returned by per-date JSON files ───────────────
export type ArticlesByDate = Record<string, Article[]>

// ─── Source preference ───────────────────────────────────────
export interface GSFilter {
  'GS 1': boolean
  'GS 2': boolean
  'GS 3': boolean
  'GS 4': boolean
}
