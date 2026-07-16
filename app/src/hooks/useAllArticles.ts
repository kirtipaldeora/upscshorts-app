import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { bundledContentUrl, fetchContent } from '@/utils/content'

interface DatesManifest {
  dates: string[]
}

let archiveRequest: Promise<ArticlesByDate> | null = null
let archiveMerged = false
let archiveSnapshot: ArticlesByDate | null = null
let archiveLoadedAt = 0

const ARCHIVE_REVALIDATE_MS = 5 * 60 * 1000

function validDates(manifest: DatesManifest | null) {
  return (manifest?.dates ?? []).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
}

async function fetchBundledManifest(): Promise<DatesManifest> {
  const response = await fetch(bundledContentUrl('articles/index.json'))
  if (!response.ok) throw new Error('Bundled article archive is unavailable')
  return response.json() as Promise<DatesManifest>
}

async function fetchBundledDate(date: string): Promise<ArticlesByDate> {
  const response = await fetch(bundledContentUrl(`articles/${date}.json`))
  if (!response.ok) throw new Error(`Bundled articles are unavailable for ${date}`)
  return response.json() as Promise<ArticlesByDate>
}

async function loadArchiveDate(date: string): Promise<ArticlesByDate> {
  // Treat the shipped pack as the durable baseline and the CMS pack as the
  // freshest version. A partial CMS upload must not make older stories vanish
  // from the archive; matching IDs are still replaced by the CMS correction.
  const [published, bundled] = await Promise.allSettled([
    fetchContent<ArticlesByDate>(`articles/${date}.json`),
    fetchBundledDate(date),
  ])
  const publishedArticles = published.status === 'fulfilled' ? published.value[date] ?? [] : []
  const bundledArticles = bundled.status === 'fulfilled' ? bundled.value[date] ?? [] : []

  const mergedById = new Map(bundledArticles.map(article => [article.id, article]))
  for (const article of publishedArticles) mergedById.set(article.id, article)

  const publishedIds = new Set(publishedArticles.map(article => article.id))
  const articles = [
    ...publishedArticles.map(article => mergedById.get(article.id) ?? article),
    ...bundledArticles.filter(article => !publishedIds.has(article.id)),
  ]
  return articles.length ? { [date]: articles } : {}
}

async function discoverArchiveDates() {
  // A remote CMS manifest can briefly lag behind a deployment or contain only
  // the newest pack. Union it with the manifest shipped in the app so Search
  // can never lose previously published days, while still discovering newer
  // CMS-only packs as soon as editors publish them.
  const [published, bundled] = await Promise.allSettled([
    fetchContent<DatesManifest>('articles/index.json'),
    fetchBundledManifest(),
  ])

  const publishedManifest = published.status === 'fulfilled' ? published.value : null
  const bundledManifest = bundled.status === 'fulfilled' ? bundled.value : null
  const dates = [...new Set([
    ...validDates(publishedManifest),
    ...validDates(bundledManifest),
  ])].sort((left, right) => right.localeCompare(left))

  if (!dates.length) throw new Error('No article archive dates are available')
  return dates
}

function loadArticleArchive() {
  if (archiveRequest) return archiveRequest
  if (archiveSnapshot && Date.now() - archiveLoadedAt < ARCHIVE_REVALIDATE_MS) {
    return Promise.resolve(archiveSnapshot)
  }

  archiveRequest = discoverArchiveDates()
    .then(async (dates) => {
      const snapshots = await Promise.all(
        dates.map(date => loadArchiveDate(date)),
      )

      // One combined store update prevents every date response from rebuilding
      // the full Revise archive and question indexes independently.
      const archive = snapshots.reduce<ArticlesByDate>((allDates, snapshot) => {
        for (const [date, articles] of Object.entries(snapshot)) allDates[date] = articles
        return allDates
      }, {})
      archiveSnapshot = archive
      archiveLoadedAt = Date.now()
      return archive
    })
    .catch((error) => {
      // A later mount may retry a transient remote-content failure.
      throw error
    })
    .finally(() => { archiveRequest = null })

  return archiveRequest
}

/**
 * Loads every available article date (listed in data/articles/index.json) into
 * the store, so Practice can reach previous days and build an all-questions
 * random test — not just the days the user has already opened in the feed.
 *
 * Requests are shared between mounts and revalidated after a short TTL. There
 * is no AbortController: under React StrictMode the effect is invoked twice in
 * development, and aborting the first cleanup would cancel the shared fetch.
 */
export function useAllArticles() {
  const mergeArticles = useAppStore((s) => s.mergeArticles)
  const [loading, setLoading] = useState(() => {
    if (!archiveMerged || !archiveSnapshot) return true
    const current = useAppStore.getState().articlesByDate
    return Object.keys(archiveSnapshot).some(date => !current[date])
  })

  useEffect(() => {
    let mounted = true
    loadArticleArchive()
      .then((archive) => {
        const current = useAppStore.getState().articlesByDate
        const archiveMissing = Object.entries(archive).some(([date, articles]) =>
          !current[date] || current[date].length !== articles.length)
        if (!archiveMerged || archiveMissing) {
          mergeArticles(archive)
        }
        archiveMerged = true
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [mergeArticles])

  return { loading }
}
