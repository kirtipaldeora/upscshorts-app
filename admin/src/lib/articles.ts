import { supabase } from './supabase'
import type { ArticleRow } from './mapArticle'

/** Every date that has rows at all (drafts included) — drives the date rail. */
export async function allDates(): Promise<string[]> {
  const { data, error } = await supabase()
    .from('articles')
    .select('date')
    .order('date', { ascending: false })
  if (error) throw error
  return [...new Set((data as { date: string }[]).map(r => r.date))]
}

export async function articlesFor(date: string): Promise<ArticleRow[]> {
  const { data, error } = await supabase()
    .from('articles')
    .select('*')
    .eq('date', date)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ArticleRow[]
}

export async function saveArticle(row: ArticleRow): Promise<void> {
  const { data: auth } = await supabase().auth.getUser()
  const { error } = await supabase()
    .from('articles')
    .upsert({ ...row, updated_by: auth.user?.id ?? null })
  if (error) throw error
}

/** Bulk import path — used by the pipeline-JSON importer. */
export async function saveArticles(rows: ArticleRow[]): Promise<void> {
  if (!rows.length) return
  const { data: auth } = await supabase().auth.getUser()
  const stamped = rows.map(r => ({ ...r, updated_by: auth.user?.id ?? null }))
  const { error } = await supabase().from('articles').upsert(stamped)
  if (error) throw error
}

export async function setStatus(id: string, status: 'draft' | 'published'): Promise<void> {
  const { error } = await supabase().from('articles').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase().from('articles').delete().eq('id', id)
  if (error) throw error
}
