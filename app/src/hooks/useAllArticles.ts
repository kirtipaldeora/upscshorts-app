import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { fetchContent } from '@/utils/content'

interface DatesManifest {
  dates: string[]
}

/**
 * Loads every available article date (listed in data/articles/index.json) into
 * the store, so Practice can reach previous days and build an all-questions
 * random test — not just the days the user has already opened in the feed.
 *
 * Runs once. No AbortController: under React StrictMode the effect is invoked
 * twice in dev, and aborting on the first cleanup would cancel the only fetch.
 */
export function useAllArticles() {
  const mergeArticles = useAppStore((s) => s.mergeArticles)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    fetchContent<DatesManifest>('articles/index.json')
      .then((manifest) =>
        Promise.all(
          (manifest.dates ?? []).map((date) =>
            fetchContent<ArticlesByDate>(`articles/${date}.json`)
              .then((data) => { if (data) mergeArticles(data) })
              .catch(() => {}),
          ),
        ),
      )
      .catch(() => {})
  }, [mergeArticles])
}
