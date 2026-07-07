import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'

const LS_KEY = 'u4ct' // original localStorage key for cached articles

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
  const { setArticlesByDate, mergeArticles, articlesByDate } = useAppStore()
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
    // Skip if we already have data for this date
    if (articlesByDate[date]?.length) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/data/articles/${date}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`No data for ${date}`)
        return r.json() as Promise<ArticlesByDate>
      })
      .then((data) => {
        mergeArticles(data)
        // Persist merged state back to localStorage
        const updated = { ...loadFromLS(), ...data }
        saveToLS(updated)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [date, articlesByDate, mergeArticles])

  return { loading, error }
}
