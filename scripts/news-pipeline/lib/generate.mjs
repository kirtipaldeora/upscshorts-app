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
  "summary": "2-3 sentence factual summary",
  "whyItMatters": "2-3 sentences on why a UPSC aspirant must care",
  "deepDive": {
    "explanation": "HTML string — see DEEP DIVE QUALITY BAR below",
    "possibleMainsQuestion": "one Mains question asking to analyse/examine/discuss/evaluate"
  },
  "audioScript": "continuous English narration per the narration spec below, 700-1100 words, no markdown, no labels",
  "audioScriptHi": "the same lecture in natural Hinglish (Hindi-English classroom mix, Latin script), same depth, 700-1100 words",
  "prelimsQs": [two UPSC-standard questions per the guidelines: {"q","options"(4),"answer"(0-indexed),"explanation","ref"}],
  "keyTerms": [4-7 key terms],
  "location": {"lat": number, "lon": number, "place": "most relevant place for the news globe"}
}

=== DEEP DIVE QUALITY BAR (this is what a good deepDive.explanation looks like) ===
The Deep Dive is the heart of the article. A student should WANT to read it. Write it like the best teacher you have ever had explaining something fascinating — warm, clear, and building understanding step by step. It must NOT read like a filled-in form or a list of bullet points under labels.

Keep the SAME 16 section labels from the guidelines below (so the app renders them), formatted exactly as <strong>1. One-Line Summary:</strong> … <strong>16. Revision Notes:</strong>. But treat each label as the START of a real explanation, not a slot to dump a phrase into:

WRITE LIKE THIS:
- Open section 2 with a genuine hook or a question that makes the student curious ("Imagine you run a country that imports 80% of its oil. One narrow sea lane decides your fuel prices. That lane is the Strait of Hormuz.").
- Explain every concept from first principles as if the student has never heard it. When you must use a technical term, define it in the same breath in plain words. Prefer "the money a country owes to the rest of the world" over "external liabilities".
- Use short paragraphs (2-4 sentences). Vary rhythm. Use a real-world analogy or comparison at least twice. Show cause and effect as a chain the reader can follow, not as a heading.
- Sound human. Use "you", "notice", "here is the interesting part", "so what does this mean". Never sound like Wikipedia or a press release.
- Be substantive: teach real static concepts, name the actual Articles/Acts/committees/treaties and say what they DO, give numbers and context. Never pad with empty sentences.

HARD RULES (your output is rejected by an automated checker if you break these):
- Every one of the 16 sections must have real teaching content — at least ~30 words of substance. No empty or one-line sections.
- No unexplained jargon. If you write an abbreviation or technical term, its meaning must appear right there.
- At least 900 words total across the explanation; use <p>, <ul>, <li>, <strong> tags only (no markdown, no <h1>/<script>/<style>).
- Do NOT invent facts. If the source text is thin, teach the surrounding static concepts accurately instead of inventing specifics.

=== CONTENT GUIDELINES (section order + prelims + mains standards) ===
${GUIDELINES}

=== NARRATION SPEC for audioScript (follow strictly) ===
${NARRATION_SPEC}`
}

const wordCount = s => (s || '').trim().split(/\s+/).filter(Boolean).length
const stripTags = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

// Code-level quality gate for the Deep Dive. Weak, list-dumpy, or jargon-heavy
// explanations are rejected here so the generator retries with the quality bar.
function deepDiveProblems(html) {
  const problems = []
  if (!html || typeof html !== 'string') return ['deepDive.explanation missing']
  if (/<script|<style|<h1|<iframe/i.test(html)) problems.push('deepDive has forbidden tags')
  if (/[#*_]{2,}|^\s*[-*]\s/m.test(html.replace(/<[^>]+>/g, ''))) problems.push('deepDive contains markdown (use HTML)')

  // All 16 labelled sections present, in order, each with real content.
  const labelRe = /<strong>\s*(\d{1,2})\.\s*[^<]*?:?\s*<\/strong>/g
  const positions = []
  let m
  while ((m = labelRe.exec(html))) positions.push({ n: Number(m[1]), end: labelRe.lastIndex })
  const nums = positions.map(p => p.n)
  for (let i = 1; i <= 16; i++) if (!nums.includes(i)) problems.push(`deepDive missing section ${i}`)

  // Each section must carry substance (~25+ words of plain text after its label).
  for (let i = 0; i < positions.length; i++) {
    const from = positions[i].end
    const to = i + 1 < positions.length ? html.indexOf('<strong>', from) : html.length
    const words = wordCount(stripTags(html.slice(from, to < 0 ? html.length : to)))
    if (words < 22) problems.push(`deepDive section ${positions[i].n} too thin (${words} words)`)
  }

  const totalWords = wordCount(stripTags(html))
  if (totalWords < 750) problems.push(`deepDive too short (${totalWords} words, need 750+)`)
  if (!/<p[ >]/i.test(html)) problems.push('deepDive should use <p> paragraphs')
  return problems
}

function validateArticle(a) {
  const problems = []
  for (const k of ['id', 'headline', 'date', 'source', 'category', 'gsPaper', 'summary', 'whyItMatters', 'deepDive', 'audioScript', 'audioScriptHi', 'prelimsQs', 'keyTerms', 'location']) {
    if (a?.[k] === undefined || a[k] === null || a[k] === '') problems.push(`missing ${k}`)
  }
  if (a?.deepDive) {
    problems.push(...deepDiveProblems(a.deepDive.explanation))
    const q = a.deepDive.possibleMainsQuestion || ''
    if (!/\b(analyse|analyze|examine|discuss|evaluate|critically|comment|assess)\b/i.test(q)) problems.push('mains question not analytical')
  }
  for (const [field, label] of [['audioScript', 'English'], ['audioScriptHi', 'Hinglish']]) {
    if (a?.[field]) {
      if (wordCount(a[field]) < 550) problems.push(`${label} audioScript too short (${wordCount(a[field])} words)`)
      if (/<[a-z]+[ >]/i.test(a[field])) problems.push(`${label} audioScript contains HTML`)
      if (/^\s*\d+\.\s|:\s*$/m.test(a[field])) problems.push(`${label} audioScript has list/label formatting (must be flowing speech)`)
    }
  }
  if (Array.isArray(a?.prelimsQs)) {
    for (const q of a.prelimsQs) {
      if (!q.q || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) problems.push('malformed prelims question')
      if (q.explanation && wordCount(q.explanation) < 20) problems.push('prelims explanation too thin')
    }
    if (a.prelimsQs.length < 2) problems.push('needs 2 prelims questions')
  } else problems.push('prelimsQs not an array')
  if (a?.location && (typeof a.location.lat !== 'number' || typeof a.location.lon !== 'number')) problems.push('bad location')
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
