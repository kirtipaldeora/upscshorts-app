// Per-source fetchers. Every fetcher returns normalized items:
//   { id, sourceKey, sourceLabel, title, url, publishedAt, section }
// A source that is unreachable logs a warning and contributes zero items —
// the pipeline must survive any single site being down.

import { fetchText, xmlBlocks, xmlValues, titleFromSlug, decodeEntities, istDateString, extractObjectLiteral } from './util.mjs'

export const SOURCE_LABELS = {
  hindu: 'The Hindu',
  ie: 'Indian Express',
  pib: 'PIB',
  prs: 'PRS India',
  airdd: 'AIR / DD News',
}

// The Hindu's print edition ("Today's Paper") — the complete daily issue a
// UPSC aspirant actually reads, section by section. Far more complete than the
// rolling "recently updated" sitemap. th_chennai carries the full national /
// foreign / editorial / business desks (edition-independent) plus regional.
const HINDU_PAPER = date => `https://www.thehindu.com/todays-paper/${date}/th_chennai/`
const HINDU_SITEMAP = 'https://www.thehindu.com/sitemap/update/all.xml'
const IE_SITEMAP = 'https://indianexpress.com/news-sitemap.xml'
const PIB_ALL_RELEASES = 'https://www.pib.gov.in/AllRelease.aspx?reg=3&lang=1'
const PRS_BLOG = 'https://prsindia.org/theprsblog'
const DD_FEEDS = [
  'https://ddnews.gov.in/category/national/feed/',
  'https://ddnews.gov.in/category/international/feed/',
  'https://ddnews.gov.in/category/business/feed/',
]
const AIR_FEED = 'https://www.newsonair.gov.in/feed/'

function withinLastHours(iso, hours) {
  if (!iso) return true // undated items pass; the LLM filter judges them
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Date.now() - t <= hours * 3600_000 : true
}

const HINDU_DESK_LABEL = {
  TH_National: 'national', TH_Foreign: 'international', TH_Business: 'business',
  TH_Edit: 'editorial', TH_Regional: 'regional', Sports: 'sports',
}

// Primary: full print edition. The TOC page embeds a `grouped_articles` JSON
// object keyed by desk, each entry carrying headline + teaser text.
async function fetchHinduPaper(date) {
  const html = await fetchText(HINDU_PAPER(date))
  const raw = extractObjectLiteral(html, 'grouped_articles = {"')
  if (!raw) throw new Error('grouped_articles not found in print TOC')
  const grouped = JSON.parse(raw)
  const items = []
  for (const [desk, arts] of Object.entries(grouped)) {
    for (const a of arts) {
      const href = (a.href || '').replace(/\\\//g, '/')
      if (!href) continue
      items.push({
        sourceKey: 'hindu',
        sourceLabel: 'The Hindu',
        title: decodeEntities(a.articleheadline || '').trim(),
        url: href.startsWith('http') ? href : `https://www.thehindu.com${href}`,
        publishedAt: date,
        section: HINDU_DESK_LABEL[desk] || desk.replace(/^TH_/, '').toLowerCase(),
        summary: decodeEntities(a.teaser_text || '').replace(/\s+/g, ' ').trim() || undefined,
      })
    }
  }
  return items
}

// Fallback: rolling "recently updated" sitemap (used only if the print TOC
// layout changes). Less complete, so we merge rather than rely on it.
async function fetchHinduSitemap(hours) {
  const xml = await fetchText(HINDU_SITEMAP)
  const items = []
  for (const block of xmlBlocks(xml, 'url')) {
    const loc = xmlValues(block, 'loc')[0]
    const lastmod = xmlValues(block, 'lastmod')[0]
    if (!loc || !withinLastHours(lastmod, hours)) continue
    const segs = new URL(loc).pathname.split('/').filter(Boolean)
    const slug = segs[segs.length - 2] ?? segs[segs.length - 1]
    items.push({
      sourceKey: 'hindu',
      sourceLabel: 'The Hindu',
      title: titleFromSlug(slug || ''),
      url: loc,
      publishedAt: lastmod || null,
      section: segs.slice(0, -2).join('/'),
    })
  }
  return items
}

async function fetchHindu(hours, date) {
  try {
    const paper = await fetchHinduPaper(date)
    if (paper.length >= 30) return paper
    console.warn(`  [hindu] print TOC returned only ${paper.length}; merging sitemap`)
    const sitemap = await fetchHinduSitemap(hours).catch(() => [])
    const seen = new Set(paper.map(p => p.url))
    return [...paper, ...sitemap.filter(s => !seen.has(s.url))]
  } catch (err) {
    console.warn(`  [hindu] print TOC failed (${err.message}); falling back to sitemap`)
    return fetchHinduSitemap(hours)
  }
}

async function fetchIndianExpress(hours) {
  const xml = await fetchText(IE_SITEMAP)
  const items = []
  for (const block of xmlBlocks(xml, 'url')) {
    const loc = xmlValues(block, 'loc')[0]
    const title = xmlValues(block, 'news:title')[0]
    const pub = xmlValues(block, 'news:publication_date')[0]
    if (!loc || !withinLastHours(pub, hours)) continue
    const segs = new URL(loc).pathname.split('/').filter(Boolean)
    items.push({
      sourceKey: 'ie',
      sourceLabel: 'Indian Express',
      title: title || titleFromSlug(segs[segs.length - 1] || ''),
      url: loc,
      publishedAt: pub || null,
      section: segs.slice(0, -1).join('/'),
    })
  }
  return items
}

async function fetchPIB() {
  // Day-wise English (reg=3 national, lang=1 English). The page lists today's
  // releases as anchors carrying PRID identifiers.
  const html = await fetchText(PIB_ALL_RELEASES)
  const items = []
  const seen = new Set()
  const re = /<a[^>]*PRID=(\d+)[^>]*>([^<]{15,220})<\/a>/g
  let m
  while ((m = re.exec(html))) {
    const [, prid, rawTitle] = m
    if (seen.has(prid)) continue
    seen.add(prid)
    const title = decodeEntities(rawTitle).replace(/\s+/g, ' ').trim()
    if (!title || /^(hindi|urdu|marathi|tamil|telugu)$/i.test(title)) continue
    items.push({
      sourceKey: 'pib',
      sourceLabel: 'PIB',
      title,
      url: `https://www.pib.gov.in/PressReleasePage.aspx?PRID=${prid}`,
      publishedAt: istDateString(),
      section: 'press-release',
    })
  }
  return items
}

async function fetchPRS() {
  // PRS has no reliable feed; scrape the blog listing. Low volume, so
  // undated entries are fine — the dedupe step drops ones already covered.
  const html = await fetchText(PRS_BLOG)
  const items = []
  const seen = new Set()
  const re = /<a[^>]+href="(\/theprsblog\/[^"#?]+)"[^>]*>([\s\S]{10,250}?)<\/a>/g
  let m
  while ((m = re.exec(html))) {
    const href = m[1]
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (!title || title.length < 12 || seen.has(href)) continue
    if (/^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december),?\s+\d{4}\s*)+$/i.test(title)) continue
    seen.add(href)
    items.push({
      sourceKey: 'prs',
      sourceLabel: 'PRS India',
      title,
      url: `https://prsindia.org${href}`,
      publishedAt: null,
      section: 'legislative-analysis',
    })
    if (items.length >= 12) break
  }
  return items
}

async function fetchAirDd(hours) {
  const items = []
  const feeds = [...DD_FEEDS, AIR_FEED]
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed, { timeoutMs: 15000, retries: 0 })
      const label = feed.includes('newsonair') ? 'AIR News' : 'DD News'
      for (const block of xmlBlocks(xml, 'item')) {
        const title = xmlValues(block, 'title')[0]
        const link = xmlValues(block, 'link')[0]
        const pub = xmlValues(block, 'pubDate')[0]
        const pubIso = pub ? new Date(pub).toISOString() : null
        if (!title || !link || !withinLastHours(pubIso, hours)) continue
        items.push({
          sourceKey: 'airdd',
          sourceLabel: label,
          title,
          url: link,
          publishedAt: pubIso,
          section: feed.match(/category\/([a-z-]+)\//)?.[1] || 'news',
        })
      }
    } catch (err) {
      console.warn(`  [airdd] skipping ${feed}: ${err.message}`)
    }
  }
  return items
}

export async function fetchAllSources({ hours = 26, date = istDateString() } = {}) {
  const jobs = [
    ['hindu', () => fetchHindu(hours, date)],
    ['ie', () => fetchIndianExpress(hours)],
    ['pib', () => fetchPIB()],
    ['prs', () => fetchPRS()],
    ['airdd', () => fetchAirDd(hours)],
  ]
  const all = []
  await Promise.all(jobs.map(async ([key, job]) => {
    try {
      const items = await job()
      console.log(`  [${key}] ${items.length} items`)
      all.push(...items)
    } catch (err) {
      console.warn(`  [${key}] FAILED: ${err.message}`)
    }
  }))
  // Stable ids for auditing: source + hash of URL.
  for (const item of all) {
    let h = 0
    for (const c of item.url) h = (h * 31 + c.charCodeAt(0)) >>> 0
    item.id = `${item.sourceKey}-${h.toString(36)}`
  }
  return all
}
