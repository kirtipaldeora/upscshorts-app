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

function cleanForSpeech(value: string): string {
  return stripHtml(value)
    .replace(/\bGS\s*([1-4])\b/g, 'G S $1')
    .replace(/\bUPSC\b/g, 'Union Public Service Commission')
    .replace(/\bNIA\b/g, 'National Investigation Agency')
    .replace(/\bCBI\b/g, 'Central Bureau of Investigation')
    .replace(/\bGDP\b/g, 'Gross Domestic Product')
    .replace(/\bEV\b/g, 'electric vehicle')
    .replace(/\bAI\b/g, 'artificial intelligence')
    .replace(/\bNATO\b/g, 'North Atlantic Treaty Organization')
    .replace(/\bBRICS\b/g, 'B R I C S')
    .replace(/\bRTI\b/g, 'Right to Information')
    .replace(/\bUAPA\b/g, 'Unlawful Activities Prevention Act')
    .replace(/\bRBI\b/g, 'Reserve Bank of India')
    .replace(/\bSC\b/g, 'Scheduled Castes')
    .replace(/\bST\b/g, 'Scheduled Tribes')
    .replace(/\bArticle\s+21\b/gi, 'Article twenty one')
    .replace(/\bArticle\s+19\b/gi, 'Article nineteen')
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
  const hasExplainTone = /\b(let'?s understand|case study|at first glance|the real lesson|now think|ask yourself|this is why|notice the shift|what this means|what you should remember)\b/i.test(script)
  const oldTemplate = /\bNamaskar\. In today's Penni current affairs short|For prelims, remember the key institution|For mains, think about the larger governance\b/i.test(script)
  return words >= 180 && hasExplainTone && !oldTemplate
}

function limitWords(value: string, maxWords: number): string {
  const words = smoothForSpeech(value).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}.`
}

function importantDeepDivePoints(article: Article): string[] {
  const explanation = cleanForSpeech(article.deepDive?.explanation ?? '')
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
      return 'The deeper point is simple. In polity, every such story finally comes down to power, rights, and accountability.'
    case 'Governance':
      return 'The deeper point is the distance between a policy promise and what actually reaches people on the ground.'
    case 'Economy':
      return 'The deeper point is how growth, welfare, prices, jobs, rules, and public spending affect one another.'
    case 'International Relations':
      return 'The deeper point is how national interest, regional stability, and diplomacy come together in real decisions.'
    case 'Environment':
      return 'The deeper point is that environment questions are rarely only about nature. They also affect livelihoods, safety, and development.'
    case 'Science and Tech':
      return 'The deeper point is that technology helps society only when innovation is matched with sensible rules, inclusion, and ethics.'
    case 'Security':
      return 'The deeper point is how security action must be strong, but also coordinated, lawful, and accountable.'
    case 'Social Issues':
      return 'The deeper point is how inequality, dignity, and inclusion shape daily life for vulnerable groups.'
    case 'Ethics':
      return 'The deeper point is the human side of public duty, fairness, and integrity.'
    case 'Schemes':
      return 'The deeper point is whether public money, targeting, and delivery are creating real results.'
    case 'Reports and Indices':
      return 'The deeper point is what the data reveals, what it may hide, and why evidence matters for public policy.'
    default:
      return `The deeper point is to understand the causes, effects, and people affected by the issue.`
  }
}

function conceptBridge(article: Article): string {
  const term = article.keyTerms?.[0]
  if (term) {
    return `Before we move ahead, remember this term, ${smoothForSpeech(term)}. It is useful because it gives you a precise word for the idea behind this news.`
  }
  if (article.category === 'International Relations') {
    return `Before we move ahead, remember that foreign policy is usually a balance between values, national interest, and practical constraints.`
  }
  if (article.category === 'Environment') {
    return `Before we move ahead, remember that environmental issues usually involve three things together, nature, people, and the economy.`
  }
  if (article.category === 'Economy') {
    return `Before we move ahead, remember that economic news is often about incentives, costs, and who finally bears the burden.`
  }
  return ''
}

export function articleNarration(article: Article): string {
  if (hasPremiumNarrationScript(article)) {
    return addAnchorPacing(smoothForSpeech(article.audioScript ?? ''))
  }

  const keyTerms = article.keyTerms?.slice(0, 3).filter(Boolean) ?? []
  const importantPoints = importantDeepDivePoints(article)
  const prepHook = keyTerms.length
    ? `The words to retain are ${keyTerms.map(smoothForSpeech).join(', ')}.`
    : ''
  const detailPoints = importantPoints.length
    ? importantPoints.map((point, index) => {
      if (index === 0) return `First, ${limitWords(point, 38)}`
      if (index === 1) return `Second, ${limitWords(point, 38)}`
      if (index === 2) return `Third, ${limitWords(point, 38)}`
      return `Also, ${limitWords(point, 34)}`
    }).join(' ')
    : ''

  const script = [
    `Penni Explain. Let's understand this news not as a newspaper report, but as a UPSC Mains case study.`,
    `The news is about ${smoothForSpeech(article.headline)}.`,
    `At the surface level, ${limitWords(article.summary, 58)}`,
    `But the real lesson is this. ${limitWords(article.whyItMatters, 62)}`,
    categoryLearningPoint(article),
    conceptBridge(article),
    detailPoints ? `Now let us pick the useful points from the article. ${detailPoints}` : '',
    prepHook,
    `So the takeaway is simple. Do not remember this as an isolated news item. Remember the issue behind it, the people affected by it, and the reason it matters for public policy.`,
  ].filter(Boolean).join(' ')

  return addAnchorPacing(script)
}
