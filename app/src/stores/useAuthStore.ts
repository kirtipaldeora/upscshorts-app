import { create } from 'zustand'
import {
  getSupabase,
  isSupabaseConfigured,
  sendPhoneOtp,
  signInWithProvider,
  verifyPhoneOtp,
  type PenniAuthProvider,
} from '@/lib/authClient'
import { prepareStudentState } from '@/lib/studentDataClient'

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
  email: string
  gender: '' | 'female' | 'male' | 'non-binary' | 'prefer-not-to-say'
  dateOfBirth: string
  photoUrl: string
  emailUpdates: boolean
  whatsappUpdates: boolean
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
  sendOtp: (phone: string) => Promise<boolean>
  verifyOtp: (phone: string, otp: string) => Promise<boolean>
  saveProfile: (profile: StudentProfile) => Promise<boolean>
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<boolean>
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
    email: profile.email || '',
    gender: profile.gender || '',
    dateOfBirth: profile.dateOfBirth || '',
    photoUrl: profile.photoUrl || '',
    emailUpdates: profile.emailUpdates === true,
    whatsappUpdates: profile.whatsappUpdates === true,
    mascotId: profile.mascotId || 'penni-red',
    dailyTarget: profile.dailyTarget || 10,
    gsFocus: profile.gsFocus?.length ? profile.gsFocus : ['GS 1', 'GS 2', 'GS 3'],
  }
}

async function readCloudProfile(userId: string): Promise<StudentProfile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return normalizeProfile({
    name: data.full_name ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    gender: data.gender ?? '',
    dateOfBirth: data.date_of_birth ?? '',
    photoUrl: data.photo_url ?? '',
    emailUpdates: data.email_updates === true,
    whatsappUpdates: data.whatsapp_updates === true,
    mascotId: data.mascot_id ?? 'penni-red',
    attemptYear: data.attempt_year ?? '',
    prepStage: data.prep_stage ?? 'Foundation',
    targetExam: data.target_exam ?? 'CSE 2027',
    language: data.language ?? 'english',
    dailyTarget: data.daily_target ?? 10,
    gsFocus: Array.isArray(data.gs_focus) ? data.gs_focus : [],
    optionalSubject: data.optional_subject ?? '',
  })
}

function clearAccountCache() {
  [USER_KEY, PROFILE_KEY, GUEST_KEY, 'u4ob', 'u4stats', 'u4set', 'u4qbm', 'u4mq', 'u4bm']
    .forEach(key => localStorage.removeItem(key))
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
      let profile = normalizeProfile(readJson<StudentProfile>(PROFILE_KEY))
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
          let syncError: string | null = null
          try {
            const [cloudProfile] = await Promise.all([
              readCloudProfile(user.id),
              prepareStudentState(user.id),
            ])
            if (cloudProfile) {
              profile = cloudProfile
              writeJson(PROFILE_KEY, cloudProfile)
            }
          } catch (error) {
            syncError = error instanceof Error ? error.message : 'Cloud sync is temporarily unavailable'
          }
          set({ user, profile, isGuest: false, ready: true, loading: false, error: syncError })
          return
        }
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(PROFILE_KEY)
        set({ user: null, profile: null, isGuest, ready: true, loading: false })
        return
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
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not send OTP', loading: false })
      return false
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
      let syncError: string | null = null
      let profile = normalizeProfile(readJson<StudentProfile>(PROFILE_KEY))
      try {
        const [cloudProfile] = await Promise.all([
          readCloudProfile(user.id),
          prepareStudentState(user.id),
        ])
        if (cloudProfile) {
          profile = cloudProfile
          writeJson(PROFILE_KEY, cloudProfile)
        }
      } catch (error) {
        syncError = error instanceof Error ? error.message : 'Signed in, but cloud sync is temporarily unavailable'
      }
      set({ user, profile, isGuest: false, loading: false, error: syncError })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'OTP verification failed', loading: false })
      return false
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
          email: cleanProfile.email,
          gender: cleanProfile.gender,
          date_of_birth: cleanProfile.dateOfBirth || null,
          photo_url: cleanProfile.photoUrl,
          email_updates: cleanProfile.emailUpdates,
          email_consent_at: cleanProfile.emailUpdates ? new Date().toISOString() : null,
          whatsapp_updates: cleanProfile.whatsappUpdates,
          whatsapp_consent_at: cleanProfile.whatsappUpdates ? new Date().toISOString() : null,
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
        if (error) throw error
        if (cleanProfile.emailUpdates && (cleanProfile.email || user.email)) {
          const { error: welcomeError } = await supabase.functions.invoke('send-welcome-email')
          if (welcomeError) console.warn('Penni welcome email was not sent', welcomeError)
        }
      }
      writeJson(PROFILE_KEY, cleanProfile)
      if (user) {
        const nextUser = { ...user, name: cleanProfile.name, phone: user.method === 'phone' ? user.phone : cleanProfile.phone }
        writeJson(USER_KEY, nextUser)
        set({ user: nextUser })
      }
      localStorage.removeItem(GUEST_KEY)
      try { localStorage.setItem('u4ob', '1') } catch { /* legacy onboarding marker */ }
      set({ profile: cleanProfile, isGuest: false, loading: false })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not save profile', loading: false })
      return false
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
      clearAccountCache()
    } catch { /* noop */ }
    set({ user: null, profile: null, isGuest: false, loading: false })
  },

  deleteAccount: async () => {
    set({ loading: true, error: null })
    try {
      const supabase = getSupabase()
      const user = get().user
      if (supabase && user) {
        const { error } = await supabase.rpc('delete_own_account')
        if (error) throw error
        await supabase.auth.signOut()
      }
      clearAccountCache()
      set({ user: null, profile: null, isGuest: false, loading: false })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not delete account', loading: false })
      return false
    }
  },

  clearError: () => set({ error: null }),
}))
