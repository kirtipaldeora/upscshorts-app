// Shared helpers for the Penni news pipeline.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

export async function fetchText(url, { timeoutMs = 25000, retries = 2, headers = {} } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8', ...headers },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.text()
    } catch (err) {
      lastErr = err
      if (attempt < retries) await sleep(1200 * (attempt + 1))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Today's date string in IST regardless of runner timezone.
export function istDateString(offsetDays = 0) {
  const now = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000)
  return now.toISOString().slice(0, 10)
}

export function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
}

// Pull every <tag>...</tag> text occurrence (non-greedy, CDATA aware).
export function xmlValues(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()))
  return out
}

// Split an XML document into the raw bodies of a repeated element.
export function xmlBlocks(xml, tag) {
  const re = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)</${tag}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}

export function titleFromSlug(slug) {
  const t = slug.replace(/\.(ece|html?)$/, '').replace(/-/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

// Extract readable article body text from a news page (best effort).
export function extractArticleText(html, maxChars = 4500) {
  // Prefer JSON-LD articleBody when present.
  const ldMatches = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const block of ldMatches) {
    const raw = block.replace(/<script[^>]*>|<\/script>/gi, '')
    try {
      const data = JSON.parse(raw)
      const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])]
      for (const node of nodes) {
        if (node && typeof node.articleBody === 'string' && node.articleBody.length > 300) {
          return decodeEntities(node.articleBody).replace(/\s+/g, ' ').slice(0, maxChars)
        }
      }
    } catch { /* malformed ld+json is common; fall through */ }
  }
  // Fallback: concatenate <p> blocks, skipping nav/footer boilerplate.
  const paras = (html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(p => stripHtml(p))
    .filter(p => p.length > 60 && !/cookie|subscribe|newsletter|all rights reserved|download the app/i.test(p))
  const meta = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i)
  const body = paras.join(' ')
  const text = body.length > 200 ? body : stripHtml(meta?.[1] || '')
  return text.slice(0, maxChars)
}

// Extract a JS object literal (`identifier = { ... }`) from an HTML/JS blob by
// scanning for balanced braces while respecting string escaping. Returns the
// raw JSON text, or null if not found.
export function extractObjectLiteral(html, assignmentNeedle) {
  const at = html.indexOf(assignmentNeedle)
  if (at === -1) return null
  const start = html.indexOf('{', at)
  if (start === -1) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') { if (--depth === 0) return html.slice(start, i + 1) }
  }
  return null
}

export function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++ }
      else args[key] = true
    } else args._.push(a)
  }
  return args
}
