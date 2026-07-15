#!/usr/bin/env node
// Manual daily-digest import: generate a Penni pack from a curated list of
// articles (e.g. a hand-picked current-affairs PDF) instead of the live
// fetch/filter stages. Reuses the same generator + quality gates + EN/Hinglish
// audio scripts as the automated pipeline.
//
//   node scripts/news-pipeline/manual-import.mjs --date 2026-07-13
//
// Reads scripts/news-pipeline/data/<date>.mjs (default export: array of
// { eventKey, title, category, gsPaper, sources:[{key,label,url}], text }).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs, istDateString } from './lib/util.mjs'
import { generateAll } from './lib/generate.mjs'
import { resolveEngine } from './lib/llm.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = parseArgs(process.argv)
const date = args.date || istDateString()
const engine = args.engine || 'cli'

const dataPath = args.data
  ? path.resolve(ROOT, String(args.data))
  : path.join(ROOT, 'scripts/news-pipeline/data', `${date}.mjs`)
if (!existsSync(dataPath)) {
  console.error(`No digest data at ${path.relative(ROOT, dataPath)}`)
  process.exit(1)
}
const items = dataPath.endsWith('.json')
  ? JSON.parse(readFileSync(dataPath, 'utf8'))
  : (await import(pathToFileURL(dataPath).href)).default
console.log(`Manual import — ${date} (${items.length} articles, engine: ${resolveEngine(engine)})`)

const clusters = items.map(item => ({
  eventKey: item.eventKey,
  score: 10,
  category: item.category,
  gsPaper: item.gsPaper,
  title: item.title,
  sourceText: item.text,
  members: (item.sources || [{ key: 'hindu', label: 'The Hindu', url: '' }]).map(s => ({
    id: `${s.key}-${item.eventKey}`, sourceKey: s.key, sourceLabel: s.label, title: item.title, url: s.url || '',
  })),
}))

const packPath = path.join(ROOT, 'app/public/data/articles', `${date}.json`)
const existing = existsSync(packPath) ? JSON.parse(readFileSync(packPath, 'utf8')) : {}
const existingIds = new Set((existing[date] || []).map(a => a.id))

const articles = await generateAll(clusters, { date, engine, concurrency: Number(args.concurrency || 4), existingIds })
console.log(`\nGenerated ${articles.length}/${clusters.length}`)
if (articles.length === 0) { console.error('Nothing generated; leaving pack untouched.'); process.exit(1) }

const merged = existing[date]?.length
  ? [...existing[date], ...articles.filter(a => !existingIds.has(a.id))]
  : articles
mkdirSync(path.dirname(packPath), { recursive: true })
writeFileSync(packPath, JSON.stringify({ [date]: merged }, null, 1))

const indexPath = path.join(ROOT, 'app/public/data/articles/index.json')
const index = JSON.parse(readFileSync(indexPath, 'utf8'))
if (!index.dates.includes(date)) {
  index.dates.unshift(date)
  index.dates.sort((a, b) => (a > b ? -1 : 1))
  writeFileSync(indexPath, JSON.stringify(index, null, 2))
}
console.log(`\nDone. ${merged.length} articles in ${path.relative(ROOT, packPath)}; index updated.`)
