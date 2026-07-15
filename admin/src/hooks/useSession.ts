import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isConfigured, supabase } from '@/lib/supabase'

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'unconfigured' }
  | { phase: 'signed-out' }
  /** Authenticated but absent from `editors` — RLS would reject every write. */
  | { phase: 'not-an-editor'; user: User }
  | { phase: 'ready'; user: User; role: 'admin' | 'editor' }

/**
 * Auth gate. Signing in is not enough: the account must also have an `editors`
 * row. That check is a courtesy so the UI can explain itself — the real
 * enforcement is RLS in the database, which this app cannot talk its way past.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ phase: 'loading' })

  useEffect(() => {
    if (!isConfigured()) {
      setState({ phase: 'unconfigured' })
      return
    }

    let cancelled = false

    async function resolve(user: User | null) {
      if (!user) {
        if (!cancelled) setState({ phase: 'signed-out' })
        return
      }
      const { data, error } = await supabase()
        .from('editors')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setState({ phase: 'not-an-editor', user })
        return
      }
      setState({ phase: 'ready', user, role: data.role as 'admin' | 'editor' })
    }

    supabase().auth.getSession().then(({ data }) => resolve(data.session?.user ?? null))
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user ?? null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
