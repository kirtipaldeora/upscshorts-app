import type { Article, GeoLocation } from '@/types/article'

interface GlobalAnchor extends GeoLocation {
  countryCode: string
  aliases: string[]
}

// These anchors are only used when older article packs point a bilateral story
// at India (or do not provide a location). New packs provide a structured
// countryCode, while the article's event location remains the first choice.
const GLOBAL_ANCHORS: GlobalAnchor[] = [
  { countryCode: 'US', place: 'United States', lat: 38, lon: -97, aliases: ['united states', 'united states of america', 'u s', 'u s a', 'american', 'india us', 'us india'] },
  { countryCode: 'GB', place: 'United Kingdom', lat: 54, lon: -2, aliases: ['united kingdom', 'u k', 'uk', 'britain', 'british'] },
  { countryCode: 'AU', place: 'Australia', lat: -25.3, lon: 133.8, aliases: ['australia', 'australian'] },
  { countryCode: 'NZ', place: 'New Zealand', lat: -41.3, lon: 174.8, aliases: ['new zealand'] },
  { countryCode: 'JP', place: 'Japan', lat: 36.2, lon: 138.3, aliases: ['japan', 'japanese'] },
  { countryCode: 'CA', place: 'Canada', lat: 56.1, lon: -106.3, aliases: ['canada', 'canadian'] },
  { countryCode: 'CN', place: 'China', lat: 35.9, lon: 104.2, aliases: ['china', 'chinese', 'beijing'] },
  { countryCode: 'RU', place: 'Russia', lat: 61.5, lon: 105.3, aliases: ['russia', 'russian', 'moscow'] },
  { countryCode: 'UA', place: 'Ukraine', lat: 48.4, lon: 31.2, aliases: ['ukraine', 'ukrainian', 'kyiv', 'kiev'] },
  { countryCode: 'IR', place: 'Iran', lat: 32.4, lon: 53.7, aliases: ['iran', 'iranian', 'tehran'] },
  { countryCode: 'IL', place: 'Israel', lat: 31.5, lon: 34.8, aliases: ['israel', 'israeli'] },
  { countryCode: 'PS', place: 'Palestine', lat: 31.9, lon: 35.2, aliases: ['palestine', 'palestinian', 'gaza', 'west bank'] },
  { countryCode: 'ID', place: 'Indonesia', lat: -2.5, lon: 118, aliases: ['indonesia', 'indonesian', 'jakarta'] },
  { countryCode: 'LK', place: 'Sri Lanka', lat: 7.9, lon: 80.8, aliases: ['sri lanka', 'sri lankan', 'colombo'] },
  { countryCode: 'AF', place: 'Afghanistan', lat: 33.9, lon: 67.7, aliases: ['afghanistan', 'afghan', 'taliban', 'kabul'] },
  { countryCode: 'PK', place: 'Pakistan', lat: 30.4, lon: 69.3, aliases: ['pakistan', 'pakistani', 'islamabad'] },
  { countryCode: 'BD', place: 'Bangladesh', lat: 23.7, lon: 90.4, aliases: ['bangladesh', 'bangladeshi', 'dhaka'] },
  { countryCode: 'NP', place: 'Nepal', lat: 28.4, lon: 84.1, aliases: ['nepal', 'nepali', 'kathmandu'] },
  { countryCode: 'BT', place: 'Bhutan', lat: 27.5, lon: 90.4, aliases: ['bhutan', 'bhutanese', 'thimphu'] },
  { countryCode: 'MM', place: 'Myanmar', lat: 21.9, lon: 95.9, aliases: ['myanmar', 'burma', 'myanmarese', 'naypyidaw'] },
  { countryCode: 'TR', place: 'Türkiye', lat: 39, lon: 35.2, aliases: ['turkiye', 'turkey', 'turkish', 'ankara'] },
  { countryCode: 'SA', place: 'Saudi Arabia', lat: 23.9, lon: 45.1, aliases: ['saudi arabia', 'saudi'] },
  { countryCode: 'AE', place: 'United Arab Emirates', lat: 23.4, lon: 53.8, aliases: ['united arab emirates', 'u a e', 'uae', 'emirati'] },
  { countryCode: 'QA', place: 'Qatar', lat: 25.4, lon: 51.2, aliases: ['qatar', 'qatari', 'doha'] },
  { countryCode: 'FR', place: 'France', lat: 46.2, lon: 2.2, aliases: ['france', 'french', 'paris'] },
  { countryCode: 'DE', place: 'Germany', lat: 51.2, lon: 10.5, aliases: ['germany', 'german', 'berlin'] },
  { countryCode: 'IT', place: 'Italy', lat: 41.9, lon: 12.6, aliases: ['italy', 'italian', 'rome'] },
  { countryCode: 'BR', place: 'Brazil', lat: -14.2, lon: -51.9, aliases: ['brazil', 'brazilian', 'brasilia'] },
  { countryCode: 'ZA', place: 'South Africa', lat: -30.6, lon: 22.9, aliases: ['south africa', 'south african'] },
  { countryCode: 'BE', place: 'European Union · Brussels', lat: 50.85, lon: 4.35, aliases: ['european union', 'e u', 'nato', 'brussels'] },
  { countryCode: 'US', place: 'United Nations · New York', lat: 40.75, lon: -73.97, aliases: ['united nations', 'u n security council', 'un security council', 'unga', 'unsc'] },
  { countryCode: 'CH', place: 'Geneva', lat: 46.2, lon: 6.14, aliases: ['world trade organization', 'w t o', 'wto', 'geneva'] },
]

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function phraseIndex(text: string, phrase: string): number {
  return ` ${text} `.indexOf(` ${normalize(phrase)} `)
}

function findForeignAnchor(article: Pick<Article, 'headline' | 'summary'>): GlobalAnchor | null {
  const fields = [normalize(article.headline), normalize(article.summary)]
  for (const text of fields) {
    let nearest: { anchor: GlobalAnchor; index: number } | null = null
    for (const anchor of GLOBAL_ANCHORS) {
      for (const alias of anchor.aliases) {
        const index = phraseIndex(text, alias)
        if (index >= 0 && (!nearest || index < nearest.index)) nearest = { anchor, index }
      }
    }
    if (nearest) return nearest.anchor
  }
  return null
}

function isDomesticLocation(location: GeoLocation): boolean {
  const place = normalize(location.place)
  return location.countryCode === 'IN' || /\b(india|new delhi|delhi)\b/.test(place)
}

/**
 * Global News is strictly an International Relations section. New packs use
 * the editorial flag. Legacy packs also need clear foreign evidence, which
 * keeps domestic-only IR-adjacent stories out of the globe.
 */
export function isGlobalNewsArticle(
  article: Pick<Article, 'category' | 'globalNews' | 'headline' | 'summary' | 'location'>,
): boolean {
  if (article.category !== 'International Relations' || article.globalNews === false) return false
  if (article.globalNews === true) return true
  return Boolean(findForeignAnchor(article) || (article.location && !isDomesticLocation(article.location)))
}

/**
 * Preserve a genuine overseas/event location. When a legacy bilateral story
 * was pinned to Delhi, move it to the first foreign counterpart named in the
 * headline (then summary). This makes India–US resolve to the United States,
 * India–Japan to Japan, and so on without changing the article itself.
 */
export function resolveGlobalNewsLocation(
  article: Pick<Article, 'headline' | 'summary' | 'location'>,
): GeoLocation | null {
  const fallback = article.location
  if (fallback && !isDomesticLocation(fallback)) return fallback

  const anchor = findForeignAnchor(article)
  if (anchor) {
    return {
      lat: anchor.lat,
      lon: anchor.lon,
      place: anchor.place,
      countryCode: anchor.countryCode,
    }
  }

  return fallback ?? null
}
