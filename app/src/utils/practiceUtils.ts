import type { Article } from '@/types/article'
import type { PyqItem } from '@/stores/usePracticeStore'
import type { PyqDifficulty, PyqFormat, PyqSolution } from '@/types/pyq'
import { getReadingLanguage, type ReadingLanguage } from '@/hooks/useReadingLanguage'
import { getArticleCopy, getPrelimQuestionCopy } from '@/utils/articleLocalization'

export const CURRENT_AFFAIRS_MCQ_START = '2026-07-15'

// ─── Unified question shape ───────────────────────────────────
export interface QuestionCopy {
  q: string
  options: string[]
  explanation: string
  ref?: string
  srcLabel: string
}

export interface Question {
  id: string
  src: 'article' | 'pyq'
  aid?: string
  subject: string
  q: string
  options: string[]
  answer: number
  explanation: string
  ref?: string
  srcLabel: string
  copies?: { en: QuestionCopy; hi?: QuestionCopy }
  pyq?: {
    year: number
    qno: number
    topic: string
    tags: string[]
    format: PyqFormat
    difficulty: PyqDifficulty
    solution: PyqSolution
  }
}

export interface MainsQuestion {
  id: string
  q: string
  subject: string
  srcLabel: string
  keyPoints?: string[]
}

// ─── Build article question pool ──────────────────────────────
export function articleQs(articles: Article[], language: ReadingLanguage = getReadingLanguage()): Question[] {
  const out: Question[] = []
  articles.forEach(a => {
    if (a.date < CURRENT_AFFAIRS_MCQ_START) return
    ;(a.prelimsQs ?? []).forEach((q, i) => {
      const englishQuestion = getPrelimQuestionCopy(q, 'en')
      const hindiQuestion = getPrelimQuestionCopy(q, 'hi')
      const englishArticle = getArticleCopy(a, 'en')
      const hindiArticle = getArticleCopy(a, 'hi')
      const en: QuestionCopy = {
        q: englishQuestion.q,
        options: englishQuestion.options,
        explanation: englishQuestion.explanation,
        ref: englishQuestion.ref,
        srcLabel: englishArticle.headline,
      }
      const hi: QuestionCopy | undefined = hindiQuestion !== q ? {
        q: hindiQuestion.q,
        options: hindiQuestion.options,
        explanation: hindiQuestion.explanation,
        ref: hindiQuestion.ref,
        srcLabel: hindiArticle.headline,
      } : undefined
      const localized = language === 'hi' && hi ? hi : en
      out.push({
        id: `${a.id}-q${i + 1}`,
        src: 'article',
        aid: a.id,
        subject: a.category,
        q: localized.q,
        options: localized.options,
        answer: q.answer,
        explanation: localized.explanation,
        ref: localized.ref,
        srcLabel: localized.srcLabel,
        copies: { en, hi },
      })
    })
  })
  return out
}

// ─── PYQ prelims pool ─────────────────────────────────────────
export function pyqPrelims(pyq: PyqItem[]): Question[] {
  return pyq
    .filter(p => p.exam === 'prelims' && p.options && p.answer !== undefined)
    .map(p => ({
      id: `pyq-${p.id}`,
      src: 'pyq' as const,
      subject: p.subject,
      q: p.question,
      options: p.options!,
      answer: p.answer!,
      explanation: p.explanation ?? '',
      srcLabel: `UPSC Prelims ${p.year}`,
    }))
}

// ─── Combined pool ────────────────────────────────────────────
export function allQs(articles: Article[], pyq: PyqItem[], language: ReadingLanguage = getReadingLanguage()): Question[] {
  return articleQs(articles, language).concat(pyqPrelims(pyq))
}

// ─── Mains pool ───────────────────────────────────────────────
export function mainsPool(articles: Article[], pyq: PyqItem[]): MainsQuestion[] {
  const out: MainsQuestion[] = []
  articles.forEach(a => {
    const mq = a.deepDive?.possibleMainsQuestion
    if (mq) {
      out.push({
        id: `ma-${a.id}`,
        q: mq.replace(/^[""""]|[""""]$/g, ''),
        subject: a.category,
        srcLabel: a.headline,
      })
    }
  })
  pyq.filter(p => p.exam === 'mains').forEach(p => {
    out.push({
      id: `mp-${p.id}`,
      q: p.question,
      subject: p.subject,
      srcLabel: `UPSC Mains ${p.year} · ${p.paper ?? ''}`,
      keyPoints: p.keyPoints,
    })
  })
  return out
}

// ─── Seeded shuffle & pick ────────────────────────────────────
export function seededPick<T>(arr: T[], n: number, seed: string): T[] {
  let h = 0
  for (const c of seed) h = ((h * 31 + c.charCodeAt(0)) >>> 0)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    h = ((h * 1103515245 + 12345) >>> 0)
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

// ─── Daily set ───────────────────────────────────────────────
export function dailySet(articles: Article[], pyq: PyqItem[], target: number, today: string, language: ReadingLanguage = getReadingLanguage()): Question[] {
  const pool = allQs(articles, pyq, language)
  return seededPick(pool, Math.min(target, pool.length), `penni-${today}`)
}

// ─── Bookmark practice set ───────────────────────────────────
export function bookmarkPracticeSet(
  articles: Article[],
  bookmarkedArticleIds: string[],
  questionBookmarks: string[],
  pyq: PyqItem[],
): Question[] {
  const fromArts = articleQs(articles).filter(q => bookmarkedArticleIds.includes(q.aid ?? ''))
  const direct = allQs(articles, pyq).filter(q => questionBookmarks.includes(q.id))
  const seen = new Set<string>()
  const out: Question[] = []
  fromArts.concat(direct).forEach(q => {
    if (!seen.has(q.id)) { seen.add(q.id); out.push(q) }
  })
  return out
}

// ─── Get subject counts ───────────────────────────────────────
export function subjectCounts(questions: Question[]): Record<string, number> {
  const subs: Record<string, number> = {}
  questions.forEach(q => { subs[q.subject] = (subs[q.subject] ?? 0) + 1 })
  return subs
}
