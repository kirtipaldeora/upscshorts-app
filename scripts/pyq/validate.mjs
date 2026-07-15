#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'app/public/data/pyq')
const files = (await readdir(root)).filter(file => /^prelims-\d{4}\.json$/.test(file))
const questions = []

for (const file of files) {
  questions.push(...JSON.parse(await readFile(resolve(root, file), 'utf8')))
}

const ids = new Set()
const failures = []
for (const question of questions) {
  const reasons = []
  if (ids.has(question.id)) reasons.push('duplicate id')
  ids.add(question.id)
  if (!question.stem || question.stem.length < 12) reasons.push('short stem')
  if (!Array.isArray(question.options) || question.options.length !== 4) reasons.push('options')
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) reasons.push('answer')
  if (!question.solution?.detail || question.solution.detail.length < 18) reasons.push('solution')
  if (/\bAns\s*[:.]|PW ONLYIAS|UPSC GS Paper-I PYQs/i.test(question.stem)) reasons.push('source text in stem')
  if (question.options?.some(option => /\bAns\s*[:.]|PW ONLYIAS|UPSC GS Paper-I PYQs/i.test(option))) reasons.push('source text in options')
  if (reasons.length) failures.push({ id: question.id, reasons })
}

if (failures.length) {
  console.error(JSON.stringify({ questions: questions.length, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ files: files.length, questions: questions.length, uniqueIds: ids.size, status: 'valid' }, null, 2))
