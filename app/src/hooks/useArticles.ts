import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { fetchContent } from '@/utils/content'

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
 * 2. Fetches the date's pack and merges it.
 *
 * Step 2 goes through fetchContent(), which prefers the CMS-published snapshot
 * and falls back to the bundled data/articles/{date}.json.
 */
export function useArticles(date: string) {
  const { setArticlesByDate, mergeArticles } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hydrated = useRef(false)
  const fetchedDates = useRef(new Set<string>())

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
    // Always refresh each viewed date once per app session. LocalStorage is
    // only an instant placeholder; otherwise deployed news packs can be masked
    // by an older cached copy that already had generated questions.
    if (fetchedDates.current.has(date)) return
    fetchedDates.current.add(date)

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const fetchArticles = (targetDate: string) =>
      fetchContent<ArticlesByDate>(`articles/${targetDate}.json`, { signal: controller.signal })

    fetchArticles(date)
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
  }, [date, mergeArticles])

  return { loading, error }
}
