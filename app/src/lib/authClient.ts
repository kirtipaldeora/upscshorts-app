import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type PenniAuthProvider = 'google' | 'apple'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export async function signInWithProvider(provider: PenniAuthProvider) {
  const supabase = getSupabase()
  if (!supabase) return { localFallback: true as const }
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
      scopes: provider === 'google' ? 'email profile' : undefined,
    },
  })
  if (error) throw error
  return { localFallback: false as const }
}

export async function sendPhoneOtp(phone: string) {
  const supabase = getSupabase()
  if (!supabase) return { localFallback: true as const }
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) throw error
  return { localFallback: false as const }
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const supabase = getSupabase()
  if (!supabase) return { localFallback: true as const }
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
  return data.user
}
