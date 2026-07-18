import { useEffect, useState } from 'react'
import { fetchContent } from '@/utils/content'

export interface LoadingBrief {
  id: string
  title: string
  summary: string
  category: string
  publishedAt: string
  sourceUrl: string
}

interface LoadingBriefPack {
  version: 1
  date: string
  generatedAt: string
  briefs: LoadingBrief[]
}

const STORAGE_KEY = 'penni.loading-briefs.v1'

const FALLBACK_PACK: LoadingBriefPack = {
  version: 1,
  date: '2026-07-18',
  generatedAt: '2026-07-18T12:00:00+05:30',
  briefs: [
    {
      id: 'tbi-mango-grafting-11-varieties',
      category: 'Horticulture',
      title: 'Eleven harvests from one tree',
      summary: 'After retirement, a Lucknow gardener grafted eleven mango varieties onto one mature tree, using a single root system to preserve diversity in limited space.',
      sourceUrl: 'https://thebetterindia.com/farming/anup-kumar-bajpai-11-mango-varieties-one-tree-grafting-experiment-lucknow-childhood-village-memories-12173132',
      publishedAt: '2026-07-17T14:00:37.000Z',
    },
    {
      id: 'tbi-mango-seed-orchards',
      category: 'Community collection',
      title: 'Discarded mango stones become orchards',
      summary: 'A collector gathered eleven lakh discarded mango stones and routed them to farmers, turning seasonal waste into affordable planting material for future orchards.',
      sourceUrl: 'https://thebetterindia.com/web-stories/farming/gutli-man-india-mango-seeds-helping-farmers-grow-orchards-12174116',
      publishedAt: '2026-07-18T03:30:37.000Z',
    },
    {
      id: 'tbi-ganga-conservation-agarwal',
      category: 'River conservation',
      title: 'A scientist’s river commitment',
      summary: 'Former IIT professor G. D. Agarwal paired scientific advocacy with a 111-day fast, keeping stronger protection for the Ganga in public debate.',
      sourceUrl: 'https://thebetterindia.com/videos/the-man-who-fasted-111-days-to-save-the-ganga-12175254',
      publishedAt: '2026-07-18T03:30:14.000Z',
    },
    {
      id: 'tbi-finland-schools',
      category: 'Education design',
      title: 'Schools designed around childhood',
      summary: 'Finland combines later formal schooling, shorter days, play and early support, showing that childhood wellbeing can strengthen rather than weaken serious learning.',
      sourceUrl: 'https://thebetterindia.com/videos/knowledge/why-finland-has-the-worlds-best-education-system-12174512',
      publishedAt: '2026-07-17T14:38:34.000Z',
    },
  ],
}

const cachedPack = readCachedPack()
let activePack = cachedPack && comparePacks(cachedPack, FALLBACK_PACK) >= 0
  ? cachedPack
  : FALLBACK_PACK
let refreshPromise: Promise<void> | null = null
let refreshDate = ''
let lastRefreshAttempt = 0
const REFRESH_INTERVAL_MS = 15 * 60 * 1_000

function istDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function wordCount(value: unknown) {
  return String(value ?? '').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

function validBrief(value: unknown): value is LoadingBrief {
  if (!value || typeof value !== 'object') return false
  const brief = value as LoadingBrief
  const summaryWords = wordCount(brief.summary)
  const titleWords = wordCount(brief.title)
  const categoryWords = wordCount(brief.category)
  let validSource = false
  try {
    const source = new URL(brief.sourceUrl)
    validSource = source.protocol === 'https:' && source.hostname.replace(/^www\./, '') === 'thebetterindia.com'
  } catch { /* invalid source URL */ }
  const displayCopy = `${brief.title ?? ''} ${brief.summary ?? ''}`
  return /^tbi-[a-z0-9-]{6,64}$/.test(brief.id)
    && typeof brief.title === 'string'
    && titleWords >= 3
    && titleWords <= 10
    && typeof brief.category === 'string'
    && categoryWords >= 1
    && categoryWords <= 5
    && summaryWords >= 16
    && summaryWords <= 24
    && validSource
    && Number.isFinite(Date.parse(brief.publishedAt))
    && !/the better india|https?:\/\/|www\.|source article/i.test(displayCopy)
}

function validPack(value: unknown): value is LoadingBriefPack {
  if (!value || typeof value !== 'object') return false
  const pack = value as LoadingBriefPack
  const shapeIsValid = pack.version === 1
    && /^\d{4}-\d{2}-\d{2}$/.test(pack.date)
    && Number.isFinite(Date.parse(`${pack.date}T12:00:00+05:30`))
    && pack.date <= istDateKey()
    && Number.isFinite(Date.parse(pack.generatedAt))
    && Array.isArray(pack.briefs)
    && pack.briefs.length >= 3
    && pack.briefs.length <= 5
    && pack.briefs.every(validBrief)
  if (!shapeIsValid) return false
  const ids = new Set(pack.briefs.map(brief => brief.id))
  const urls = new Set(pack.briefs.map(brief => brief.sourceUrl))
  const categories = new Set(pack.briefs.map(brief => brief.category.trim().toLocaleLowerCase('en-IN')))
  return ids.size === pack.briefs.length
    && urls.size === pack.briefs.length
    && categories.size === pack.briefs.length
}

function comparePacks(left: LoadingBriefPack, right: LoadingBriefPack) {
  const dateOrder = left.date.localeCompare(right.date)
  if (dateOrder !== 0) return dateOrder
  return Date.parse(left.generatedAt) - Date.parse(right.generatedAt)
}

function readCachedPack() {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown
    return validPack(parsed) ? parsed : null
  } catch {
    return null
  }
}

function selectBrief(pack: LoadingBriefPack) {
  const index = hash(istDateKey()) % pack.briefs.length
  return pack.briefs[index]
}

async function refreshLoadingBriefs() {
  const today = istDateKey()
  const now = Date.now()
  if (refreshPromise) return refreshPromise
  if (refreshDate === today && now - lastRefreshAttempt < REFRESH_INTERVAL_MS) return
  refreshDate = today
  lastRefreshAttempt = now
  const request = fetchContent<LoadingBriefPack>('loading-briefs/latest.json', { cache: 'no-store' })
    .then(pack => {
      if (!validPack(pack) || comparePacks(pack, activePack) < 0) return
      activePack = pack
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pack)) } catch { /* offline/private mode */ }
    })
    .catch(() => { /* the bundled or last successful story remains available */ })
  refreshPromise = request.finally(() => { refreshPromise = null })
  return refreshPromise
}

export function useDailyLoadingBrief() {
  const [selection, setSelection] = useState(() => ({
    pack: activePack,
    brief: selectBrief(activePack),
  }))
  useEffect(() => {
    let mounted = true
    void refreshLoadingBriefs().then(() => {
      if (!mounted) return
      setSelection(current => comparePacks(activePack, current.pack) > 0
        ? { pack: activePack, brief: selectBrief(activePack) }
        : current)
    })
    return () => { mounted = false }
  }, [])
  return selection.brief
}
