import type { Article, ArticlesByDate } from '@penni/types/article'
import { contentQualityIssues, type QuestionQualityIssue } from '@penni/utils/questionQuality'
import { supabase } from './supabase'
import { toArticle, type ArticleRow } from './mapArticle'

/**
 * Publishing renders rows into the byte-for-byte JSON Penni already fetches and
 * uploads it to the `content` bucket:
 *
 *   content/articles/<date>.json   ->  { "<date>": Article[] }
 *   content/articles/index.json    ->  { dates: string[] }      (newest first)
 *
 * Note the per-date file is an ArticlesByDate map keyed by its own date, not a
 * bare array — that is what useArticles/useAllArticles hand to mergeArticles().
 * A bare array would parse without error and merge to nothing.
 *
 * Penni's parsing is unchanged; only the origin moves. Anything that breaks the
 * shape must fail here, loudly, rather than reach a student's feed.
 */

const BUCKET = 'content'

// Snapshots are overwritten in place, so the CDN must not hold a stale copy for
// long. 60s trades a little freshness lag for not hammering origin on every open.
const CACHE_CONTROL = '60'

export interface PublishResult {
  date: string
  count: number
  path: string
}

function upload(path: string, body: unknown) {
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
  return supabase().storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: CACHE_CONTROL,
  })
}

/** Ordering here is what determines feed order in Penni, so it must be deterministic. */
export async function publishedArticlesFor(date: string): Promise<Article[]> {
  const { data, error } = await supabase()
    .from('articles')
    .select('*')
    .eq('date', date)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ArticleRow[]).map(toArticle)
}

/** Every date with at least one published article, newest first. */
async function publishedDates(): Promise<string[]> {
  const { data, error } = await supabase()
    .from('articles')
    .select('date')
    .eq('status', 'published')
    .order('date', { ascending: false })
  if (error) throw error
  return [...new Set((data as { date: string }[]).map(r => r.date))]
}

/**
 * Advisory only — these are the same checks the content pipeline uses, and they
 * are strict enough (2500-char deep dives, 16 sections) that hard-blocking on
 * them would make the CMS unusable. Surface them, let the editor decide.
 */
export function qualityIssuesFor(articles: Article[]): QuestionQualityIssue[] {
  if (!articles.length) return []
  return contentQualityIssues({ [articles[0].date]: articles })
}

/**
 * Publish one date. Rewrites that date's snapshot and the index.
 *
 * The index is rebuilt from the table rather than patched, so unpublishing the
 * last article of a date correctly drops it from the index.
 */
export async function publishDate(date: string): Promise<PublishResult> {
  const articles = await publishedArticlesFor(date)
  const path = `articles/${date}.json`

  // Keyed by date — see the shape note above.
  const body: ArticlesByDate = { [date]: articles }
  const snapshot = await upload(path, body)
  if (snapshot.error) throw snapshot.error

  const index = await upload('articles/index.json', { dates: await publishedDates() })
  if (index.error) throw index.error

  const { data: auth } = await supabase().auth.getUser()
  await supabase().from('publications').insert({
    kind: 'articles',
    ref: date,
    path,
    count: articles.length,
    published_by: auth.user?.id ?? null,
  })

  return { date, count: articles.length, path }
}

export interface PublicationLog {
  id: number
  ref: string
  path: string
  count: number
  published_at: string
}

export async function recentPublications(limit = 10): Promise<PublicationLog[]> {
  const { data, error } = await supabase()
    .from('publications')
    .select('id, ref, path, count, published_at')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as PublicationLog[]
}
