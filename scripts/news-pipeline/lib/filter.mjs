// Two-stage UPSC relevance filter.
// Stage A: cheap heuristics drop obviously irrelevant sections (sports,
// entertainment, horoscopes, local city crime) before any LLM spend.
// Stage B: an LLM scores every survivor for UPSC relevance, tags category and
// GS paper, and clusters items that cover the same underlying event.

import { callLLM, extractJson } from './llm.mjs'

const DROP_SECTIONS = /\b(sport|sports|cricket|football|hockey|tennis|ipl|entertainment|movies|music|lifestyle|life-style|horoscope|astrology|web-stories|photos|videos|gallery|puzzle|crossword|recipes|food|travel|fashion|television|trending|viral|celebrity|bollywood|hollywood|books|art|events)\b/i
const DROP_TITLES = /\b(box office|teaser|trailer|horoscope|zodiac|recipe|celebrity|match report|wins by \d|century|wicket|test match|t20|odi|world cup|grand slam|film review|movie review|red carpet|answer practice|practice question|weekly quiz|upsc mains answer practice)\b/i
// City desk stories are usually hyperlocal, but keep ones with governance signals.
const LOCAL_SECTION = /news\/cities|article\/cities|\/states\/|TH_Regional|regional/i
const REGIONAL_KEEP = /\b(high court|supreme court|policy|scheme|pollution|metro rail|flood|climate|heritage|unesco|epidemic|dengue|infrastructure|smart city|slum|housing|water crisis|governance|federal|tribal|forest|wildlife|disaster|landslide|cyclone|ethics|corruption|audit|cag|public health|education|reservation|panchayat|municipal|urban|rural|agriculture|farmer|livelihood|social justice|law and order)\b/i

// Ceremonial PIB releases (greetings, tributes, trophies) are noise; actual
// policy releases (schemes, cabinet decisions, reports) survive.
const PIB_CEREMONIAL = /\b(greets|greetings|condol|pays (homage|tributes?)|birth anniversary|jayanti|punyatithi|felicitat|trophy|trophies|unveils? the trophies|curtain raiser|photo feature|calls on the|courtesy call|extends wishes|wishes the people)\b/i

export function heuristicPrefilter(items) {
  return items.filter(item => {
    const hay = `${item.section} ${item.url}`
    if (DROP_SECTIONS.test(hay)) return false
    if (DROP_TITLES.test(item.title)) return false
    if (LOCAL_SECTION.test(hay) && !REGIONAL_KEEP.test(`${item.title} ${item.summary || ''}`)) return false
    if (item.sourceKey === 'pib' && PIB_CEREMONIAL.test(item.title)) return false
    return true
  })
}

const FILTER_SYSTEM = `You are a UPSC Civil Services current-affairs curator for a daily study app. You judge news items for UPSC CSE relevance the way a top coaching institute's current-affairs team would. Output only JSON.`

const CATEGORIES = ['Polity', 'Economy', 'International Relations', 'Environment', 'Science and Tech', 'Governance', 'Social Issues', 'Security', 'Ethics', 'Schemes', 'Reports and Indices']

const CATEGORY_RULES = [
  ['Ethics', 'GS 4', /\b(ethics|integrity|probity|accountability|conflict of interest|whistleblower|corruption|bribe|public trust|moral|transparency|civil service values|misconduct|negligence|cover-up|audit irregularit)\b/i],
  ['International Relations', 'GS 2', /\b(quad|aukus|g20|brics|united nations|unsc|foreign minister|bilateral|strategic partnership|summit|treaty|iran|israel|china|pakistan|nepal|bangladesh|sri lanka|myanmar|maldives|indian ocean|indo-pacific|strait|hormuz|gulf|asean|european union|wto|imf|world bank|diaspora|embassy|geopolitic|foreign policy)\b/i],
  ['Polity', 'GS 2', /\b(supreme court|high court|constitution|constitutional|article \d+|parliament|bill|act|ordinance|election commission|governor|federal|federalism|judgment|tribunal|delimitation|reservation)\b/i],
  ['Governance', 'GS 2', /\b(governance|cabinet|ministry|policy|mission|scheme|portal|digital public infrastructure|service delivery|local bodies|panchayat|municipal|transparency|accountability|ombudsman)\b/i],
  ['Economy', 'GS 3', /\b(rbi|inflation|gdp|fiscal|monetary|tax|gst|exports?|imports?|trade deficit|current account|budget|bank|sebi|market|manufacturing|coal gasification|semiconductor|supply chain|critical minerals|logistics|investment)\b/i],
  ['Environment', 'GS 3', /\b(climate|biodiversity|forest|wildlife|pollution|emission|green hydrogen|renewable|conservation|tiger|elephant|wetland|disaster|landslide|heatwave|flood|cyclone|environment)\b/i],
  ['Science and Tech', 'GS 3', /\b(drdo|isro|space|satellite|rocket|missile|pinaka|ai|artificial intelligence|quantum|biotechnology|genome|vaccine|cyber|telecom|5g|6g|semiconductor|deep tech)\b/i],
  ['Security', 'GS 3', /\b(defence|defense|navy|army|air force|ins |frigate|submarine|piracy|terror|border|internal security|cyber security|dac|combat readiness|gulf of aden)\b/i],
  ['Schemes', 'GS 2', /\b(yojana|scheme|mission|abhiyan|beneficiary|first installment|instalment|subsidy|dbt|viksit bharat|pm-|pms?)\b/i],
  ['Reports and Indices', 'GS 2', /\b(report|index|ranking|survey|census|nfhs|ncrb|world bank report|imf report|un report)\b/i],
  ['Social Issues', 'GS 2', /\b(health|education|gender|women|children|tribal|caste|poverty|nutrition|migration|labour|employment|social justice)\b/i],
]

function fallbackScoreItem(item) {
  const hay = `${item.title} ${item.summary || ''} ${item.section || ''}`
  let category = item.sourceKey === 'pib' ? 'Governance' : 'Polity'
  let gsPaper = 'GS 2'
  for (const [cat, gs, re] of CATEGORY_RULES) {
    if (re.test(hay)) {
      category = cat
      gsPaper = gs
      break
    }
  }

  let score = 5
  if (/\b(editorial|opinion|lead|ideas|explained)\b/i.test(hay)) score += 2
  if (LOCAL_SECTION.test(`${item.section} ${item.url}`) && REGIONAL_KEEP.test(hay)) score += 1
  if (item.sourceKey === 'pib') score += 1
  if (/\b(supreme court|constitution|cabinet|mission|scheme|rbi|inflation|climate|defence|drdo|isro|quad|unsc|critical minerals|semiconductor|strait|piracy|green hydrogen)\b/i.test(hay)) score += 2
  if (/\b(answer practice|quiz|today in politics|live updates)\b/i.test(hay)) score -= 3
  if (/\b(commission|launches?|approves?|notifies?|releases?|inaugurates?|joint declaration|summit|judgment|flight-test|responds to piracy)\b/i.test(hay)) score += 1
  if (item.sourceKey === 'ie' && /answer practice|upsc mains/i.test(hay)) score = 1

  const cleanTitle = item.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || item.id

  return {
    id: item.id,
    score: Math.max(0, Math.min(9, score)),
    category,
    gsPaper,
    eventKey: cleanTitle,
  }
}

function filterPrompt(batch) {
  return `Score each news item below for UPSC Civil Services exam relevance.

Rules:
- score: 0-10. 8-10 = core UPSC material (polity, economy, IR, environment, sci-tech policy, schemes, SC judgments, reports/indices, security). 5-7 = borderline but usable. 0-4 = not UPSC material.
- Err toward HIGHER scores when unsure — a later editorial pass trims the list, but a missed story cannot be recovered.

HIGH VALUE — score generously (7-10) when genuinely analytical:
- EDITORIALS and OPINION/lead articles (sec contains "editorial"/"opinion"/"edit"/"ideas"): these are Mains gold — argument, critique, policy debate. Prefer them.
- INTERNATIONAL / foreign affairs with a bearing on India, global governance, treaties, geopolitics, the neighbourhood.
- ETHICS angles (GS 4): stories raising integrity, accountability, conflict of interest, public-service values, moral dilemmas, governance ethics — tag gsPaper "GS 4".
- REGIONAL / state stories ONLY when they illustrate a syllabus theme (federalism, governance model, a scheme's ground reality, environment, tribal/social justice, a constitutional body). Score a purely local crime/civic-complaint story low.

- Politics-as-drama (party spats, electioneering rhetoric) is NOT UPSC material; policy, institutions and the ideas behind them ARE.
- Score 0-3 for: coaching/practice columns ("answer practice", "quiz", "weekly test", "key terms"), and archival/anniversary reprints of OLD events (e.g. a years-old judgment resurfacing) — only fresh developments count.
- Routine ceremonial items (inaugurations without policy content, felicitations, port calls) cap at 5.
- category: one of ${JSON.stringify(CATEGORIES)}. Use "Ethics" for GS 4 integrity/values stories.
- gsPaper: "GS 1" | "GS 2" | "GS 3" | "GS 4".
- eventKey: short-kebab-slug naming the underlying EVENT (e.g. "hormuz-truce-collapse"). Items from different papers about the same event MUST share the same eventKey.

Items:
${batch.map(i => `- id:${i.id} | src:${i.sourceLabel} | sec:${i.section} | ${i.title}${i.summary ? ` — ${i.summary.slice(0, 180)}` : ''}`).join('\n')}

Reply with ONLY a JSON array: [{"id":"...","score":7,"category":"...","gsPaper":"GS 2","eventKey":"..."}] — one entry per item, same ids.`
}

export async function llmScore(items, { engine = 'auto', batchSize = 60, concurrency = 4 } = {}) {
  const scored = new Map()
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize))
  let cursor = 0
  async function worker() {
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      console.log(`  [filter] scoring batch ${idx + 1}/${batches.length} (${batch.length} items)`)
      try {
        const text = await callLLM({ prompt: filterPrompt(batch), system: FILTER_SYSTEM, tier: 'fast', maxTokens: 8000, engine })
        for (const row of extractJson(text)) {
          if (row && typeof row.id === 'string') scored.set(row.id, row)
        }
      } catch (err) {
        console.warn(`  [filter] batch ${idx + 1} failed, using deterministic fallback scoring: ${err.message}`)
        for (const item of batch) scored.set(item.id, fallbackScoreItem(item))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker))
  return items
    .map(item => {
      const s = scored.get(item.id)
      return s ? { ...item, score: s.score ?? 0, category: s.category, gsPaper: s.gsPaper, eventKey: s.eventKey || item.id } : { ...item, ...fallbackScoreItem(item) }
    })
    .sort((a, b) => b.score - a.score)
}

// Collapse same-event coverage across papers into one story with merged sources.
// A per-source cap keeps one prolific source (usually PIB) from crowding out
// the papers' analysis pieces.
export function clusterEvents(scoredItems, { minScore = 6, maxStories = 18, maxPerSource = 8 } = {}) {
  const clusters = new Map()
  for (const item of scoredItems) {
    if (item.score < minScore) continue
    const key = item.eventKey
    if (!clusters.has(key)) clusters.set(key, { ...item, members: [item] })
    else clusters.get(key).members.push(item)
  }
  const perSource = {}
  const sourceCap = (key) => key === 'pib' ? 5 : key === 'airdd' ? 3 : maxPerSource
  return [...clusters.values()]
    .sort((a, b) => {
      const sourceWeight = (x) => x.members[0].sourceKey === 'hindu' || x.members[0].sourceKey === 'ie' ? 0.35 : x.members[0].sourceKey === 'pib' ? -0.25 : 0
      return (b.score + sourceWeight(b)) - (a.score + sourceWeight(a))
    })
    .filter(c => {
      const primary = c.members[0].sourceKey
      perSource[primary] = (perSource[primary] || 0) + 1
      return perSource[primary] <= sourceCap(primary)
    })
    .slice(0, maxStories)
    .map(c => ({
      eventKey: c.eventKey,
      score: c.score,
      category: c.category,
      gsPaper: c.gsPaper,
      title: c.title,
      members: c.members.map(m => ({ id: m.id, sourceKey: m.sourceKey, sourceLabel: m.sourceLabel, title: m.title, url: m.url })),
    }))
}
