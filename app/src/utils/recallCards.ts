import type { Article, PrelimQuestion } from '@/types/article'
import { splitUPSCStem } from '@/utils/questionQuality'

export type RecallPromptKind = 'news' | 'trap' | 'static'

export interface RecallPrompt {
  id: string
  kind: RecallPromptKind
  statement: string
  verdict: boolean
  rationale: string
  sourceQuestionId?: string
}

export interface RecallCard {
  id: string
  article: Article
  prompts: RecallPrompt[]
}

type ParsedPrompt = Omit<RecallPrompt, 'id'>

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function normaliseStatement(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[.;:]$/, '').trim()
}

function explanationSentences(value: string) {
  return value.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean)
}

function sentenceMentionsLabel(sentence: string, label: string) {
  const singular = new RegExp(`\\b(?:Statement|Pair)\\s+${label}\\b`, 'i')
  const grouped = new RegExp(`\\b(?:Statements|Pairs)\\s+[^.]{0,45}\\b${label}\\b`, 'i')
  const onlyGroup = new RegExp(`\\b(?:Only\\s+)?[^.]{0,20}\\b${label}\\b[^.]{0,35}\\b(?:correct|incorrect|matched)\\b`, 'i')
  return singular.test(sentence) || grouped.test(sentence) || onlyGroup.test(sentence)
}

function verdictForLabel(explanation: string, label: string): boolean | null {
  const sentences = explanationSentences(explanation).filter(sentence => sentenceMentionsLabel(sentence, label))
  const singular = `(?:Statement|Pair)\\s+${label}`
  const negative = new RegExp(`\\b${singular}\\b[^.]{0,45}\\b(?:incorrect(?:ly matched)?|not correct|false|wrong)\\b`, 'i')
  const positive = new RegExp(`\\b${singular}\\b[^.]{0,45}\\b(?:correct(?:ly matched)?|true|reflects|accurately)\\b`, 'i')

  for (const sentence of sentences) {
    if (negative.test(sentence)) return false
    if (positive.test(sentence)) return true
  }

  for (const sentence of sentences) {
    if (/\b(?:incorrect|not correct|false|wrong)\b/i.test(sentence)) return false
    if (/\b(?:correct|correctly matched)\b/i.test(sentence)) return true
  }

  return null
}

function rationaleForLabel(question: PrelimQuestion, label: string) {
  const sentences = explanationSentences(question.explanation)
  const labelled = sentences.filter(sentence => new RegExp(`\\b(?:Statement|Pair)\\s+${label}\\b`, 'i').test(sentence))
  const useful = labelled.find(sentence => sentence.split(/\s+/).length >= 9) ?? labelled[0]
  return useful ?? sentences.find(sentence => sentenceMentionsLabel(sentence, label)) ?? ''
}

function parseQuestionPrompts(question: PrelimQuestion, sourceIndex: number, articleId: string): ParsedPrompt[] {
  const structured = splitUPSCStem(question.q)
  return structured.statements.flatMap((rawStatement, index) => {
    const label = structured.statementLabels[index] ?? String(index + 1)
    const statement = normaliseStatement(rawStatement)
    const verdict = verdictForLabel(question.explanation, label)
    const rationale = rationaleForLabel(question, label)
    if (!statement || verdict === null || !rationale) return []
    return [{
      kind: sourceIndex === 0 ? (verdict ? 'news' : 'trap') : 'static',
      statement,
      verdict,
      rationale,
      sourceQuestionId: `${articleId}-q${sourceIndex + 1}`,
    }]
  })
}

function conceptFallback(article: Article, verdict: boolean): ParsedPrompt | null {
  const concepts = article.deepDive.keyConcepts ?? []
  if (!concepts.length) return null
  const primary = concepts[0]
  if (verdict) {
    return {
      kind: 'static',
      statement: `${primary.term}: ${primary.definition}`,
      verdict: true,
      rationale: primary.definition,
    }
  }
  const alternate = concepts.find(concept => concept.term !== primary.term)
  if (!alternate) return null
  return {
    kind: 'trap',
    statement: `${primary.term}: ${alternate.definition}`,
    verdict: false,
    rationale: `This description belongs to ${alternate.term}. ${primary.definition}`,
  }
}

function choosePrompts(article: Article): ParsedPrompt[] {
  const questionSets = (article.prelimsQs ?? []).slice(0, 2).map((question, index) =>
    parseQuestionPrompts(question, index, article.id))
  const news = questionSets[0] ?? []
  const staticPrompts = questionSets[1] ?? []
  const selected: ParsedPrompt[] = []

  const add = (prompt?: ParsedPrompt) => {
    if (!prompt || selected.some(item => normaliseStatement(item.statement).toLowerCase() === normaliseStatement(prompt.statement).toLowerCase())) return
    selected.push(prompt)
  }

  add(news.find(prompt => prompt.verdict))
  add(news.find(prompt => !prompt.verdict))
  add(staticPrompts.find(prompt => prompt.verdict !== selected[0]?.verdict) ?? staticPrompts[0])
  ;[...news, ...staticPrompts].forEach(prompt => { if (selected.length < 3) add(prompt) })

  while (selected.length < 3) {
    const neededVerdict = !selected.some(prompt => prompt.verdict)
    const fallback = conceptFallback(article, neededVerdict)
    if (!fallback || selected.some(prompt => prompt.statement === fallback.statement)) break
    add(fallback)
  }

  if (selected.length >= 3 && selected.every(prompt => prompt.verdict === selected[0].verdict)) {
    const fallback = conceptFallback(article, !selected[0].verdict)
    if (fallback) selected[2] = fallback
  }

  return selected.slice(0, 3)
}

export function buildRecallCards(articles: Article[]): RecallCard[] {
  return articles.flatMap(article => {
    const prompts = choosePrompts(article)
    if (prompts.length < 3 || !prompts.some(prompt => prompt.verdict) || !prompts.some(prompt => !prompt.verdict)) return []
    return [{
      id: `recall-article:${article.id}`,
      article,
      prompts: prompts.map(prompt => ({
        ...prompt,
        id: `${article.id}:${prompt.kind}:${stableHash(prompt.statement)}`,
      })),
    }]
  })
}
