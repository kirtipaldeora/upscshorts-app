#!/usr/bin/env node
// Penni daily news pipeline.
//
//   node scripts/news-pipeline/run.mjs                  # full run for today (IST)
//   node scripts/news-pipeline/run.mjs --skip-generate  # fetch + filter only (fast preview)
//   node scripts/news-pipeline/run.mjs --date 2026-07-11 --max 14 --min-score 6
//   node scripts/news-pipeline/run.mjs --engine api     # force Anthropic API (CI)
//
// Engine: uses ANTHROPIC_API_KEY when set (CI), otherwise the local `claude`
// CLI login. Artifacts land in content-pipeline/runs/<date>/ (audit trail) and
// the final pack in app/public/data/articles/<date>.json + index.json.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { istDateString, parseArgs } from './lib/util.mjs'
import { fetchAllSources } from './lib/sources.mjs'
import { heuristicPrefilter, llmScore, clusterEvents } from './lib/filter.mjs'
import { generateAll } from './lib/generate.mjs'
import { resolveEngine } from './lib/llm.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = parseArgs(process.argv)

const date = args.date || istDateString()
const hours = Number(args.hours || 26)
const maxStories = Number(args.max || 14)
const minScore = Number(args['min-score'] || 6)
const engine = args.engine || 'auto'

const runDir = path.join(ROOT, 'content-pipeline/runs', date)
mkdirSync(runDir, { recursive: true })
const save = (name, data) => writeFileSync(path.join(runDir, name), JSON.stringify(data, null, 1))

console.log(`Penni news pipeline — ${date} (engine: ${resolveEngine(engine)})`)

let clusters
if (args['from-selected']) {
  // Reuse a previous run's selection (skips fetch + scoring) — for retrying
  // generation after a failure without paying for re-scoring.
  clusters = JSON.parse(readFileSync(path.join(runDir, 'selected.json'), 'utf8'))
  console.log(`\nReusing ${clusters.length} stories from selected.json (--from-selected).`)
} else {
  console.log('\n[1/4] Fetching sources…')
  const raw = await fetchAllSources({ hours, date })
  save('raw.json', raw)
  console.log(`  total fetched: ${raw.length}`)

  console.log('\n[2/4] Heuristic prefilter…')
  const prefiltered = heuristicPrefilter(raw)
  console.log(`  survived: ${prefiltered.length} (dropped ${raw.length - prefiltered.length})`)

  console.log('\n[3/4] LLM relevance scoring…')
  const scored = await llmScore(prefiltered, { engine })
  save('scored.json', scored) // full audit trail: every item + score
  clusters = clusterEvents(scored, { minScore, maxStories })
  save('selected.json', clusters)
}
console.log(`  selected ${clusters.length} stories (score >= ${minScore}):`)
for (const c of clusters) console.log(`   ${String(c.score).padStart(2)}  [${c.gsPaper} ${c.category}] ${c.title}  {${c.members.map(m => m.sourceKey).join(',')}}`)

if (args['skip-generate']) {
  console.log('\n--skip-generate set: stopping after selection. Review selected.json.')
  process.exit(0)
}

console.log('\n[4/4] Generating articles…')
const packPathEarly = path.join(ROOT, 'app/public/data/articles', `${date}.json`)
const existingIds = new Set(
  existsSync(packPathEarly) ? (JSON.parse(readFileSync(packPathEarly, 'utf8'))[date] || []).map(a => a.id) : []
)
const articles = await generateAll(clusters, { date, engine, existingIds })
console.log(`  generated ${articles.length}/${clusters.length}`)
if (articles.length === 0) {
  console.error('No articles generated; aborting without touching app data.')
  process.exit(1)
}

if (args.dry) {
  save('articles.json', { [date]: articles })
  console.log(`\n--dry set: wrote pack to ${path.relative(ROOT, runDir)}/articles.json only.`)
  process.exit(0)
}

const packPath = path.join(ROOT, 'app/public/data/articles', `${date}.json`)
const existing = existsSync(packPath) ? JSON.parse(readFileSync(packPath, 'utf8')) : {}
const merged = existing[date]?.length ? [...existing[date], ...articles.filter(a => !existing[date].some(e => e.id === a.id))] : articles
writeFileSync(packPath, JSON.stringify({ [date]: merged }, null, 1))

const indexPath = path.join(ROOT, 'app/public/data/articles/index.json')
const index = JSON.parse(readFileSync(indexPath, 'utf8'))
if (!index.dates.includes(date)) {
  index.dates.unshift(date)
  index.dates.sort((a, b) => (a > b ? -1 : 1))
  writeFileSync(indexPath, JSON.stringify(index, null, 2))
}

console.log(`\nDone. ${merged.length} articles in ${path.relative(ROOT, packPath)}; index updated.`)
