import type { PyqManifest, PyqQuestion } from '@/types/pyq'
import type { Question } from '@/utils/practiceUtils'
import { asset } from '@/utils/asset'
import { getPyqSubtopic } from '@/utils/pyqTaxonomy'

let manifestPromise: Promise<PyqManifest> | null = null
const paperCache = new Map<number, Promise<PyqQuestion[]>>()

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(asset(path))
  if (!response.ok) throw new Error(`Unable to load ${path}`)
  return response.json() as Promise<T>
}

export function loadPyqManifest(): Promise<PyqManifest> {
  manifestPromise ??= fetchJson<PyqManifest>('data/pyq/index.json')
  return manifestPromise
}

export function loadPyqYear(year: number): Promise<PyqQuestion[]> {
  const cached = paperCache.get(year)
  if (cached) return cached
  const request = fetchJson<PyqQuestion[]>(`data/pyq/prelims-${year}.json`)
  paperCache.set(year, request)
  return request
}

export async function loadPyqYears(years: number[]): Promise<PyqQuestion[]> {
  const papers = await Promise.all(years.map(loadPyqYear))
  return papers.flat()
}

export function pyqQuestionId(question: Pick<PyqQuestion, 'id'>) {
  return `pyq-${question.id}`
}

export function pyqToPracticeQuestion(question: PyqQuestion): Question {
  return {
    id: pyqQuestionId(question),
    src: 'pyq',
    subject: question.subject,
    q: question.stem,
    options: question.options ?? [],
    answer: question.answer ?? 0,
    explanation: question.solution.detail,
    srcLabel: `UPSC Prelims ${question.year} · Q${question.qno}`,
    pyq: {
      year: question.year,
      qno: question.qno,
      topic: getPyqSubtopic(question),
      tags: question.tags,
      format: question.format,
      difficulty: question.difficulty,
      solution: question.solution,
    },
  }
}
