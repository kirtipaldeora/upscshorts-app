import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { fetchContent } from '@/utils/content'

interface DatesManifest {
  dates: string[]
}

let archiveRequest: Promise<ArticlesByDate> | null = null
let archiveMerged = false

function loadArticleArchive() {
  if (archiveRequest) return archiveRequest

  archiveRequest = fetchContent<DatesManifest>('articles/index.json')
    .then(async (manifest) => {
      const snapshots = await Promise.all(
        (manifest.dates ?? []).map((date) =>
          fetchContent<ArticlesByDate>(`articles/${date}.json`).catch(() => ({})),
        ),
      )

      // One combined store update prevents every date response from rebuilding
      // the full Revise archive and question indexes independently.
      return snapshots.reduce<ArticlesByDate>((archive, snapshot) => {
        for (const [date, articles] of Object.entries(snapshot)) archive[date] = articles
        return archive
      }, {})
    })
    .catch((error) => {
      // A later mount may retry a transient remote-content failure.
      archiveRequest = null
      throw error
    })

  return archiveRequest
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
  const [loading, setLoading] = useState(!archiveMerged)

  useEffect(() => {
    let mounted = true
    loadArticleArchive()
      .then((archive) => {
        if (!archiveMerged) {
          archiveMerged = true
          mergeArticles(archive)
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [mergeArticles])

  return { loading }
}
