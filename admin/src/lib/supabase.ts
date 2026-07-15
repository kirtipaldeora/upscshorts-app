import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Public base of the `content` bucket. Publishing writes here; Penni reads here. */
export const CONTENT_BASE = (import.meta.env.VITE_CONTENT_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

let client: SupabaseClient | null = null

export function isConfigured() {
  return Boolean(URL && ANON)
}

/**
 * Unlike Penni's getSupabase(), this throws when unconfigured. The CMS has no
 * offline mode worth having — an editor who thinks they saved but didn't is
 * worse than an editor who sees an error.
 */
export function supabase(): SupabaseClient {
  if (!URL || !ANON) {
    throw new Error('Supabase is not configured. Copy admin/.env.example to admin/.env and fill it in.')
  }
  if (!client) {
    client = createClient(URL, ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
