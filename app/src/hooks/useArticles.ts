import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { asset } from '@/utils/asset'

const LS_KEY = 'u4ct' // original localStorage key for cached articles
const BUNDLED_FALLBACK_DATE = '2026-07-07'

function loadFromLS(): ArticlesByDate {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToLS(data: ArticlesByDate) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

/**
 * Loads articles for a given date.
 * 1. Immediately hydrates from localStorage (instant render).
 * 2. Fetches /data/articles/{date}.json and merges if newer.
 * 3. Architecture is ready for remote fetch — just swap the URL.
 */
export function useArticles(date: string) {
  const { setArticlesByDate, mergeArticles, articlesByDate, setSelectedDate } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hydrated = useRef(false)

  // Step 1: Hydrate from localStorage on first mount
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      const cached = loadFromLS()
      if (Object.keys(cached).length > 0) {
        setArticlesByDate(cached)
      }
    }
  }, [setArticlesByDate])

  // Step 2: Fetch the per-date JSON if not already in store
  useEffect(() => {
    if (!date) return
    // Skip only when this date is already hydrated with practice questions.
    // Older cached article payloads did not include prelimsQs/keyTerms.
    if (articlesByDate[date]?.some((article) => (article.prelimsQs ?? []).length > 0)) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const fetchArticles = (targetDate: string) =>
      fetch(asset(`data/articles/${targetDate}.json`), { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`No data for ${targetDate}`)
          return r.json() as Promise<ArticlesByDate>
        })

    fetchArticles(date)
      .catch((e: Error) => {
        if (e.name === 'AbortError' || date === BUNDLED_FALLBACK_DATE) throw e
        return fetchArticles(BUNDLED_FALLBACK_DATE).then((data) => {
          setSelectedDate(BUNDLED_FALLBACK_DATE)
          return data
        })
      })
      .then((r) => {
        mergeArticles(r)
        // Persist merged state back to localStorage
        const updated = { ...loadFromLS(), ...r }
        saveToLS(updated)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [date, articlesByDate, mergeArticles, setSelectedDate])

  return { loading, error }
}
