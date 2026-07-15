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
  /with reference to/i,
  /which of the statements/i,
  /which of the following statements/i,
  /correctly matched/i,
  /how many of the above/i,
  /pairs? given above/i,
]

const DEEP_DIVE_REQUIRED_SECTIONS = [
  /one-line summary/i,
  /explain like i'm a upsc aspirant|explain like i.?m a upsc aspirant/i,
  /what actually happened/i,
  /why is this important/i,
  /background you must know/i,
  /connect with static upsc syllabus/i,
  /things not mentioned in the article/i,
  /upsc perspective/i,
  /prelims nuggets/i,
  /mains analysis/i,
  /interlinkages/i,
  /maps/i,
  /previous upsc questions/i,
  /memory tricks/i,
  /common mistakes students make/i,
  /revision notes/i,
]

export function isLikelyUPSCPrelimsQuestion(q: PrelimQuestion): boolean {
  const stem = q.q.trim()
  const words = stem.split(/\s+/).filter(Boolean).length
  const hasNumberedStatements = /\b1\.\s+.+\b2\.\s+/s.test(stem)
  const hasUpscFrame = UPSC_STYLE_PATTERNS.some(pattern => pattern.test(stem))
  const isRecallStem = RECALL_PATTERNS.some(pattern => pattern.test(stem))
  return (hasNumberedStatements || hasUpscFrame) && !isRecallStem && words >= 18
}

export function hasDetailedPrelimsExplanation(q: PrelimQuestion): boolean {
  const explanation = q.explanation.trim()
  const isStatementQuestion = /\b1\.\s+.+\b2\.\s+/s.test(q.q)
  if (explanation.length < 110) return false
  if (isStatementQuestion && !/(statement|both|neither|incorrect|correct)/i.test(explanation)) return false
  return true
}

export function isStructuredDeepDive(article: Article): boolean {
  const explanation = article.deepDive?.explanation?.trim() ?? ''
  const mains = article.deepDive?.possibleMainsQuestion?.trim() ?? ''
  const sectionLabels = explanation.match(/<strong>[^<]{3,90}:?<\/strong>/g) ?? []
  const normalized = explanation.replace(/<[^>]+>/g, ' ')
  const requiredSectionCount = DEEP_DIVE_REQUIRED_SECTIONS.filter(pattern => pattern.test(normalized)).length
  const hasBullets = /(^|\n)\s*-\s+/.test(explanation) || /<li\b/i.test(explanation)
  const hasVisualStructure = hasBullets || /<table\b|dd-flow|flow|timeline|comparison|cause|effect|interlinkages|maps/i.test(explanation)
  const hasTeachingDepth = /background you must know|things not mentioned|previous upsc questions|memory tricks|common mistakes|revision notes/i.test(normalized)
  const hasExamLens = /prelims nuggets|mains analysis|upsc perspective|static upsc syllabus|gs\s*[1-4]|essay|interview/i.test(normalized)
  const analyticalMains = /\b(discuss|examine|analyse|analyze|evaluate|critically|comment)\b/i.test(mains)
  return explanation.length >= 2500 &&
    sectionLabels.length >= 12 &&
    requiredSectionCount >= 14 &&
    hasVisualStructure &&
    hasTeachingDepth &&
    hasExamLens &&
    analyticalMains
}

function hasGoodAudioScript(article: Article): boolean {
  const script = article.audioScript?.trim()
  if (!script) return false
  const words = script.split(/\s+/).filter(Boolean).length
  const hasExamRelevance = /\b(upsc|prelims|mains|gs\s*[1-4]|exam|syllabus|static|current affairs)\b/i.test(script)
  const hasMainsKnowledge = /\b(governance|constitutional|institution|policy|federal|economy|welfare|security|ethics|climate|environment|diplomacy|rights|accountability|implementation|trade-off|stakeholder|consequence|reform|livelihood|regulation|capacity|transparency|case study|hazard|vulnerability|exposure)\b/i.test(script)
  const hasFiller = /\b(welcome back|this is penni|gist, not the whole article|read the full deep dive|story\s+\d+|that was your briefing)\b/i.test(script)
  const hasSpokenJargon = /\b(stakeholders?|trade-offs?|implementation|institutional)\b/i.test(script)
  const hasLabelledDictation = /\b(why this matters|what you should learn|important facts to retain|broader issue is)\s*:/i.test(script)
  const hasStoryFlow = /\b(Penni Explain|let'?s understand|case study|here is the news|what happened|why it matters|the important point|before we move ahead|remember|real lesson|takeaway)\b/i.test(script)
  const hasRoboticAbbreviations = /\b(RBI|NIA|CBI|GDP|UAPA|RTI)\b/.test(script) &&
    !/\b(Reserve Bank of India|National Investigation Agency|Central Bureau of Investigation|Gross Domestic Product|Unlawful Activities Prevention Act|Right to Information)\b/i.test(script)
  const hasAwkwardRawStyle = /\bwherein|aforesaid|said to have|respectively|inter alia|hereby\b/i.test(script)
  return words >= 250 &&
    words <= 1000 &&
    !/<[^>]+>/.test(script) &&
    hasExamRelevance &&
    hasMainsKnowledge &&
    hasStoryFlow &&
    !hasFiller &&
    !hasSpokenJargon &&
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
  const hasTeaching = /\b(cause|effect|policy|rights|governance|economy|security|diplomacy|environment|social justice|constitutional|impact|risk|way forward)\b/i.test(script)
  const hasFiller = /\b(welcome back|this is penni|gist, not the whole article|read the full deep dive|story\s+\d+|that was your briefing)\b/i.test(script)
  return words >= 180 &&
    words <= 1000 &&
    !/<[^>]+>/.test(script) &&
    hasExamRelevance &&
    hasHinglishFlow &&
    hasTeaching &&
    !hasFiller
}

export function contentQualityIssues(data: ArticlesByDate): QuestionQualityIssue[] {
  const issues: QuestionQualityIssue[] = []
  Object.values(data).flat().forEach(article => {
    ;(article.prelimsQs ?? []).forEach(q => {
      if (!isLikelyUPSCPrelimsQuestion(q)) {
        issues.push({
          articleId: article.id,
          headline: article.headline,
          field: 'prelims',
          question: q.q,
          reason: 'Use UPSC-style statement, pair-matching, or static-current linkage format instead of direct recall.',
        })
      }
      if (!hasDetailedPrelimsExplanation(q)) {
        issues.push({
          articleId: article.id,
          headline: article.headline,
          field: 'prelims',
          question: q.q,
          reason: 'Explanation should be detailed and explain why each relevant statement/option is correct or incorrect.',
        })
      }
    })
    if (!isStructuredDeepDive(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'deepDive',
        reason: 'Deep Dive should be a full UPSC mentor-style learning module with the 16 required sections, static links, PYQ angle, maps, memory aids, revision notes, and an analytical mains question.',
      })
    }
    if (!hasGoodAudioScript(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'audio',
        reason: 'Add a professionally rewritten Penni Explain audioScript of about 450-900 words with story flow, natural pacing, expanded abbreviations, and concrete mains-relevant teaching points.',
      })
    }
    if (!hasGoodHinglishAudioScript(article)) {
      issues.push({
        articleId: article.id,
        headline: article.headline,
        field: 'audio',
        reason: 'Add a natural Hinglish audioScriptHi version that teaches the same article to a UPSC aspirant without raw HTML, robotic labels, or literal translation.',
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
  const firstStatement = setup.search(/(?:^|\s)(?:1|I)\.\s+/)

  if (firstStatement < 0) {
    return { lead: normal, statements: [] as string[], ask: '' }
  }

  const lead = setup.slice(0, firstStatement).trim()
  const statementText = setup.slice(firstStatement).trim()
  const markers = [...statementText.matchAll(/(?:^|\s)((?:\d{1,2}|I{1,3}|IV|V))\.\s+/g)]
  if (markers.length < 2) return { lead: normal, statements: [] as string[], ask: '' }
  const statements = markers.map((marker, index) => {
    const from = (marker.index ?? 0) + marker[0].length
    const to = markers[index + 1]?.index ?? statementText.length
    return statementText.slice(from, to).trim()
  }).filter(Boolean)
  return { lead, statements, ask }
}
