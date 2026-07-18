// Article generation. For each selected story cluster we pull whatever source
// text is freely readable, then ask the smart-tier model to write a complete
// Penni Article JSON following the repo's own content specs
// (app/content-generation-guidelines.md + app/content/explain-script-prompt.md).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchText, extractArticleText } from './util.mjs'
import { callLLM, extractJson } from './llm.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const GUIDELINES = readFileSync(path.join(ROOT, 'app/content-generation-guidelines.md'), 'utf8')
const NARRATION_SPEC = readFileSync(path.join(ROOT, 'app/content/explain-script-prompt.md'), 'utf8')

const CATEGORIES = ['Polity', 'Economy', 'International Relations', 'Environment', 'Science and Tech', 'Governance', 'Social Issues', 'Security', 'Ethics', 'Schemes', 'Reports and Indices']

function composeSourceLabel(members) {
  const labels = [...new Set(members.map(m => m.sourceLabel))]
  if (labels.includes('The Hindu') && labels.includes('Indian Express')) return 'The Hindu / Indian Express'
  return labels.slice(0, 2).join(' / ')
}

export async function enrichCluster(cluster, { maxSources = 2 } = {}) {
  // Curated source text supplied directly (e.g. a manually imported daily
  // digest) — use it verbatim and skip any network fetch.
  if (cluster.sourceText) {
    return [{ source: composeSourceLabel(cluster.members), url: cluster.members[0]?.url || '', text: cluster.sourceText }]
  }
  const texts = []
  for (const member of cluster.members.slice(0, maxSources)) {
    try {
      const html = await fetchText(member.url, { timeoutMs: 20000, retries: 1 })
      const text = extractArticleText(html)
      if (text.length > 150) texts.push({ source: member.sourceLabel, url: member.url, text })
    } catch (err) {
      console.warn(`  [enrich] ${member.url}: ${err.message}`)
    }
  }
  return texts
}

const GENERATOR_SYSTEM = `You are the content engine of Penni, a UPSC current-affairs study app. You convert news coverage into premium UPSC learning modules. You follow the app's content specifications exactly and never invent facts that are not supported by the provided source text or well-established static knowledge. Reply with the JSON object directly as message text. Never use tools, never write files, never run commands, never ask for approval — your reply IS the deliverable.`

function generatorPrompt({ cluster, sourceTexts, date, articleId }) {
  const sourcesBlock = sourceTexts.length
    ? sourceTexts.map(s => `--- ${s.source} (${s.url}) ---\n${s.text}`).join('\n\n')
    : '(Full text unavailable — work from the headlines below plus accurate static knowledge; keep factual claims conservative.)'

  return `Create ONE Penni article JSON for this news story.

STORY: ${cluster.title}
DATE: ${date}
ALL HEADLINES FOR THIS EVENT:
${cluster.members.map(m => `- [${m.sourceLabel}] ${m.title}`).join('\n')}

SOURCE TEXT:
${sourcesBlock}

Return ONLY a JSON object with EXACTLY these fields:
{
  "id": "${articleId}",
  "headline": "clear, specific, exam-oriented headline (not clickbait)",
  "date": "${date}",
  "source": "${composeSourceLabel(cluster.members)}",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "gsPaper": "GS 1" | "GS 2" | "GS 3" | "GS 4",
  "globalNews": true | false,
  "summary": "2-3 sentence factual summary",
  "whyItMatters": "2-3 sentences on why a UPSC aspirant must care",
  "deepDive": {
    "syllabusLinkage": "Example: GS II: Bilateral Relations; GS III: International Trade",
    "context": "2-3 direct sentences explaining what happened and why it is significant",
    "keyHighlights": ["4-6 short factual points, one sentence each"],
    "keyConcepts": [{"term": "3-6 essential terms", "definition": "plain-English meaning and relevance"}],
    "wayForward": ["3-6 specific and practical actions, one sentence each"],
    "hindi": {
      "syllabusLinkage": "the verified syllabusLinkage translated into natural Devanagari Hindi",
      "context": "the verified context translated into natural Devanagari Hindi",
      "keyHighlights": ["Hindi translations in exactly the same order and count as keyHighlights"],
      "keyConcepts": [{"term": "keep the English term exactly unchanged", "definition": "natural Hindi definition with the same meaning"}],
      "wayForward": ["Hindi translations in exactly the same order and count as wayForward"],
      "possibleMainsQuestion": "natural Hindi translation of the same Mains question"
    },
    "explanation": "300-500 word supporting explanation in simple paragraphs, without headings or labels",
    "possibleMainsQuestion": "one Mains question asking to analyse/examine/discuss/evaluate"
  },
  "audioScript": "calm, natural English explanation per the narration spec below, 300-450 words, no markdown or labels",
  "audioScriptHi": "the same explanation in natural Hinglish (Latin script), 300-450 words, not a literal translation",
  "prelimsQs": [two UPSC-standard questions per the guidelines: {"q","options"(4),"answer"(0-indexed),"explanation","ref"}],
  "keyTerms": [4-7 key terms],
  "location": {"lat": number, "lon": number, "place": "most relevant place for the news globe", "countryCode": "ISO 3166-1 alpha-2 code"}
}

=== DEEP DIVE QUALITY BAR ===
Every article must produce the same five-part study note shown in the supplied India-UK FTA reference. The app displays these fields directly as: Syllabus Linkage, Context, Key Highlights, Key Concepts and Way Forward.

WRITE EACH FIELD LIKE THIS:
- syllabusLinkage: name the relevant GS paper and the exact syllabus topic. Add a second GS paper only when genuinely relevant.
- context: 2-3 short sentences. State what happened, the parties/place involved and why the development matters. Do not give background history here.
- keyHighlights: 4-6 direct factual bullets covering the main provisions, effects, opportunities, risks or institutional details. No generic claims.
- keyConcepts: 3-6 terms a student must understand. Expand abbreviations and define every term in one plain sentence. Never define a difficult word using more difficult words.
- wayForward: 3-6 practical actions tied to the actual issue. Start with clear verbs such as Ensure, Improve, Strengthen, Expand, Review or Build.
- explanation: supporting source-based detail for narration only. Use simple <p> paragraphs, 300-500 words, with no headings, numbered sections, jargon labels or decorative HTML.

HINDI TRANSLATION RULES:
- Write deepDive.hindi only after the five English fields and possibleMainsQuestion are final.
- Translate those verified fields faithfully into natural Devanagari Hindi. Do not summarise, reinterpret or add any fact.
- Preserve every name, date, figure, percentage and Arabic-number token exactly. Keep each translated item aligned with its English item.
- Keep the same number and order of keyHighlights, keyConcepts and wayForward items.
- Keep every keyConcept term exactly the same as its English term; translate only its definition. Retaining an official English technical term is preferable to inventing an unclear Hindi equivalent.
- Translate possibleMainsQuestion with the same analytical demand and scope.
- This Hindi study note is separate from audioScriptHi, which should remain naturally spoken Hinglish in Latin script.

HARD RULES:
- globalNews is an editorial inclusion flag for the strictly International Relations Global News section. Set it to true only when category is "International Relations" and the story is internationally consequential diplomacy, geopolitics, a treaty, conflict, multilateral action or a global-order development. Set it to false for domestic-only stories, including stories where foreign names or places are merely incidental.
- For a bilateral India–X Global News story, anchor location in X, the foreign counterpart — never default to New Delhi or India. For a multilateral or conflict story, anchor the actual overseas venue, affected region or principal foreign focal point. Use India only when an internationally consequential event physically occurs there and India is the essential venue.
- location.countryCode must be the ISO 3166-1 alpha-2 code for that anchor. Examples: an India–U.S. story uses US; India–Japan uses JP; a Strait of Hormuz event uses the country code of the specific event anchor identified by the source.
- Do not create any additional section names.
- Do not use phrases such as "UPSC lens", "editorial briefing", "interlinkages", "prelims nuggets", "mains framework", "memory aid" or "things not mentioned".
- Remove jargon where plain English works. If a technical term is essential, define it in keyConcepts.
- Keep each bullet to one useful sentence. Avoid repeating the summary in multiple sections.
- Do NOT invent facts. If the source does not support a claim, leave it out.

=== PRELIMS MCQ QUALITY BAR ===
Create exactly two questions and use two different authentic UPSC formats: count-based statements, statement combinations, Statement I-II-III reasoning, correctly matched pairs, or an applied one-best-answer question.

- Question 1 must test the verified current development through its mechanism, implication or institutional setting; never ask for simple headline recall.
- Question 2 must test a directly relevant static-current linkage.
- Use 2-4 independently testable statements where the selected format calls for them. Keep their length and difficulty comparable.
- Make distractors plausible by changing one precise element such as the institution, jurisdiction, mechanism, condition, location or scope.
- Keep options mutually exclusive, grammatically parallel and logically compatible with the stem. Exactly one option must be defensible.
- Do not use silly distractors, giveaway wording, vague claims or unsupported trivia.
- Write an 80-160 word explanation that evaluates every statement or pair separately, including why each incorrect item is wrong.
- Use clean English and consistent Roman numbering. Do not copy OCR mistakes or include option labels inside option strings.

=== CONTENT GUIDELINES (section order + prelims + mains standards) ===
${GUIDELINES}

=== NARRATION SPEC for audioScript (follow strictly) ===
${NARRATION_SPEC}`
}

const wordCount = s => (s || '').trim().split(/\s+/).filter(Boolean).length
const stripTags = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const hasDevanagari = s => typeof s === 'string' && /[\u0900-\u097F]/.test(s)
const numericTokens = s => (typeof s === 'string' ? s.match(/\d+(?:[.,]\d+)*/g) : null) ?? []
const preservesNumbers = (english, hindi) => {
  const left = numericTokens(english).sort()
  const right = numericTokens(hindi).sort()
  return left.length === right.length && left.every((token, index) => token === right[index])
}

function hindiDeepDiveProblems(dive) {
  const problems = []
  const hindi = dive?.hindi
  if (!hindi || typeof hindi !== 'object') return ['deepDive.hindi missing']
  if (!hasDevanagari(hindi.syllabusLinkage)) problems.push('deepDive.hindi.syllabusLinkage needs natural Devanagari Hindi')
  if (!hasDevanagari(hindi.context)) problems.push('deepDive.hindi.context needs natural Devanagari Hindi')
  if (!hasDevanagari(hindi.possibleMainsQuestion)) problems.push('deepDive.hindi.possibleMainsQuestion missing or not in Devanagari Hindi')

  for (const field of ['keyHighlights', 'keyConcepts', 'wayForward']) {
    if (!Array.isArray(hindi[field]) || !Array.isArray(dive[field]) || hindi[field].length !== dive[field].length) {
      problems.push(`deepDive.hindi.${field} must match the English item count`)
    }
  }

  const pairs = [
    ['syllabusLinkage', dive.syllabusLinkage, hindi.syllabusLinkage],
    ['context', dive.context, hindi.context],
    ['possibleMainsQuestion', dive.possibleMainsQuestion, hindi.possibleMainsQuestion],
  ]
  if (Array.isArray(dive.keyHighlights) && Array.isArray(hindi.keyHighlights)) {
    dive.keyHighlights.forEach((item, index) => pairs.push([`keyHighlights[${index}]`, item, hindi.keyHighlights[index]]))
  }
  if (Array.isArray(dive.wayForward) && Array.isArray(hindi.wayForward)) {
    dive.wayForward.forEach((item, index) => pairs.push([`wayForward[${index}]`, item, hindi.wayForward[index]]))
  }
  if (Array.isArray(dive.keyConcepts) && Array.isArray(hindi.keyConcepts)) {
    dive.keyConcepts.forEach((concept, index) => {
      const translated = hindi.keyConcepts[index]
      if (typeof translated?.term !== 'string' || translated.term.trim() !== concept?.term?.trim()) {
        problems.push(`deepDive.hindi.keyConcepts[${index}].term must exactly match English`)
      }
      if (!hasDevanagari(translated?.definition)) problems.push(`deepDive.hindi.keyConcepts[${index}].definition needs Devanagari Hindi`)
      pairs.push([`keyConcepts[${index}]`, `${concept?.term ?? ''} ${concept?.definition ?? ''}`, `${translated?.term ?? ''} ${translated?.definition ?? ''}`])
    })
  }

  for (const [label, english, translation] of pairs) {
    if (!hasDevanagari(translation)) problems.push(`deepDive.hindi.${label} needs Devanagari Hindi`)
    if (!preservesNumbers(english, translation)) problems.push(`deepDive.hindi.${label} changes or drops a numeric fact`)
  }
  return [...new Set(problems)]
}

// Code-level quality gate for the Deep Dive. Weak, list-dumpy, or jargon-heavy
// explanations are rejected here so the generator retries with the quality bar.
function deepDiveProblems(dive) {
  const problems = []
  if (!dive || typeof dive !== 'object') return ['deepDive missing']
  const html = dive.explanation
  if (!html || typeof html !== 'string') return ['deepDive.explanation missing']
  if (/<script|<style|<h[1-6]|<iframe|<div|<table/i.test(html)) problems.push('deepDive explanation should contain simple paragraphs only')
  if (/[#*_]{2,}|^\s*[-*]\s/m.test(html.replace(/<[^>]+>/g, ''))) problems.push('deepDive contains markdown (use HTML)')

  const totalWords = wordCount(stripTags(html))
  if (totalWords < 220) problems.push(`deepDive explanation too short (${totalWords} words, need 220+)`)
  if (totalWords > 650) problems.push(`deepDive explanation too long (${totalWords} words, keep below 650)`)
  if (!/<p[ >]/i.test(html)) problems.push('deepDive should use <p> paragraphs')
  if (typeof dive.syllabusLinkage !== 'string' || wordCount(dive.syllabusLinkage) < 3 || !/\bGS\s*(?:I{1,3}|IV|[1-4])\b/i.test(dive.syllabusLinkage)) problems.push('deepDive needs a clear GS syllabusLinkage')
  if (typeof dive.context !== 'string' || wordCount(dive.context) < 18 || wordCount(dive.context) > 100) problems.push('deepDive context must be 18-100 words')
  if (!Array.isArray(dive.keyHighlights) || dive.keyHighlights.length < 4 || dive.keyHighlights.length > 6) problems.push('deepDive needs 4-6 keyHighlights')
  else if (dive.keyHighlights.some(item => typeof item !== 'string' || wordCount(item) < 8 || wordCount(item) > 45)) problems.push('each keyHighlight must be one clear 8-45 word sentence')
  if (!Array.isArray(dive.keyConcepts) || dive.keyConcepts.length < 3 || dive.keyConcepts.length > 6) problems.push('deepDive needs 3-6 keyConcepts')
  else for (const concept of dive.keyConcepts) {
    if (!concept?.term || !concept?.definition || wordCount(concept.definition) < 7) problems.push('each keyConcept needs a term and plain definition')
  }
  if (!Array.isArray(dive.wayForward) || dive.wayForward.length < 3 || dive.wayForward.length > 6) problems.push('deepDive needs 3-6 wayForward actions')
  else if (dive.wayForward.some(item => typeof item !== 'string' || wordCount(item) < 6 || wordCount(item) > 40)) problems.push('each wayForward item must be a specific 6-40 word action')
  if (/one-line summary|explain like i.?m a upsc aspirant|revision notes|upsc lens|interlinkages|prelims nuggets|mains framework/i.test(`${stripTags(html)} ${dive.context}`)) problems.push('deepDive uses retired labels or jargon')
  problems.push(...hindiDeepDiveProblems(dive))
  return problems
}

function statementLabels(stem) {
  const dotted = [...(stem || '').matchAll(/(?:^|\s)(I{1,3}|IV|V|[1-5])\.\s+/g)].map(match => match[1].toUpperCase())
  const labelled = [...(stem || '').matchAll(/\bStatement\s+(I{1,3}|IV|V|[1-5])\s*:/gi)].map(match => match[1].toUpperCase())
  return [...new Set([...dotted, ...labelled])]
}

function prelimsFormat(stem = '') {
  if (/\bStatement\s+I\s*:/i.test(stem) && /\bStatement\s+II\s*:/i.test(stem)) return 'reasoning'
  if (/following pairs|pairs? given above|correctly matched/i.test(stem)) return 'pairs'
  if (/how many of (?:the above|them|the statements|the pairs)/i.test(stem)) return 'count'
  if (/which of the statements|which of the following statements|select the correct answer using the code/i.test(stem)) return 'combination'
  if (/which one of the following|common characteristic|best describes/i.test(stem)) return 'one-best'
  return null
}

function answerMarksEveryItemCorrect(q, labels, format) {
  const selected = q?.options?.[q.answer] ?? ''
  if (format === 'count' || format === 'pairs') return /\ball\b/i.test(selected)
  if (format === 'reasoning') return /both Statement II and Statement III are correct/i.test(selected)
  return labels.length > 0 && labels.every(item => new RegExp(`\\b${item}\\b`, 'i').test(selected))
}

function explanationAssessesItem(explanation, item) {
  return new RegExp(`\\b${item}\\b`, 'i').test(explanation || '')
}

function prelimsQuestionProblems(q, index) {
  const label = `prelimsQs[${index}]`
  const problems = []
  if (!q?.q || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) {
    return [`${label} is malformed`]
  }
  const format = prelimsFormat(q.q)
  const options = q.options.map(option => typeof option === 'string' ? option.trim() : '')
  if (!format) problems.push(`${label} does not use an approved UPSC question format`)
  if (wordCount(q.q) < 14) problems.push(`${label} stem is too thin for applied UPSC testing`)
  if (options.some(option => option.length < 2 || /^\([a-d]\)\s*/i.test(option))) problems.push(`${label} has empty options or embeds option labels`)
  if (new Set(options.map(option => option.toLowerCase())).size !== 4) problems.push(`${label} options must be unique`)
  if ((format === 'count' || format === 'pairs') && options.some(option => !/^(?:only (?:one|two|three|four)|all (?:the )?(?:two|three|four|five)|none)$/i.test(option))) {
    problems.push(`${label} count-question options are not logically coherent`)
  }
  if (format === 'reasoning' && options.some(option => !/statement|neither/i.test(option))) {
    problems.push(`${label} reasoning options must use the Statement I-II-III explanation pattern`)
  }
  if (/\bis\s*:\s*$|\brefers to\s*:\s*$|\bassociated with\s*:\s*$|\bunder which law\??$/i.test(q.q.trim())) {
    problems.push(`${label} is direct recall rather than applied testing`)
  }

  const explanationWords = wordCount(q.explanation)
  if (explanationWords < 65 || explanationWords > 220) problems.push(`${label} explanation must be 65-220 words`)
  const labels = statementLabels(q.q)
  if (labels.length >= 2) {
    for (const item of labels) {
      if (!explanationAssessesItem(q.explanation, item)) {
        problems.push(`${label} explanation must assess ${format === 'pairs' ? 'Pair' : 'Statement'} ${item} separately`)
      }
    }
    if (!answerMarksEveryItemCorrect(q, labels, format) &&
        !/incorrect|not correct|false|wrong|does not|do not|cannot|misstates|confuses/i.test(q.explanation || '')) problems.push(`${label} explanation must state why an item is incorrect`)
  }
  return problems
}

function validateArticle(a) {
  const problems = []
  for (const k of ['id', 'headline', 'date', 'source', 'category', 'gsPaper', 'globalNews', 'summary', 'whyItMatters', 'deepDive', 'audioScript', 'audioScriptHi', 'prelimsQs', 'keyTerms', 'location']) {
    if (a?.[k] === undefined || a[k] === null || a[k] === '') problems.push(`missing ${k}`)
  }
  if (typeof a?.globalNews !== 'boolean') problems.push('globalNews must be a boolean')
  if (a?.globalNews === true && a.category !== 'International Relations') problems.push('globalNews can only be true for International Relations articles')
  if (a?.deepDive) {
    problems.push(...deepDiveProblems(a.deepDive))
    const q = a.deepDive.possibleMainsQuestion || ''
    if (!/\b(analyse|analyze|examine|discuss|evaluate|critically|comment|assess)\b/i.test(q)) problems.push('mains question not analytical')
  }
  for (const [field, label] of [['audioScript', 'English'], ['audioScriptHi', 'Hinglish']]) {
    if (a?.[field]) {
      const scriptWords = wordCount(a[field])
      if (scriptWords < 250) problems.push(`${label} audioScript too short (${scriptWords} words, need 250+)`)
      if (scriptWords > 550) problems.push(`${label} audioScript too long (${scriptWords} words, keep below 550)`)
      if (/<[a-z]+[ >]/i.test(a[field])) problems.push(`${label} audioScript contains HTML`)
      if (/^\s*\d+\.\s|:\s*$/m.test(a[field])) problems.push(`${label} audioScript has list/label formatting (must be flowing speech)`)
      if (/\b(ask yourself|upsc expects|one level deeper|value addition|mains framework|interlinkages|stakeholders?|case study)\b/i.test(a[field])) problems.push(`${label} audioScript contains coaching jargon or lecture filler`)
      if (!/\b(but|however|although|the real|larger point|will depend|depends on)\b/i.test(a[field])) problems.push(`${label} audioScript needs a balanced concern or clear concluding takeaway`)
    }
  }
  if (Array.isArray(a?.prelimsQs)) {
    a.prelimsQs.forEach((q, index) => problems.push(...prelimsQuestionProblems(q, index)))
    if (a.prelimsQs.length !== 2) problems.push('needs exactly 2 prelims questions')
    const formats = a.prelimsQs.map(q => prelimsFormat(q?.q)).filter(Boolean)
    if (formats.length === a.prelimsQs.length && new Set(formats).size < 2) problems.push('the two prelims questions must use different UPSC formats')
  } else problems.push('prelimsQs not an array')
  if (a?.location && (typeof a.location.lat !== 'number' || typeof a.location.lon !== 'number')) problems.push('bad location')
  if (a?.location && !/^[A-Z]{2}$/.test(a.location.countryCode || '')) problems.push('location.countryCode must be an ISO alpha-2 code')
  return problems
}

export async function generateArticle({ cluster, date, index, engine }) {
  const articleId = articleIdFor(date, index)
  const sourceTexts = await enrichCluster(cluster)
  const prompt = generatorPrompt({ cluster, sourceTexts, date, articleId })

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callLLM({ prompt, system: GENERATOR_SYSTEM, tier: 'smart', maxTokens: 16000, engine, retries: 0 })
      const article = extractJson(text)
      article.id = articleId
      article.date = date
      const problems = validateArticle(article)
      if (problems.length === 0) return article
      console.warn(`  [generate] ${articleId} attempt ${attempt + 1} invalid: ${problems.join('; ')}`)
    } catch (err) {
      console.warn(`  [generate] ${articleId} attempt ${attempt + 1} failed: ${err.message.slice(0, 160)}`)
    }
  }
  throw new Error(`could not produce valid article for ${cluster.eventKey}`)
}

export function articleIdFor(date, index) {
  return `ca${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}-${String(index + 1).padStart(2, '0')}`
}

export async function generateAll(clusters, { date, engine = 'auto', concurrency = 3, existingIds = new Set() } = {}) {
  const results = new Array(clusters.length).fill(null)
  let cursor = 0
  async function worker() {
    while (cursor < clusters.length) {
      const i = cursor++
      const c = clusters[i]
      if (c.skip) { console.log(`  [generate] ${i + 1}/${clusters.length} ${c.eventKey} — marked skip`); continue }
      if (existingIds.has(articleIdFor(date, i))) { console.log(`  [generate] ${i + 1}/${clusters.length} ${c.eventKey} — already in pack`); continue }
      console.log(`  [generate] ${i + 1}/${clusters.length} ${c.eventKey}`)
      try {
        results[i] = await generateArticle({ cluster: c, date, index: i, engine })
      } catch (err) {
        console.warn(`  [generate] SKIPPED ${c.eventKey}: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, clusters.length) }, worker))
  return results.filter(Boolean)
}
