#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const input = process.argv[2]
const outputRoot = resolve(process.argv[3] ?? 'app/public/data/pyq')

if (!input) {
  console.error('Usage: node scripts/pyq/import-pw-book.mjs <extracted-book.txt> [output-dir]')
  process.exit(1)
}

const raw = await readFile(resolve(input), 'utf8')
const lines = raw.replace(/\r/g, '').split('\n')

const SUBJECT_RANGES = [
  [3884, 5936, 'Ancient History'],
  [5936, 8339, 'Medieval History'],
  [8339, 14873, 'Modern History'],
  [14873, 17272, 'Art and Culture'],
  [17272, 26774, 'Polity'],
  [26774, 38597, 'Economy'],
  [38597, 52341, 'Geography'],
  [52341, 59324, 'Environment'],
  [59324, 71881, 'Science and Tech'],
  [71881, 76444, 'International Relations'],
  [76444, Number.POSITIVE_INFINITY, 'Current Affairs'],
]

const SUBJECT_KEYWORDS = {
  'Ancient History': ['harappan', 'vedic', 'maurya', 'gupta', 'ashoka', 'buddhist', 'jain', 'sangam', 'ancient'],
  'Medieval History': ['sultanate', 'mughal', 'bhakti', 'sufi', 'vijayanagara', 'medieval'],
  'Modern History': ['gandhi', 'british', 'colonial', 'congress', 'freedom', 'viceroy', 'national movement'],
  'Art and Culture': ['dance', 'music', 'temple', 'architecture', 'painting', 'literature', 'culture', 'sculpture'],
  Polity: ['constitution', 'parliament', 'president', 'governor', 'court', 'article', 'rights', 'election', 'panchayat'],
  Economy: ['rbi', 'bank', 'inflation', 'gdp', 'fiscal', 'monetary', 'tax', 'market', 'finance', 'agriculture'],
  Geography: ['river', 'ocean', 'climate', 'monsoon', 'soil', 'latitude', 'mountain', 'plateau', 'geography'],
  Environment: ['species', 'ecosystem', 'biodiversity', 'pollution', 'climate change', 'wildlife', 'forest', 'convention'],
  'Science and Tech': ['technology', 'battery', 'space', 'satellite', 'disease', 'cell', 'chemical', 'physics', 'biology', 'uav'],
  'International Relations': ['country', 'united nations', 'treaty', 'international', 'border', 'organization', 'grouping'],
  'Current Affairs': ['scheme', 'report', 'index', 'mission', 'initiative', 'recently', 'media'],
}

const STOPWORDS = new Set(`about above according after against among and are been before being below between both but can consider correct could does each following from given have into india indian many more most not only option other over reference should statement statements than that the their them there these they this those through types under using what when where which while with would year`.split(/\s+/))

function cleanLine(value) {
  return value
    .replace(/\f/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\u00ad/g, '')
    .replace(/Download All UPSC Test Series From:\s*https?:\/\/www\.pdfnotes\.co\/?/gi, ' ')
    .replace(/UPSC CSE Prelims 2025 GS Paper-I\s*\(Questions and Explanation\)\s*\d*/gi, ' ')
    .replace(/\b\d{1,3}\s+UPSC GS Paper-I PYQs\b/gi, ' ')
    .replace(/\bUPSC GS Paper-I PYQs\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isJunk(value) {
  const line = cleanLine(value)
  return !line ||
    /^Download All UPSC Test Series From:/i.test(line) ||
    /^UPSC GS Paper-I PYQs$/i.test(line) ||
    /^\d{1,3}$/.test(line) ||
    /^(Ancient History|Medieval History|Modern History|Art and Culture|Polity|Indian Economy|Geography|Environment and Ecology|Science and Technology|International Relations and Current Affairs|General Knowledge \(1995-2010\)) \d+$/i.test(line)
}

function joinText(parts) {
  return parts
    .filter(part => !isJunk(part))
    .map(cleanLine)
    .join(' ')
    .replace(/([a-z])\- ([a-z])/g, '$1$2')
    .replace(/\s+([,.;:?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTopic(value) {
  return cleanLine(value)
    .replace(/^\d+\.\s*/, '')
    .replace(/[.:]+$/, '')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function subjectAt(index) {
  return SUBJECT_RANGES.find(([start, end]) => index >= start && index < end)?.[2] ?? 'Current Affairs'
}

const topicMarkers = []
for (let index = 3884; index < lines.length; index++) {
  const line = cleanLine(lines[index])
  if (/^\d{1,2}\.\s+[A-Z][A-Z0-9 &:/(),\-]+$/.test(line)) {
    let title = line
    const next = cleanLine(lines[index + 1] ?? '')
    if (title.length < 44 && /^[A-Z][A-Z0-9 &:/(),\-]+$/.test(next) && !/^\d+\./.test(next)) title += ` ${next}`
    topicMarkers.push({ index, subject: subjectAt(index), topic: normalizeTopic(title) })
  }
}

function topicAt(index, subject) {
  let found = null
  for (const marker of topicMarkers) {
    if (marker.index > index) break
    if (marker.subject === subject) found = marker.topic
  }
  return found ?? subject
}

function classify2025(text) {
  const lower = text.toLowerCase()
  let best = 'Current Affairs'
  let bestScore = 0
  for (const [subject, words] of Object.entries(SUBJECT_KEYWORDS)) {
    const score = words.reduce((sum, word) => sum + (lower.includes(word) ? (word.includes(' ') ? 2 : 1) : 0), 0)
    if (score > bestScore) { best = subject; bestScore = score }
  }
  return best
}

function optionSequence(text) {
  return allOptionSequences(text)[0] ?? null
}

function allOptionSequences(text) {
  const found = [...text.matchAll(/\(([a-d])\)/gi)].map(match => ({ key: match[1].toLowerCase(), index: match.index }))
  const groups = []
  let cursor = 0
  for (let a = 0; a < found.length; a++) {
    if (found[a].index < cursor) continue
    if (found[a].key !== 'a') continue
    const b = found.findIndex((entry, index) => index > a && entry.key === 'b')
    const c = found.findIndex((entry, index) => index > b && entry.key === 'c')
    const d = found.findIndex((entry, index) => index > c && entry.key === 'd')
    if (b > a && c > b && d > c) {
      groups.push([found[a], found[b], found[c], found[d]])
      cursor = found[d].index + 3
      a = d
    }
  }
  return groups
}

function looksLikeQuestionStart(index, allow2025 = false) {
  const match = cleanLine(lines[index]).match(/^(\d{1,3})\.\s+(.+)/)
  if (!match) return null
  if (match[2] === match[2].toUpperCase() && /[A-Z]{4}/.test(match[2])) return null
  const lookahead = joinText(lines.slice(index, Math.min(lines.length, index + 82)))
  const options = optionSequence(lookahead)
  if (!options) return null
  const beforeOptions = lookahead.slice(0, options[0].index)
  const yearMatches = [...beforeOptions.matchAll(/\((19\d{2}|20\d{2})\)/g)]
  const firstYearIndex = yearMatches[0]?.index ?? Number.POSITIVE_INFINITY
  const nestedQuestion = beforeOptions.slice(3, firstYearIndex).match(/\b\d{1,3}\.\s+(?:Consider|With reference|Which|Who|What|Match|Assertion|Regarding|In which|How many|Where is|Under which|Among the)\b/i)
  if (nestedQuestion) return null
  const years = yearMatches
    .map(match => Number(match[1]))
    .filter(value => value >= 1995 && value <= 2024)
  const year = years.at(-1)
  if (!year && !allow2025) return null
  return { qno: Number(match[1]), year: year ?? 2025 }
}

const starts = []
const answer2025Indexes = []
for (let index = 224; index < Math.min(3884, lines.length); index++) {
  if (/^Ans\s*[:.]\s*\([a-d]/i.test(cleanLine(lines[index]))) answer2025Indexes.push(index)
}
let segmentStart = 224
for (let questionNumber = 1; questionNumber <= Math.min(100, answer2025Indexes.length); questionNumber++) {
  const answerIndex = answer2025Indexes[questionNumber - 1]
  const candidates = []
  for (let index = segmentStart; index < answerIndex; index++) {
    const candidate = looksLikeQuestionStart(index, true)
    if (candidate?.qno === questionNumber) candidates.push({ ...candidate, index })
  }
  const preferred = candidates.find(candidate => /^(?:Consider|With reference|Which|Who|What|Match|Assertion|Regarding|In which|How many|Where|Under|Among|The |If )/i.test(cleanLine(lines[candidate.index]).replace(/^\d{1,3}\.\s*/, '')))
  const chosen = preferred ?? candidates[0]
  if (chosen) starts.push(chosen)
  segmentStart = answerIndex + 1
}

for (let index = 3884; index < lines.length; index++) {
  const candidate = looksLikeQuestionStart(index, index < 3884)
  if (!candidate) continue
  starts.push({ ...candidate, index })
}

function findQuestionParts(candidate) {
  const entries = []
  let joined = ''
  for (let index = candidate.index; index < Math.min(lines.length, candidate.index + 180); index++) {
    const text = cleanLine(lines[index])
    entries.push({ index, start: joined.length, text })
    joined += `${text} `
  }
  const groups = allOptionSequences(joined)
  if (!groups.length) return null
  let selectedGroup = groups[0]
  let selectedGroupIndex = 0
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex]
    const lowerStartsBefore = starts.filter(start =>
      start.index > candidate.index &&
      start.index < candidate.index + 180 &&
      start.qno < candidate.qno &&
      (entries.find(entry => entry.index === start.index)?.start ?? Number.POSITIVE_INFINITY) < group[0].index,
    ).length
    if (lowerStartsBefore === groupIndex) {
      selectedGroup = group
      selectedGroupIndex = groupIndex
      break
    }
  }
  const nestedStarts = starts
    .filter(start => start.index > candidate.index && start.index < candidate.index + 180 && start.qno < candidate.qno)
    .map(start => entries.find(entry => entry.index === start.index)?.start)
    .filter(value => value !== undefined && value < selectedGroup[0].index)
  const prefixEnd = nestedStarts.length ? Math.min(...nestedStarts) : selectedGroup[0].index
  const stemRaw = joined.slice(0, prefixEnd)
  const options = selectedGroup.map((marker, markerIndex) => {
    const from = marker.index + 3
    const to = selectedGroup[markerIndex + 1]?.index ?? groups[selectedGroupIndex + 1]?.[0].index ?? joined.length
    let option = joined.slice(from, to)
    const boundary = option.search(/\bAns\s*[:.]|\bPW ONLYIAS|\b\d{1,3}\.\s+(?:Consider|Which|With reference|Who|What|Match|Assertion)/i)
    if (boundary >= 0) option = option.slice(0, boundary)
    return option.replace(/\s+/g, ' ').trim()
  })
  const dEntry = [...entries].reverse().find(entry => entry.start <= selectedGroup[3].index)
  return { stemRaw, options, end: dEntry?.index ?? candidate.index }
}

const questions = []
const malformedQuestionPattern = /\b\d{2,3}\.\s+(?:Consider|With reference|Which|Who|What|Match|Assertion|Regarding|In which|How many|Where|Under|Among|The following)\b/i
for (const candidate of starts) {
  const parsed = findQuestionParts(candidate)
  if (!parsed) continue
  const stemWithNumber = parsed.stemRaw
  const stem = stemWithNumber
    .replace(/^\d{1,3}\.\s*/, '')
    .replace(/\s*\((?:19\d{2}|20\d{2})\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const options = parsed.options
  if (stem.length < 12 || options.length !== 4 || options.some(option => option.length < 1 || option.length > 700)) continue
  if (/\bAns\s*[:.]|PW ONLYIAS|UPSC GS Paper-I PYQs/i.test(stem)) continue
  if (malformedQuestionPattern.test(stem.slice(24))) continue
  if (options.some(option =>
    !/[a-z0-9]/i.test(option) ||
    /\([a-d]\)/i.test(option) ||
    malformedQuestionPattern.test(option),
  )) continue
  const subject = candidate.index < 3884 ? classify2025(`${stem} ${options.join(' ')}`) : subjectAt(candidate.index)
  const topic = candidate.index < 3884 ? subject : topicAt(candidate.index, subject)
  questions.push({
    lineStart: candidate.index,
    lineEnd: parsed.end,
    qno: candidate.qno,
    year: candidate.year,
    subject,
    topic,
    stem,
    options,
  })
}

const answerStarts = []
for (let index = 224; index < lines.length; index++) {
  const match = cleanLine(lines[index]).match(/^Ans\s*[:.]\s*\(([a-d])\)\s*(.*)$/i)
  if (match) answerStarts.push({ index, answer: match[1].toLowerCase().charCodeAt(0) - 97, first: match[2] })
}

function cleanAnswerLines(parts) {
  const filtered = parts.filter(({ text }) => !isJunk(text))
  return joinText(filtered.map(part => part.text))
    .replace(/\bPW ONLYIAS SUPER HINT\b/gi, '\n\nSUPER HINT\n')
    .replace(/\bPW ONLYIAS EXTRA EDGE\b/gi, '\n\nEXTRA EDGE\n')
    .replace(/\s*\s*/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const answers = answerStarts.map((entry, answerIndex) => {
  const next = answerStarts[answerIndex + 1]?.index ?? lines.length
  const nextQuestion = starts.find(start => start.index > entry.index)?.index ?? lines.length
  const limit = Math.min(next, nextQuestion, entry.index + 190)
  const parts = [{ index: entry.index, text: entry.first }]
  for (let index = entry.index + 1; index < limit; index++) parts.push({ index, text: lines[index] })
  return { ...entry, text: cleanAnswerLines(parts) }
})

function tokens(value) {
  return [...new Set(value.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [])]
    .filter(token => !STOPWORDS.has(token))
}

function matchScore(question, answer) {
  const questionTokens = tokens(`${question.stem} ${question.options.join(' ')}`)
  const answerText = answer.text.toLowerCase()
  const overlap = questionTokens.reduce((score, token) => score + (answerText.includes(token) ? Math.min(2.2, token.length / 5) : 0), 0)
  const distance = Math.abs(answer.index - question.lineEnd)
  const proximity = Math.max(0, 4.2 - distance / 52)
  const afterBonus = answer.index >= question.lineStart && answer.index <= question.lineEnd + 110 ? 1.4 : 0
  return overlap + proximity + afterBonus
}

const edges = []
for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
  const question = questions[questionIndex]
  for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
    const answer = answers[answerIndex]
    const distance = Math.abs(answer.index - question.lineEnd)
    if (distance > 340) continue
    const score = matchScore(question, answer)
    if (score >= 2.4) edges.push({ questionIndex, answerIndex, score, distance })
  }
}
edges.sort((a, b) => b.score - a.score || a.distance - b.distance)

const matchedQuestions = new Set()
const matchedAnswers = new Set()
const matches = new Map()
for (const edge of edges) {
  if (matchedQuestions.has(edge.questionIndex) || matchedAnswers.has(edge.answerIndex)) continue
  matchedQuestions.add(edge.questionIndex)
  matchedAnswers.add(edge.answerIndex)
  matches.set(edge.questionIndex, { answerIndex: edge.answerIndex, score: edge.score })
}

for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
  if (matchedQuestions.has(questionIndex)) continue
  const question = questions[questionIndex]
  let best = null
  for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
    if (matchedAnswers.has(answerIndex)) continue
    const distance = Math.abs(answers[answerIndex].index - question.lineEnd)
    if (distance > 520 || (best && distance >= best.distance)) continue
    best = { answerIndex, distance }
  }
  if (best) {
    matchedQuestions.add(questionIndex)
    matchedAnswers.add(best.answerIndex)
    matches.set(questionIndex, { answerIndex: best.answerIndex, score: matchScore(question, answers[best.answerIndex]) })
  }
}

function splitSolution(text) {
  const trickMarker = text.indexOf('\n\nSUPER HINT\n')
  const extraMarker = text.indexOf('\n\nEXTRA EDGE\n')
  const firstMarker = [trickMarker, extraMarker].filter(index => index >= 0).sort((a, b) => a - b)[0] ?? text.length
  const detail = text.slice(0, firstMarker).trim()
  const trick = trickMarker >= 0
    ? text.slice(trickMarker + 14, extraMarker > trickMarker ? extraMarker : text.length).trim()
    : undefined
  const extraEdge = extraMarker >= 0
    ? text.slice(extraMarker + 14, trickMarker > extraMarker ? trickMarker : text.length).trim()
    : undefined
  const statements = [...detail.matchAll(/(?:Statement|Pair|Row)\s+([IVX\d()]+)\s+is\s+(correct|incorrect|partially correct)\s*:\s*([\s\S]*?)(?=(?:Statement|Pair|Row)\s+[IVX\d()]+\s+is\s+|$)/gi)]
    .map(match => ({
      label: match[1].replace(/[()]/g, ''),
      verdict: /partial/i.test(match[2]) ? 'partial' : /incorrect/i.test(match[2]) ? 'incorrect' : 'correct',
      text: match[3].trim(),
    }))
  const optionNotes = [...detail.matchAll(/Option\s*\(([a-d])\)\s+is\s+(?:correct|incorrect)\s*:\s*([\s\S]*?)(?=Option\s*\([a-d]\)\s+is\s+|$)/gi)]
    .map(match => ({ option: match[1].toLowerCase().charCodeAt(0) - 97, text: match[2].trim() }))
  return {
    detail,
    ...(statements.length ? { statements } : {}),
    ...(optionNotes.length ? { optionNotes } : {}),
    ...(extraEdge ? { extraEdge } : {}),
    ...(trick ? { trick } : {}),
  }
}

function questionFormat(stem) {
  if (/Statement I|Statement-II|Statement II/i.test(stem)) return 'assertion'
  if (/how many of (?:the )?(?:above|statements|pairs)/i.test(stem)) return 'count'
  if (/pairs?|correctly matched|List-I/i.test(stem)) return 'pairs'
  if (/consider the following statements|which of the statements/i.test(stem)) return 'statements'
  return 'direct'
}

function tagsFor(question) {
  const words = tokens(`${question.stem} ${question.options.join(' ')}`)
    .filter(word => word.length >= 5)
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
  return [...new Set([question.topic, ...words.map(word => word.replace(/\b\w/g, letter => letter.toUpperCase()))])]
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const seenIds = new Map()
const imported = []
const rejected = []
for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
  const question = questions[questionIndex]
  const match = matches.get(questionIndex)
  if (!match) { rejected.push({ reason: 'no-answer', question }); continue }
  const answer = answers[match.answerIndex]
  if (answer.answer < 0 || answer.answer > 3 || answer.text.length < 18) {
    rejected.push({ reason: 'invalid-answer', question }); continue
  }
  const solutionBody = splitSolution(answer.text)
  const baseId = `prelims-${question.year}-${slug(question.subject)}-q${question.qno}`
  const duplicate = seenIds.get(baseId) ?? 0
  seenIds.set(baseId, duplicate + 1)
  const id = duplicate ? `${baseId}-${duplicate + 1}` : baseId
  const format = questionFormat(question.stem)
  imported.push({
    id,
    exam: 'prelims',
    year: question.year,
    paper: 'GS1',
    qno: question.qno,
    subject: question.subject,
    topic: question.topic,
    tags: tagsFor(question),
    format,
    difficulty: format === 'direct' ? 'easy' : format === 'statements' || format === 'pairs' ? 'moderate' : 'hard',
    stem: question.stem,
    options: question.options,
    answer: answer.answer,
    solution: {
      verdict: `Option ${String.fromCharCode(65 + answer.answer)} is correct: ${question.options[answer.answer]}`,
      ...solutionBody,
    },
    _matchScore: Number(match.score.toFixed(2)),
  })
}

imported.sort((a, b) => b.year - a.year || a.subject.localeCompare(b.subject) || a.qno - b.qno)

const byYear = new Map()
for (const question of imported) {
  const clean = { ...question }
  delete clean._matchScore
  if (!byYear.has(question.year)) byYear.set(question.year, [])
  byYear.get(question.year).push(clean)
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
const papers = []
for (const [year, yearQuestions] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
  const file = `prelims-${year}.json`
  await writeFile(resolve(outputRoot, file), `${JSON.stringify(yearQuestions)}\n`)
  const subjects = {}
  for (const question of yearQuestions) subjects[question.subject] = (subjects[question.subject] ?? 0) + 1
  papers.push({ id: `prelims-${year}`, exam: 'prelims', year, paper: 'GS1', file, count: yearQuestions.length, subjects })
}

const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  source: basename(input),
  papers,
  tags: [...new Set(imported.flatMap(question => question.tags))].sort(),
  totals: {
    questions: imported.length,
    papers: papers.length,
    years: papers.map(paper => paper.year),
  },
}
await writeFile(resolve(outputRoot, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const report = {
  sourceLines: lines.length,
  detectedQuestions: questions.length,
  detectedAnswers: answers.length,
  imported: imported.length,
  rejected: rejected.length,
  unmatchedQuestions: questions.length - matches.size,
  unmatchedAnswers: answers.length - matchedAnswers.size,
  lowConfidence: imported.filter(question => question._matchScore < 3.5).length,
  years: Object.fromEntries([...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => [year, items.length])),
}
await mkdir(dirname(resolve(outputRoot, 'import-report.json')), { recursive: true })
await writeFile(resolve(outputRoot, 'import-report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify(report, null, 2))
