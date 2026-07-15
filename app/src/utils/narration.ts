import type { Article } from '@/types/article'

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>]+/g, '')
    .replace(/^[\s•-]+/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Acronyms with no natural spoken pronunciation — read letter-by-letter so
// the voice doesn't guess at them as an invented word.
const SPELL_OUT = ['BRICS', 'NDMA', 'NDRF', 'FATF', 'OECD', 'ASEAN', 'SAARC', 'BIMSTEC', 'SCO', 'ICJ', 'ICC', 'NPT', 'CTBT', 'MTCR', 'SEBI', 'TRAI', 'IRDAI', 'PFRDA', 'CCI', 'CAG', 'ECI', 'PMLA', 'IBC', 'NPA', 'MSME', 'PLI', 'DBT', 'PDS', 'CSR', 'FDI', 'FPI', 'FRBM', 'GAAR', 'SDG', 'SDGs', 'WMO', 'IPCC', 'ISRO', 'DRDO', 'IAF', 'BSF', 'CRPF', 'ITBP', 'NSA', 'NSG', 'RAW', 'FCRA', 'POCSO', 'NHRC', 'NCRB', 'NFHS']

// Acronyms that read naturally once expanded into words.
const EXPAND_WORDS: [RegExp, string][] = [
  [/\bUPSC\b/g, 'Union Public Service Commission'],
  [/\bNIA\b/g, 'National Investigation Agency'],
  [/\bCBI\b/g, 'Central Bureau of Investigation'],
  [/\bGDP\b/g, 'Gross Domestic Product'],
  [/\bEVs\b/g, 'electric vehicles'],
  [/\bEV\b/g, 'electric vehicle'],
  [/\bAI\b/g, 'artificial intelligence'],
  [/\bNATO\b/g, 'North Atlantic Treaty Organization'],
  [/\bRTI\b/g, 'Right to Information'],
  [/\bUAPA\b/g, 'Unlawful Activities Prevention Act'],
  [/\bRBI\b/g, 'Reserve Bank of India'],
  [/\bMSP\b/g, 'Minimum Support Price'],
  [/\bGST\b/g, 'Goods and Services Tax'],
  [/\bFTA\b/g, 'Free Trade Agreement'],
  [/\bMOU\b/g, 'memorandum of understanding'],
  [/\bWHO\b/g, 'World Health Organization'],
  [/\bIMF\b/g, 'International Monetary Fund'],
  [/\bWTO\b/g, 'World Trade Organization'],
  [/\bILO\b/g, 'International Labour Organization'],
  [/\bUNESCO\b/g, 'United Nations Educational, Scientific and Cultural Organization'],
  [/\bUNICEF\b/g, 'United Nations Children’s Fund'],
  [/\bUNHCR\b/g, 'UN Refugee Agency'],
  [/\bUNSC\b/g, 'UN Security Council'],
  [/\bUNGA\b/g, 'UN General Assembly'],
  [/\bMGNREGA\b/g, 'the rural jobs guarantee scheme, MGNREGA'],
  [/\bLAC\b/g, 'Line of Actual Control'],
  [/\bLOC\b/g, 'Line of Control'],
  [/\bPSUs\b/g, 'public sector companies'],
  [/\bPSU\b/g, 'public sector company'],
  [/\bPPP\b/g, 'public-private partnership'],
  [/\bNABARD\b/g, 'National Bank for Agriculture and Rural Development'],
]

// Currency, symbols and punctuation some TTS engines skip or mispronounce —
// spell them out so every voice reads them the same, correct way.
function normalizeSymbolsForSpeech(value: string): string {
  return value
    .replace(/₹\s?/g, 'rupees ')
    .replace(/\bRs\.?\s?/g, 'rupees ')
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/&/g, 'and')
    .replace(/[–—]/g, ', ')
    .replace(/\bapprox\.?\b/gi, 'approximately')
    .replace(/\betc\.?\b/gi, 'and so on')
    .replace(/\bvs\.?\b/gi, 'versus')
}

// "SC" means Supreme Court in a judicial sentence but Scheduled Castes in a
// reservation/social-justice one. Guessing wrong teaches a false fact, so
// resolve from nearby context and fall back to spelling it out — neutral,
// never incorrect — when neither context is clear.
function expandSC(value: string): string {
  return value
    .replace(/\bSC\s*\/\s*ST\b/g, 'Scheduled Castes and Scheduled Tribes')
    .replace(/\b(the\s+)?SC\b/g, (match, thePrefix: string | undefined, offset: number, full: string) => {
      const windowText = full.slice(Math.max(0, offset - 60), offset + 60)
      if (/\b(court|judgment|verdict|bench|ruling|justice|judges?|petition|plea|quashed|upheld|struck down)\b/i.test(windowText)) {
        return thePrefix ? 'the Supreme Court' : 'Supreme Court'
      }
      if (/\b(reservation|caste|quota|communit(?:y|ies)|categor(?:y|ies)|backward|scheduled tribe)\b/i.test(windowText)) {
        return 'Scheduled Castes'
      }
      return 'S C'
    })
}

function cleanForSpeech(value: string): string {
  let out = normalizeSymbolsForSpeech(stripHtml(value))
  out = out.replace(/\bGS\s*([1-4])\b/g, 'G S $1')
  for (const [pattern, replacement] of EXPAND_WORDS) out = out.replace(pattern, replacement)
  out = expandSC(out)
  out = out.replace(/\bST\b/g, 'Scheduled Tribes')
  for (const acronym of SPELL_OUT) {
    out = out.replace(new RegExp(`\\b${acronym}\\b`, 'g'), acronym.split('').join(' '))
  }
  return out
    .replace(/\bArticle\s+21\b/gi, 'Article twenty one')
    .replace(/\bArticle\s+19\b/gi, 'Article nineteen')
    .replace(/\bArticle\s+370\b/gi, 'Article three seventy')
    .replace(/\bArticle\s+356\b/gi, 'Article three fifty six')
}

function smoothForSpeech(value: string): string {
  return cleanForSpeech(value)
    .replace(/\bstakeholders\b/gi, 'people affected')
    .replace(/\bstakeholder\b/gi, 'person affected')
    .replace(/\btrade-offs\b/gi, 'balances')
    .replace(/\btrade-off\b/gi, 'balance')
    .replace(/\bimplementation\b/gi, 'how it is carried out')
    .replace(/\bfiscal\b/gi, 'government finance')
    .replace(/\bgovernance\b/gi, 'working of government')
    .replace(/\binstitutions\b/gi, 'public bodies')
    .replace(/\binstitutional\b/gi, 'public body')
}

function addAnchorPacing(value: string): string {
  return value
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*:\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\. ([A-Z])/g, '.\n\n$1')
    .trim()
}

function hasPremiumNarrationScript(article: Article): boolean {
  const script = article.audioScript?.trim()
  if (!script) return false
  const words = script.split(/\s+/).filter(Boolean).length
  const hasNaturalFlow = /\b(at its core|but|however|although|the real|larger point|will depend|depends on)\b/i.test(script)
  const hasLectureJargon = /\b(ask yourself|upsc expects|one level deeper|value addition|mains framework|interlinkages|stakeholders?|case study)\b/i.test(script)
  const oldTemplate = /\bNamaskar\. In today's Penni current affairs short|For prelims, remember the key institution|For mains, think about the larger governance\b/i.test(script)
  return words >= 220 && words <= 550 && hasNaturalFlow && !hasLectureJargon && !oldTemplate
}

function limitWords(value: string, maxWords: number): string {
  const words = smoothForSpeech(value).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}.`
}

function importantDeepDivePoints(article: Article): string[] {
  const dive = article.deepDive
  const structured = [
    dive?.context,
    ...(dive?.keyHighlights ?? []),
    ...(dive?.keyConcepts ?? []).map(concept => `${concept.term} means ${concept.definition}`),
    ...(dive?.wayForward ?? []),
  ].filter(Boolean).join('. ')
  const explanation = cleanForSpeech(structured || dive?.explanation || '')
  if (!explanation) return []
  const sentences = explanation
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
  return sentences
    .filter(sentence => sentence.split(/\s+/).length >= 8)
    .map(sentence => ({
      sentence,
      score:
        (/(why|because|therefore|impact|affect|risk|challenge|issue|concern|significance|important|shows|reveals|means|leads|result|implementation|accountability|rights|livelihood|fiscal|climate|security|diplomacy|institution|constitutional|policy|scheme|regulation)/i.test(sentence) ? 2 : 0) +
        (/(article|act|court|mission|index|committee|authority|convention|treaty|biodiversity|inflation|federal|welfare|governance|technology|environment)/i.test(sentence) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => item.sentence)
}

function categoryLearningPoint(article: Article): string {
  switch (article.category) {
    case 'Polity':
      return 'Its importance finally comes down to power, rights, and accountability.'
    case 'Governance':
      return 'The result depends on whether a policy promise actually reaches people on the ground.'
    case 'Economy':
      return 'Economic gains matter only when they improve investment, jobs, prices, and opportunities in practice.'
    case 'International Relations':
      return 'National interest, regional stability, and diplomacy must work together in real decisions.'
    case 'Environment':
      return 'Environmental decisions also affect livelihoods, public safety, and development.'
    case 'Science and Tech':
      return 'Technology helps society only when innovation is matched with sensible rules, inclusion, and ethics.'
    case 'Security':
      return 'Security action must be strong, coordinated, lawful, and accountable.'
    case 'Social Issues':
      return 'The real test is whether the response protects dignity and reduces inequality.'
    case 'Ethics':
      return 'Public duty must remain grounded in fairness and integrity.'
    case 'Schemes':
      return 'The scheme matters only when public money and delivery create real results.'
    case 'Reports and Indices':
      return 'The value of the report lies in what the data reveals and how it improves public decisions.'
    default:
      return `The issue should be judged by its causes, effects, and impact on people.`
  }
}

/**
 * Hinglish narration — the classroom Hindi variant. Devanagari with English
 * technical terms kept in Latin script; spoken with a hi-IN voice. Returns
 * null when the article has no Hindi script (caller falls back to English).
 */
export function articleNarrationHi(article: Article): string | null {
  const script = article.audioScriptHi?.trim()
  if (!script) return null
  return script.replace(/\s+/g, ' ').trim()
}

export function articleNarration(article: Article): string {
  if (hasPremiumNarrationScript(article)) {
    return addAnchorPacing(cleanForSpeech(article.audioScript ?? ''))
  }

  const dive = article.deepDive
  const importantPoints = (dive.keyHighlights?.length ? dive.keyHighlights : importantDeepDivePoints(article))
    .slice(0, 5)
    .map(point => limitWords(point, 36))
  const concepts = (dive.keyConcepts ?? []).slice(0, 3)
    .map(concept => `${concept.term} means ${limitWords(concept.definition, 28)}`)
  const actions = (dive.wayForward ?? []).slice(0, 4).map(action => limitWords(action, 30))
  const context = dive.context?.trim() && dive.context.trim() !== article.summary.trim() ? dive.context : ''

  const script = [
    limitWords(article.summary, 70),
    context ? limitWords(context, 65) : '',
    ...importantPoints,
    ...concepts,
    actions.length ? `The real outcome will depend on what happens next. ${actions.join(' ')}` : '',
    `From an examination perspective, ${limitWords(article.whyItMatters, 58)}`,
    `The larger point is simple. ${categoryLearningPoint(article)}`,
  ].filter(Boolean).join(' ')

  return addAnchorPacing(script)
}
