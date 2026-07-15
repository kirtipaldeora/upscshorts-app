// ─── PYQ Vault ────────────────────────────────────────────────
// Previous-year questions, stored one file per paper and pulled in on demand.
// The question stems, options and answer keys are UPSC's own published exam
// material. Solutions are Penni's, written from the facts each question turns
// on — see scripts/pyq/README.md.

export type PyqExam = 'prelims' | 'mains'

/** Prelims papers are GS Paper I and CSAT; mains splits across GS1-4 + Essay. */
export type PyqPaper = 'GS1' | 'GS2' | 'GS3' | 'GS4' | 'CSAT' | 'Essay'

export type PyqSubject =
  | 'Ancient History'
  | 'Medieval History'
  | 'Modern History'
  | 'Art and Culture'
  | 'Polity'
  | 'Economy'
  | 'Geography'
  | 'Environment'
  | 'Science and Tech'
  | 'International Relations'
  | 'Current Affairs'

export type PyqDifficulty = 'easy' | 'moderate' | 'hard'

/**
 * The shape of the question, which drives both how the stem is rendered and
 * which elimination tricks apply.
 *  - statements: "Consider the following statements: 1. ... 2. ..."
 *  - count:      "How many of the above are correct?" (Only one / Only two / ...)
 *  - assertion:  Statement I + Statement II + Statement III explanation-linkage
 *  - pairs:      "Which of the pairs given above are correctly matched?"
 *  - direct:     plain single-fact recall
 *  - descriptive: mains, no options
 */
export type PyqFormat = 'statements' | 'count' | 'assertion' | 'pairs' | 'direct' | 'descriptive'

/** Per-statement verdict, so the solution can be checked statement by statement. */
export interface PyqStatementNote {
  /** Printed label as it appears in the paper: "1", "2", "I", "II". */
  label: string
  verdict: 'correct' | 'incorrect' | 'partial'
  /** Why it lands that way. */
  text: string
}

/** Why a given option is right or wrong — used for eliminate-the-distractor questions. */
export interface PyqOptionNote {
  /** 0-indexed into `options`. */
  option: number
  text: string
}

export interface PyqSolution {
  /** One-line bottom line: "All three are alternative powertrains." */
  verdict: string
  /** Main teaching body. Plain paragraphs separated by blank lines. */
  detail: string
  /** Statement-by-statement breakdown, for statement/count/assertion formats. */
  statements?: PyqStatementNote[]
  /** Option-by-option notes, for direct/pairs formats. */
  optionNotes?: PyqOptionNote[]
  /** Context that widens the concept beyond this one question. */
  extraEdge?: string
  /** The elimination technique that cracks it without full knowledge. */
  trick?: string
}

export interface PyqQuestion {
  id: string
  exam: PyqExam
  year: number
  paper: PyqPaper
  /** Question number within the paper, for citation and sorting. */
  qno: number
  subject: PyqSubject
  /** Finer than subject: "Biotechnology", "Fundamental Rights". */
  topic: string
  /** Free-form concept tags, used by search and the tag filter. */
  tags: string[]
  format: PyqFormat
  difficulty: PyqDifficulty
  /** Raw stem exactly as printed. Rendering splits it via splitUPSCStem. */
  stem: string
  /** Absent for mains. */
  options?: string[]
  /** 0-indexed correct option. Absent for mains. */
  answer?: number
  solution: PyqSolution
  /** Mains only: the skeleton of a model answer. */
  keyPoints?: string[]
}

// ─── Manifest ─────────────────────────────────────────────────
// index.json is fetched on vault open; paper files are fetched on demand.

export interface PyqPaperMeta {
  /** Matches the data filename stem: "prelims-2025". */
  id: string
  exam: PyqExam
  year: number
  paper: PyqPaper
  /** Path relative to data/pyq/. */
  file: string
  count: number
  /** Question counts per subject, so filters can render before the paper loads. */
  subjects: Partial<Record<PyqSubject, number>>
}

export interface PyqManifest {
  /** Bumped when the schema changes, so stale caches can be dropped. */
  version: number
  generatedAt: string
  papers: PyqPaperMeta[]
  /** Union of every tag across all papers, for the tag filter. */
  tags: string[]
  totals: {
    questions: number
    papers: number
    years: number[]
  }
}
