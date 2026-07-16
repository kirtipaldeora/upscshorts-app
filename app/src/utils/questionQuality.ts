import type { Article, ArticlesByDate, PrelimQuestion } from '@/types/article'

export interface QuestionQualityIssue {
  articleId: string
  headline: string
  field: 'prelims' | 'deepDive' | 'audio'
  question?: string
  reason: string
}

const RECALL_PATTERNS = [
  /\bis\s*:\s*$/i,
  /\bare\s*:\s*$/i,
  /\brefers to\s*:\s*$/i,
  /\bassociated with\s*:\s*$/i,
  /\bderived from\s*:\s*$/i,
  /\bheadquartered at\s*:\s*$/i,
  /\boriginates at\s*:\s*$/i,
  /\bunder which law\??$/i,
  /\bin which case\??$/i,
]

const UPSC_STYLE_PATTERNS = [
  /consider the following statements/i,
  /consider the following pairs/i,
  /with reference to/i,
  /which of the statements/i,
  /which of the following statements/i,
  /correctly matched/i,
  /how many of the above/i,
  /how many of them/i,
  /pairs? given above/i,
  /statement\s+I\s*:/i,
  /which one of the following/i,
  /common characteristic/i,
]

type PrelimsFormat = 'count' | 'combination' | 'reasoning' | 'pairs' | 'one-best'

function statementLabels(stem: string): string[] {
  const dotted = [...stem.matchAll(/(?:^|\s)(I{1,3}|IV|V|[1-5])\.\s+/g)].map(match => match[1].toUpperCase())
  const labelled = [...stem.matchAll(/\bStatement\s+(I{1,3}|IV|V|[1-5])\s*:/gi)].map(match => match[1].toUpperCase())
  return [...new Set([...dotted, ...labelled])]
}

function prelimsFormat(stem: string): PrelimsFormat | null {
  if (/\bStatement\s+I\s*:/i.test(stem) && /\bStatement\s+II\s*:/i.test(stem)) return 'reasoning'
  if (/following pairs|pairs? given above|correctly matched/i.test(stem)) return 'pairs'
  if (/how many of (?:the above|them|the statements|the pairs)/i.test(stem)) return 'count'
  if (/which of the statements|which of the following statements|select the correct answer using the code/i.test(stem)) return 'combination'
  if (/which one of the following|common characteristic|best describes/i.test(stem)) return 'one-best'
  return null
}

function hasCoherentOptions(q: PrelimQuestion, format: PrelimsFormat | null): boolean {
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  const options = q.options.map(option => option.trim())
  if (options.some(option => option.length < 2 || /^\([a-d]\)\s*/i.test(option))) return false
  if (new Set(options.map(option => option.toLowerCase())).size !== 4) return false
  if (format === 'count' || format === 'pairs') {
    return options.every(option => /^(?:only (?:one|two|three|four)|all (?:the )?(?:two|three|four|five)|none)$/i.test(option))
  }
  if (format === 'reasoning') {
    return options.every(option => /statement|neither/i.test(option))
  }
  return true
}

function answerMarksEveryItemCorrect(q: PrelimQuestion, labels: string[], format: PrelimsFormat | null): boolean {
  const selected = q.options[q.answer] ?? ''
  if (format === 'count' || format === 'pairs') return /\ball\b/i.test(selected)
  if (format === 'reasoning') return /both Statement II and Statement III are correct/i.test(selected)
  return labels.length > 0 && labels.every(label => new RegExp(`\\b${label}\\b`, 'i').test(selected))
}

function explanationAssessesItem(explanation: string, label: string): boolean {
  return new RegExp(`\\b${label}\\b`, 'i').test(explanation)
}

export function isLikelyUPSCPrelimsQuestion(q: PrelimQuestion): boolean {
  const stem = q.q.trim()
  const words = stem.split(/\s+/).filter(Boolean).length
  const format = prelimsFormat(stem)
  const hasNumberedStatements = statementLabels(stem).length >= 2
  const hasUpscFrame = UPSC_STYLE_PATTERNS.some(pattern => pattern.test(stem))
  const isRecallStem = RECALL_PATTERNS.some(pattern => pattern.test(stem))
  return Boolean(format) && (hasNumberedStatements || hasUpscFrame) &&
    hasCoherentOptions(q, format) && !isRecallStem && words >= 14
}

export function hasDetailedPrelimsExplanation(q: PrelimQuestion): boolean {
  const explanation = q.explanation.trim()
  const words = explanation.split(/\s+/).filter(Boolean).length
  const labels = statementLabels(q.q)
  const format = prelimsFormat(q.q)
  if (words < 55 || words > 220) return false
  if (labels.length >= 2 && !labels.every(label => explanationAssessesItem(explanation, label))) return false
  if (labels.length >= 2 && !answerMarksEveryItemCorrect(q, labels, format) &&
      !/incorrect|not correct|false|wrong|does not|do not|cannot|misstates|confuses/i.test(explanation)) return false
  return true
}

const DEVANAGARI = /[\u0900-\u097F]/

function numericTokens(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)*/g) ?? []
}

function preservesNumbers(english: string, hindi: string): boolean {
  const left = numericTokens(english).sort()
  const right = numericTokens(hindi).sort()
  return left.length === right.length && left.every((token, index) => token === right[index])
}

function isHindiText(value: string): boolean {
  // U+FFFD is inserted when source bytes could not be decoded. A string may
  // still contain enough Devanagari to pass the language check. Treat encoding
  // damage as an invalid translation so the article safely falls back to English.
  return Boolean(value.trim()) && DEVANAGARI.test(value) && !value.includes('\uFFFD')
}

export function hasVerifiedHindiDeepDive(article: Article): boolean {
  const english = article.deepDive
  const hindi = english.hindi
  if (!hindi || !english.syllabusLinkage || !english.context) return false
  if (typeof hindi.syllabusLinkage !== 'string' || typeof hindi.context !== 'string' ||
      typeof hindi.possibleMainsQuestion !== 'string') return false
  if (!Array.isArray(english.keyHighlights) || !Array.isArray(english.keyConcepts) || !Array.isArray(english.wayForward)) return false
  if (english.keyHighlights.length < 4 || english.keyHighlights.length > 6 ||
      english.keyConcepts.length < 3 || english.keyConcepts.length > 6 ||
      english.wayForward.length < 3 || english.wayForward.length > 6) return false
  if (english.keyHighlights.some(item => typeof item !== 'string' || !item.trim()) ||
      english.wayForward.some(item => typeof item !== 'string' || !item.trim()) ||
      english.keyConcepts.some(concept => !concept?.term?.trim() || !concept?.definition?.trim())) return false
  if (!Array.isArray(hindi.keyHighlights) || !Array.isArray(hindi.keyConcepts) || !Array.isArray(hindi.wayForward)) return false
  if (hindi.keyHighlights.some(item => typeof item !== 'string') ||
      hindi.wayForward.some(item => typeof item !== 'string') ||
      hindi.keyConcepts.some(concept => typeof concept?.term !== 'string' || typeof concept?.definition !== 'string')) return false
  if (hindi.keyHighlights.length !== english.keyHighlights.length ||
      hindi.keyConcepts.length !== english.keyConcepts.length ||
      hindi.wayForward.length !== english.wayForward.length) return false

  const pairedText: Array<[string, string]> = [
    [english.syllabusLinkage, hindi.syllabusLinkage],
    [english.context, hindi.context],
    [english.possibleMainsQuestion, hindi.possibleMainsQuestion],
    ...english.keyHighlights.map((item, index): [string, string] => [item, hindi.keyHighlights[index] ?? '']),
    ...english.wayForward.map((item, index): [string, string] => [item, hindi.wayForward[index] ?? '']),
    ...english.keyConcepts.map((concept, index): [string, string] => [
      `${concept.term} ${concept.definition}`,
      `${hindi.keyConcepts[index]?.term ?? ''} ${hindi.keyConcepts[index]?.definition ?? ''}`,
    ]),
  ]

  const conceptsMatch = english.keyConcepts.every((concept, index) =>
    concept.term.trim() === hindi.keyConcepts[index]?.term.trim() &&
    isHindiText(hindi.keyConcepts[index]?.definition ?? ''))

  return conceptsMatch &&
    pairedText.every(([source, translation]) => isHindiText(translation) && preservesNumbers(source, translation))
}

export function isStructuredDeepDive(article: Article): boolean {
  const dive = article.deepDive
  const mains = dive?.possibleMainsQuestion?.trim() ?? ''
  const contextWords = dive.context?.trim().split(/\s+/).filter(Boolean).length ?? 0
  const conceptsValid = (dive.keyConcepts ?? []).every(concept =>
    Boolean(concept.term.trim()) && concept.definition.trim().split(/\s+/).filter(Boolean).length >= 7)
  const analyticalMains = /\b(discuss|examine|analyse|analyze|evaluate|critically|comment)\b/i.test(mains)
  return Boolean(dive.syllabusLinkage?.trim()) &&
    contextWords >= 18 && contextWords <= 100 &&
    (dive.keyHighlights?.length ?? 0) >= 4 && (dive.keyHighlights?.length ?? 0) <= 6 &&
    (dive.keyConcepts?.length ?? 0) >= 3 && (dive.keyConcepts?.length ?? 0) <= 6 && conceptsValid &&
    (dive.wayForward?.length ?? 0) >= 3 && (dive.wayForward?.length ?? 0) <= 6 &&
    analyticalMains &&
    hasVerifiedHindiDeepDive(article)
}

function hasGoodAudioScript(article: Article): boolean {
  const script = article.audioScript?.trim()
  if (!script) return false
  const words = script.split(/\s+/).filter(Boolean).length
  const hasExamRelevance = /\b(upsc|prelims|mains|exam|examination|syllabus|current affairs)\b/i.test(script)
  const hasBalancedFlow = /\b(but|however|although|the real|larger point|will depend|depends on)\b/i.test(script)
  const hasFiller = /\b(welcome back|this is penni|gist, not the whole article|read the full deep dive|story\s+\d+|that was your briefing)\b/i.test(script)
  const hasLectureJargon = /\b(ask yourself|upsc expects|one level deeper|value addition|mains framework|interlinkages|stakeholders?|case study)\b/i.test(script)
  const hasLabelledDictation = /(^|\n)\s*(context|key highlights|key concepts|way forward|why this matters)\s*:/im.test(script)
  const hasRoboticAbbreviations = /\b(RBI|NIA|CBI|GDP|UAPA|RTI)\b/.test(script) &&
    !/\b(Reserve Bank of India|National Investigation Agency|Central Bureau of Investigation|Gross Domestic Product|Unlawful Activities Prevention Act|Right to Information)\b/i.test(script)
  const hasAwkwardRawStyle = /\bwherein|aforesaid|said to have|respectively|inter alia|hereby\b/i.test(script)
  return words >= 220 &&
    words <= 550 &&
    !/<[^>]+>/.test(script) &&
    hasExamRelevance &&
    hasBalancedFlow &&
    !hasFiller &&
    !hasLectureJargon &&
    !hasLabelledDictation &&
    !hasRoboticAbbreviations &&
    !hasAwkwardRawStyle
}

function hasGoodHinglishAudioScript(article: Article): boolean {
  const script = article.audioScriptHi?.trim()
  if (!script) return false
  const words = script.split(/\s+/).filter(Boolean).length
  const hasExamRelevance = /\b(upsc|prelims|mains|exam|static|current affairs)\b/i.test(script)
  const hasHinglishFlow = /\b(chaliye|samajh|news|issue|answer|yaad|kyun|kaise|matlab|takeaway|mains)\b/i.test(script)
  const hasBalancedFlow = /\b(lekin|however|par |depend|asal|badi baat|larger point)\b/i.test(script)
  const hasFiller = /\b(welcome back|this is penni|gist, not the whole article|read the full deep dive|story\s+\d+|that was your briefing)\b/i.test(script)
  const hasLectureJargon = /\b(ask yourself|upsc expects|one level deeper|value addition|mains framework|interlinkages|stakeholders?|case study)\b/i.test(script)
  return words >= 200 &&
    words <= 550 &&
    !/<[^>]+>/.test(script) &&
    hasExamRelevance &&
    hasHinglishFlow &&
    hasBalancedFlow &&
    !hasLectureJargon &&
    !hasFiller
}

export function contentQualityIssues(data: ArticlesByDate): QuestionQualityIssue[] {
  const issues: QuestionQualityIssue[] = []
  Object.values(data).flat().forEach(article => {
    const prelimsQuestions = article.prelimsQs ?? []
    prelimsQuestions.forEach(q => {
      if (!isLikelyUPSCPrelimsQuestion(q)) {
        issues.push({
          articleId: article.id,
          headline: article.headline,
          field: 'prelims',
          question: q.q,
          reason: 'Use an authentic UPSC count, combination, reasoning, matched-pairs or applied one-best format with four unique, logically coherent options.',
        })
      }
      if (!hasDetailedPrelimsExplanation(q)) {
        issues.push({
          articleId: article.id,
          headline: article.headline,
          field: 'prelims',
          question: q.q,
          reason: 'Write an 80-160 word explanation that names and evaluates every Statement, Pair or Item separately, including why each incorrect one is wrong.',
        })
      }
    })
    if (prelimsQuestions.length >= 2) {
      const formats = prelimsQuestions.map(question => prelimsFormat(question.q)).filter(Boolean)
      if (formats.length === prelimsQuestions.length && new Set(formats).size < 2) {
        issues.push({
          articleId: article.id,
          headline: article.headline,
          field: 'prelims',
          reason: 'The two daily MCQs should use different UPSC formats so practice does not become mechanically repetitive.',
        })
      }
    }
    if (!isStructuredDeepDive(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'deepDive',
        reason: 'Deep Dive needs the five English study-note fields plus a complete Devanagari Hindi version with matching facts, numbers, concept terms, order and bullet counts.',
      })
    }
    if (!hasGoodAudioScript(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'audio',
        reason: 'Add a calm 300-450 word audioScript with plain language, short paragraphs, a balanced concern, practical action and a simple examination takeaway.',
      })
    }
    if (!hasGoodHinglishAudioScript(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'audio',
        reason: 'Add a natural 300-450 word Hinglish audioScriptHi with the same facts and balance, without literal translation, labels or coaching jargon.',
      })
    }
  })
  return issues
}

export const prelimQualityIssues = contentQualityIssues

export function splitUPSCStem(stem: string) {
  const normal = stem.replace(/\s+/g, ' ').trim()
  const askMatch = normal.match(/\b((?:Which|How many|Select the correct|What (?:is|are))[^?]*\?)$/)
  const ask = askMatch?.[0] ?? ''
  const setup = ask ? normal.slice(0, normal.length - ask.length).trim() : normal
  const labelledMarkers = [...setup.matchAll(/(?:^|\s)Statement\s+((?:\d{1,2}|I{1,3}|IV|V))\s*:\s*/gi)]
  const dottedMarkers = [...setup.matchAll(/(?:^|\s)((?:\d{1,2}|I{1,3}|IV|V))\.\s+/g)]
  const markers = labelledMarkers.length >= 2 ? labelledMarkers : dottedMarkers
  const firstStatement = markers[0]?.index ?? -1

  if (firstStatement < 0 || markers.length < 2) {
    return { lead: normal, statements: [] as string[], statementLabels: [] as string[], ask: '' }
  }

  const lead = setup.slice(0, firstStatement).trim()
  const statements = markers.map((marker, index) => {
    const from = (marker.index ?? 0) + marker[0].length
    const to = markers[index + 1]?.index ?? setup.length
    return setup.slice(from, to).trim()
  }).filter(Boolean)
  const statementLabels = markers.slice(0, statements.length).map(marker => marker[1].toUpperCase())
  return { lead, statements, statementLabels, ask }
}
