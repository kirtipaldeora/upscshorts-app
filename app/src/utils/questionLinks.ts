import type { Article } from '@/types/article'
import type { PyqItem } from '@/stores/usePracticeStore'
import type { PyqQuestion } from '@/types/pyq'
import type { Question } from '@/utils/practiceUtils'

/*
 * This matcher is deliberately conservative. A broad subject word is not a
 * connection: the two questions must share a canonical concept/phrase, or a
 * dense set of meaningful tokens inside the same subject family.
 */

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'all', 'among', 'and', 'are', 'been', 'before', 'being',
  'below', 'between', 'both', 'could', 'does', 'each', 'for', 'from', 'given', 'have', 'into', 'more',
  'most', 'not', 'only', 'other', 'over', 'reference', 'regarding', 'select', 'statement', 'statements',
  'such', 'than', 'that', 'the', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'was', 'were', 'which', 'while', 'with', 'would', 'india', 'indian', 'correct', 'following', 'consider',
  'question', 'questions', 'news', 'current', 'affairs', 'pair', 'pairs', 'option', 'options', 'respect',
])

/* Words that regularly occur in generated PYQ tags but do not identify a
 * concept on their own. In particular, this blocks the former false matches
 * through words such as “Electric” and “Alternative”. */
const WEAK_CONCEPT_WORDS = new Set([
  'act', 'alternative', 'alternatives', 'appropriate', 'based', 'category', 'concept', 'considered',
  'condition', 'conditions', 'context', 'correctly', 'countries', 'country', 'court', 'development',
  'developments', 'digital', 'domestic', 'electric', 'electrical', 'energy', 'feature', 'features', 'general',
  'government', 'governance', 'included', 'incorrect', 'include', 'including', 'industry', 'information',
  'international', 'issue',
  'issues', 'launched', 'law', 'matched', 'miscellaneous', 'national', 'organization', 'organisations',
  'organisation', 'organizations', 'policy', 'policies', 'power', 'process', 'programme', 'programmes',
  'protection', 'recent', 'relevant', 'report', 'reports', 'researchers', 'right', 'rights', 'scheme',
  'schemes', 'science', 'sector', 'sectors', 'security', 'services', 'simultaneously', 'state', 'states',
  'system', 'systems', 'technology', 'technologies', 'term', 'terms', 'used', 'using', 'various', 'vehicle',
  'vehicles', 'world', 'biology', 'biotechnology', 'chemistry', 'economy',
])

const BROAD_CANONICAL_PHRASES = new Set([
  'constitutional amendment',
  'defence technology',
  'fundamental rights',
  'social justice',
])

const SUBJECT_DOMAINS: Record<string, string> = {
  polity: 'governance',
  governance: 'governance',
  schemes: 'governance',
  'social issues': 'society',
  society: 'society',
  economy: 'economy',
  economics: 'economy',
  agriculture: 'economy',
  'reports and indices': 'economy',
  environment: 'environment',
  geography: 'environment',
  'science and tech': 'science',
  'science and technology': 'science',
  science: 'science',
  technology: 'science',
  security: 'security',
  'internal security': 'security',
  'international relations': 'international',
  history: 'history',
  'ancient history': 'history',
  'medieval history': 'history',
  'modern history': 'history',
  'art and culture': 'history',
  ethics: 'ethics',
  'current affairs': 'general',
}

/* Adjacent domains are accepted only for a canonical phrase match, never for
 * loose whole-question overlap. */
const ADJACENT_DOMAINS = new Set([
  'economy|international',
  'governance|society',
  'international|security',
  'international|science',
  'environment|international',
  'environment|security',
  'science|security',
])

type SubjectRelation = 'same' | 'adjacent' | 'none'

interface CanonicalPhrase {
  value: string
  normalized: string
  words: string[]
  discriminatingWords: string[]
}

interface TextMatch {
  score: number
  strong: boolean
  reason: string
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lexicalWords(value: string) {
  return normalize(value)
    .split(' ')
    .filter(word => (word.length >= 3 || /\d/.test(word)) && !STOP_WORDS.has(word))
}

function focusWords(value: string) {
  return new Set(
    lexicalWords(value).filter(word => !WEAK_CONCEPT_WORDS.has(word) && !/^\d+$/.test(word)),
  )
}

function isAcronym(value: string) {
  const compact = value.trim().replace(/[^A-Za-z0-9]/g, '')
  return compact.length >= 2 && compact.length <= 12 && /[A-Z]/.test(compact) && compact === compact.toUpperCase()
}

function toCanonicalPhrase(value: string, allowSingle: boolean): CanonicalPhrase | null {
  const normalized = normalize(value)
  if (!normalized || BROAD_CANONICAL_PHRASES.has(normalized)) return null

  const words = lexicalWords(value)
  const discriminatingWords = words.filter(word => !WEAK_CONCEPT_WORDS.has(word))
  if (!discriminatingWords.length) return null

  if (words.length === 1) {
    if (!allowSingle) return null
    const word = words[0]
    const distinctive = isAcronym(value) || /\d/.test(word) || word.length >= 7
    if (!distinctive || WEAK_CONCEPT_WORDS.has(word)) return null
  }

  return { value: value.trim(), normalized, words, discriminatingWords }
}

function canonicalPhrases(values: Array<string | undefined>, allowSingle = false) {
  const unique = new Map<string, CanonicalPhrase>()
  values.forEach(value => {
    if (!value) return
    const phrase = toCanonicalPhrase(value, allowSingle)
    if (phrase && !unique.has(phrase.normalized)) unique.set(phrase.normalized, phrase)
  })
  return [...unique.values()]
}

function domain(subject: string) {
  const key = normalize(subject)
  return SUBJECT_DOMAINS[key] ?? key
}

function subjectRelation(sourceSubject: string, targetSubject: string): SubjectRelation {
  const source = domain(sourceSubject)
  const target = domain(targetSubject)
  if (source === target) return 'same'
  if (source === 'general' || target === 'general') return 'adjacent'
  const key = [source, target].sort().join('|')
  return ADJACENT_DOMAINS.has(key) ? 'adjacent' : 'none'
}

function containsPhrase(text: string, phrase: string) {
  return ` ${normalize(text)} `.includes(` ${phrase} `)
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return [...new Set(left)].filter(word => rightSet.has(word))
}

function relationBonus(relation: SubjectRelation) {
  return relation === 'same' ? 4 : relation === 'adjacent' ? 1 : 0
}

function singleWordPrintedMatch(
  phrase: CanonicalPhrase,
  sourceText: string,
  targetText: string,
  relation: SubjectRelation,
) {
  return phrase.words.length === 1
    && relation === 'same'
    && containsPhrase(sourceText, phrase.normalized)
    && containsPhrase(targetText, phrase.normalized)
}

function conceptMatch(
  sourceConcepts: CanonicalPhrase[],
  targetConcepts: CanonicalPhrase[],
  sourceText: string,
  targetText: string,
  relation: SubjectRelation,
): TextMatch | null {
  if (relation === 'none') return null

  // Exact metadata-to-metadata equality is the strongest possible signal.
  for (const source of sourceConcepts) {
    const exact = targetConcepts.find(target => target.normalized === source.normalized)
    if (exact) {
      // A single metadata tag is not evidence by itself. It must occur in both
      // printed texts and stay inside the same subject domain; this prevents a
      // broad word such as “agreement” or “committee” linking unrelated items.
      if (source.words.length === 1 && !singleWordPrintedMatch(source, sourceText, targetText, relation)) continue
      return {
        score: 100 + relationBonus(relation),
        strong: true,
        reason: `Shared concept: ${exact.value}`,
      }
    }
  }

  // Current-affairs key terms are editorial metadata, while many PYQ tags are
  // machine-extracted. Also check the trusted current-affairs term against the
  // printed PYQ stem instead of relying on a noisy PYQ tag.
  for (const target of targetConcepts) {
    if (containsPhrase(sourceText, target.normalized)) {
      if (target.words.length === 1 && !singleWordPrintedMatch(target, sourceText, targetText, relation)) continue
      return {
        score: 90 + relationBonus(relation),
        strong: true,
        reason: `Shared concept: ${target.value}`,
      }
    }
  }

  // A complete canonical key term appearing in the actual question/headline
  // is also strong. Single words get here only when they passed the
  // distinctive-term guard above.
  for (const source of sourceConcepts) {
    if (containsPhrase(targetText, source.normalized)) {
      if (source.words.length === 1 && !singleWordPrintedMatch(source, sourceText, targetText, relation)) continue
      return {
        score: 90 + relationBonus(relation),
        strong: true,
        reason: `Shared concept: ${source.value}`,
      }
    }
  }

  // Allow close variants of structured concepts (for example “atmospheric
  // re-entry” and “spacecraft atmospheric re-entry”), but require at least two
  // meaningful shared words and very high coverage. This intentionally rejects
  // one-word coincidences.
  for (const source of sourceConcepts) {
    for (const target of targetConcepts) {
      const shared = intersection(source.words, target.words)
      const sharedMeaningful = intersection(source.discriminatingWords, target.discriminatingWords)
      const shorter = Math.min(new Set(source.words).size, new Set(target.words).size)
      const union = new Set([...source.words, ...target.words]).size
      const coverage = shorter ? shared.length / shorter : 0
      const jaccard = union ? shared.length / union : 0
      if (shared.length >= 2 && sharedMeaningful.length >= 2 && coverage >= 0.8 && jaccard >= 0.6) {
        return {
          score: 80 + relationBonus(relation),
          strong: true,
          reason: `Shared concept: ${target.value}`,
        }
      }
    }
  }

  // A canonical phrase may be written non-contiguously in a question. Keep
  // this fallback inside the same domain and require every one of at least
  // three words (including two discriminating words) to be present.
  if (relation === 'same') {
    const targetWords = focusWords(targetText)
    for (const source of sourceConcepts) {
      const meaningful = [...new Set(source.discriminatingWords)]
      const shared = meaningful.filter(word => targetWords.has(word))
      if (source.words.length >= 3 && meaningful.length >= 2 && shared.length === meaningful.length) {
        return {
          score: 74 + relationBonus(relation),
          strong: true,
          reason: `Shared concept: ${source.value}`,
        }
      }
    }
  }

  return null
}

function strongTextMatch(sourceText: string, targetText: string, relation: SubjectRelation): TextMatch | null {
  if (relation !== 'same') return null

  const source = focusWords(sourceText)
  const target = focusWords(targetText)
  const shared = [...source].filter(word => target.has(word))
  const smaller = Math.min(source.size, target.size)
  const union = new Set([...source, ...target]).size
  const coverage = smaller ? shared.length / smaller : 0
  const jaccard = union ? shared.length / union : 0

  // Four non-generic words plus dense overlap is intentionally difficult to
  // satisfy. When in doubt, showing no relation is better than inventing one.
  if (shared.length < 4 || coverage < 0.55 || jaccard < 0.28) return null
  return {
    score: 70 + relationBonus(relation),
    strong: true,
    reason: `Shared concept: ${shared.slice(0, 4).join(' · ')}`,
  }
}

function scoreTexts(
  sourceSubject: string,
  sourceText: string,
  sourceConcepts: CanonicalPhrase[],
  targetSubject: string,
  targetText: string,
  targetConcepts: CanonicalPhrase[] = [],
): TextMatch {
  const relation = subjectRelation(sourceSubject, targetSubject)
  const match = conceptMatch(sourceConcepts, targetConcepts, sourceText, targetText, relation)
    ?? strongTextMatch(sourceText, targetText, relation)

  return match ?? { score: 0, strong: false, reason: '' }
}

export function relatedPyqs(article: Article, question: Question, pyqs: PyqItem[], limit = 3) {
  const concepts = article.keyTerms ?? []
  const sourceConcepts = canonicalPhrases(concepts, true)
  const sourceText = [article.headline, question.q, question.ref].filter(Boolean).join(' ')
  return pyqs
    .filter(item => item.exam === 'prelims')
    .map(item => ({
      item,
      ...scoreTexts(
        article.category,
        sourceText,
        sourceConcepts,
        item.subject,
        item.question,
      ),
    }))
    .filter(link => link.strong && link.score >= 70)
    .sort((a, b) => b.score - a.score || b.item.year - a.item.year)
    .slice(0, limit)
}

export function relatedCurrentQuestions(
  pyq: PyqQuestion,
  entries: Array<{ article: Article; question: Question }>,
  limit = 3,
) {
  // Topic is curated taxonomy and may be a meaningful single word (for
  // example, “Inflation”). Auto-generated one-word tags are not trusted.
  const sourceConcepts = [
    ...canonicalPhrases([pyq.topic], true),
    ...canonicalPhrases(pyq.tags),
  ]
  // Topic and tags are matching hints, not printed evidence. In particular,
  // a one-word taxonomy label must also occur in the actual PYQ stem.
  const sourceText = pyq.stem
  const bestByArticle = new Map<string, { article: Article; question: Question; score: number; strong: boolean; reason: string }>()

  entries.forEach(entry => {
    const targetConcepts = canonicalPhrases(entry.article.keyTerms ?? [], true)
    const targetText = [entry.article.headline, entry.question.q, entry.question.ref].filter(Boolean).join(' ')
    const match = scoreTexts(
      pyq.subject,
      sourceText,
      sourceConcepts,
      entry.article.category,
      targetText,
      targetConcepts,
    )
    if (!match.strong || match.score < 70) return
    const previous = bestByArticle.get(entry.article.id)
    if (!previous || match.score > previous.score) bestByArticle.set(entry.article.id, { ...entry, ...match })
  })

  return [...bestByArticle.values()]
    .sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date))
    .slice(0, limit)
}
