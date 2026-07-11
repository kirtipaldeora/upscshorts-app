import { create } from 'zustand'
import {
  getSupabase,
  isSupabaseConfigured,
  sendPhoneOtp,
  signInWithProvider,
  verifyPhoneOtp,
  type PenniAuthProvider,
} from '@/lib/authClient'

const USER_KEY = 'penni.auth.user'
const PROFILE_KEY = 'penni.auth.profile'
const GUEST_KEY = 'penni.auth.guest'

export type AuthMethod = PenniAuthProvider | 'phone' | 'local'

export interface PenniUser {
  id: string
  method: AuthMethod
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
}

export interface StudentProfile {
  name: string
  phone: string
  mascotId: string
  attemptYear: string
  prepStage: string
  targetExam: string
  language: 'english' | 'hinglish' | 'hindi'
  dailyTarget: number
  gsFocus: string[]
  optionalSubject: string
}

interface AuthStore {
  user: PenniUser | null
  profile: StudentProfile | null
  isGuest: boolean
  ready: boolean
  loading: boolean
  error: string | null
  supabaseConfigured: boolean
  bootstrap: () => Promise<void>
  signInOAuth: (provider: PenniAuthProvider) => Promise<void>
  sendOtp: (phone: string) => Promise<void>
  verifyOtp: (phone: string, otp: string) => Promise<void>
  saveProfile: (profile: StudentProfile) => Promise<void>
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function writeJson<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* noop */ }
}

function makeLocalUser(method: AuthMethod, patch: Partial<PenniUser> = {}): PenniUser {
  return {
    id: patch.id ?? `local-${Date.now()}`,
    method,
    name: patch.name,
    email: patch.email,
    phone: patch.phone,
    avatarUrl: patch.avatarUrl,
  }
}

function normalizeProfile(profile: StudentProfile | null): StudentProfile | null {
  if (!profile) return null
  return {
    ...profile,
    mascotId: profile.mascotId || 'penni-red',
    dailyTarget: profile.dailyTarget || 10,
    gsFocus: profile.gsFocus?.length ? profile.gsFocus : ['GS 1', 'GS 2', 'GS 3'],
  }
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  profile: null,
  isGuest: false,
  ready: false,
  loading: false,
  error: null,
  supabaseConfigured: isSupabaseConfigured(),

  bootstrap: async () => {
    set({ loading: true, error: null })
    try {
      const profile = normalizeProfile(readJson<StudentProfile>(PROFILE_KEY))
      const savedUser = readJson<PenniUser>(USER_KEY)
      let isGuest = localStorage.getItem(GUEST_KEY) === '1'
      if (savedUser?.id === 'guest' || savedUser?.method === 'local') {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(PROFILE_KEY)
        isGuest = true
        localStorage.setItem(GUEST_KEY, '1')
      }
      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        const sessionUser = data.session?.user
        if (sessionUser) {
          const user: PenniUser = {
            id: sessionUser.id,
            method: (sessionUser.app_metadata?.provider as AuthMethod) || 'local',
            name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name,
            email: sessionUser.email,
            phone: sessionUser.phone,
            avatarUrl: sessionUser.user_metadata?.avatar_url,
          }
          writeJson(USER_KEY, user)
          localStorage.removeItem(GUEST_KEY)
          set({ user, profile, isGuest: false, ready: true, loading: false })
          return
        }
      }
      set({
        user: isGuest ? null : savedUser,
        profile: isGuest ? null : profile,
        isGuest,
        ready: true,
        loading: false,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not start login', ready: true, loading: false })
    }
  },

  signInOAuth: async (provider) => {
    set({ loading: true, error: null })
    try {
      const result = await signInWithProvider(provider)
      if (result.localFallback) {
        const user = makeLocalUser(provider, {
          name: provider === 'apple' ? 'Apple Student' : 'Google Student',
          email: provider === 'google' ? 'student@penni.local' : undefined,
        })
        writeJson(USER_KEY, user)
        localStorage.removeItem(GUEST_KEY)
        set({ user, isGuest: false, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed', loading: false })
    }
  },

  sendOtp: async (phone) => {
    set({ loading: true, error: null })
    try {
      await sendPhoneOtp(phone)
      set({ loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not send OTP', loading: false })
    }
  },

  verifyOtp: async (phone, otp) => {
    set({ loading: true, error: null })
    try {
      const result = await verifyPhoneOtp(phone, otp)
      const user = result && 'id' in result
        ? makeLocalUser('phone', { id: result.id, phone: result.phone ?? phone })
        : makeLocalUser('phone', { phone })
      writeJson(USER_KEY, user)
      localStorage.removeItem(GUEST_KEY)
      set({ user, isGuest: false, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'OTP verification failed', loading: false })
    }
  },

  saveProfile: async (profile) => {
    set({ loading: true, error: null })
    try {
      const cleanProfile = normalizeProfile(profile) ?? profile
      const user = get().user
      const supabase = getSupabase()
      if (supabase && user) {
        const profileRow = {
          id: user.id,
          full_name: cleanProfile.name,
          phone: cleanProfile.phone,
          mascot_id: cleanProfile.mascotId,
          attempt_year: cleanProfile.attemptYear,
          prep_stage: cleanProfile.prepStage,
          target_exam: cleanProfile.targetExam,
          language: cleanProfile.language,
          daily_target: cleanProfile.dailyTarget,
          gs_focus: cleanProfile.gsFocus,
          optional_subject: cleanProfile.optionalSubject,
          updated_at: new Date().toISOString(),
        }
        const { error } = await supabase.from('profiles').upsert(profileRow)
        if (error) {
          const fallbackRow = { ...profileRow }
          delete (fallbackRow as Partial<typeof profileRow>).mascot_id
          const { error: fallbackError } = await supabase.from('profiles').upsert(fallbackRow)
          if (fallbackError) throw fallbackError
        }
      }
      writeJson(PROFILE_KEY, cleanProfile)
      localStorage.removeItem(GUEST_KEY)
      try { localStorage.setItem('u4ob', '1') } catch { /* legacy onboarding marker */ }
      set({ profile: cleanProfile, isGuest: false, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not save profile', loading: false })
    }
  },

  continueAsGuest: async () => {
    set({ loading: true, error: null })
    try {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(PROFILE_KEY)
      localStorage.setItem(GUEST_KEY, '1')
      localStorage.setItem('u4ob', '1')
    } catch { /* noop */ }
    set({ user: null, profile: null, isGuest: true, loading: false })
  },

  signOut: async () => {
    set({ loading: true, error: null })
    try {
      await getSupabase()?.auth.signOut()
    } catch { /* local sign out should still proceed */ }
    try {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(PROFILE_KEY)
      localStorage.removeItem(GUEST_KEY)
      localStorage.removeItem('u4ob')
    } catch { /* noop */ }
    set({ user: null, profile: null, isGuest: false, loading: false })
  },

  clearError: () => set({ error: null }),
}))
