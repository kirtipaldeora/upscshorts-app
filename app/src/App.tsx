import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { BottomNav } from '@/components/layout/BottomNav'
import { PenniLoader } from '@/components/layout/PenniLoader'
import { FeedScreen } from '@/components/feed/FeedScreen'
import { PenniLogin } from '@/components/auth/PenniLogin'
import { StudentProfileForm } from '@/components/auth/StudentProfileForm'
import { Toast, useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { startStudentStateSync } from '@/lib/studentDataClient'
import { getSupabase } from '@/lib/authClient'
import type { MainsRecord } from '@/hooks/useMainsDB'
import { TODAY, YESTERDAY } from '@/constants/categories'
import { StreakRecoverySheet } from '@/components/profile/StreakRecoverySheet'

// Heavy / seldom-used screens are code-split so they never bloat first load.
const ReviseScreen = lazy(() => import('@/components/revise/ReviseScreen').then(module => ({ default: module.ReviseScreen })))
const SearchScreen = lazy(() => import('@/components/search/SearchScreen').then(module => ({ default: module.SearchScreen })))
const BookmarksScreen = lazy(() => import('@/components/bookmarks/BookmarksScreen').then(module => ({ default: module.BookmarksScreen })))
const ProfileScreen = lazy(() => import('@/components/profile/ProfileScreen').then(module => ({ default: module.ProfileScreen })))
const PracticeScreen = lazy(() => import('@/components/practice/PracticeScreen').then(module => ({ default: module.PracticeScreen })))
const SettingsScreen = lazy(() => import('@/components/settings/SettingsScreen').then(module => ({ default: module.SettingsScreen })))
const DeepDive = lazy(() => import('@/components/deep-dive/DeepDive').then(module => ({ default: module.DeepDive })))
const Digest = lazy(() => import('@/components/feed/Digest').then(module => ({ default: module.Digest })))
const ImportSheet = lazy(() => import('@/components/upload/ImportSheet').then(module => ({ default: module.ImportSheet })))
const NewsGlobe = lazy(() => import('@/components/news-globe/NewsGlobe'))
const MapsArcade = lazy(() => import('@/components/maps-arcade/MapsArcade').then(module => ({ default: module.MapsArcade })))
const PYQVault = lazy(() => import('@/components/pyq-vault/PYQVault').then(module => ({ default: module.PYQVault })))
const MainsScreen = lazy(() => import('@/components/practice/MainsScreen').then(module => ({ default: module.MainsScreen })))

type AppPhase = 'splash' | 'auth' | 'profile' | 'main'

function getInitialPhase(): AppPhase {
  return 'splash'
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(getInitialPhase)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [mainsRecordOpen, setMainsRecordOpen] = useState<MainsRecord | null>(null)
  const [streakRecoveryOpen, setStreakRecoveryOpen] = useState(false)
  const { activeScreen, overlayScreen, setOverlay, setScreen } = useAppStore()
  const { user, profile, isGuest, bootstrap } = useAuthStore()
  const { settings, stats } = usePracticeStore()
  const { message: toastMsg, show: showToast, clear: clearToast } = useToast()

  const handleSplashDone = useCallback(async () => {
    await bootstrap()
    const state = useAuthStore.getState()
    setPhase(state.isGuest ? 'main' : state.user ? (state.profile ? 'main' : 'profile') : 'auth')
  }, [bootstrap])

  const handleAuthenticated = useCallback(() => {
    const state = useAuthStore.getState()
    setPhase(state.isGuest ? 'main' : state.profile ? 'main' : 'profile')
  }, [])

  useEffect(() => {
    if (phase !== 'main' || !settings.remind) return
    const [hourRaw, minuteRaw] = (settings.reminderTime || '19:00').split(':')
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return
    const now = new Date()
    const next = new Date()
    next.setHours(hour, minute, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const timeout = window.setTimeout(() => {
      showToast('Penni reminder: review a few mistakes before you close today.')
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Penni revision reminder', {
          body: 'Review mistakes or finish today’s practice target.',
        })
      }
    }, Math.min(next.getTime() - now.getTime(), 2147483647))
    return () => window.clearTimeout(timeout)
  }, [phase, settings.remind, settings.reminderTime, showToast])

  useEffect(() => {
    if (phase !== 'main') return
    const lost = stats.streak.count === 0 && Boolean(stats.streak.last) && stats.streak.last < YESTERDAY
    const dismissed = localStorage.getItem('penni.streak-recovery-dismissed') === TODAY
    setStreakRecoveryOpen(lost && !dismissed)
  }, [phase, stats.streak.count, stats.streak.last])

  const dismissStreakRecovery = useCallback(() => {
    localStorage.setItem('penni.streak-recovery-dismissed', TODAY)
    setStreakRecoveryOpen(false)
  }, [])

  useEffect(() => {
    if (phase !== 'main' || !user || isGuest) return
    return startStudentStateSync(user.id)
  }, [phase, user?.id, isGuest])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return
      window.setTimeout(() => void bootstrap(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [bootstrap])

  if (phase === 'splash') {
    return <SplashScreen onDone={handleSplashDone} />
  }

  if (phase === 'auth' || (!user && !isGuest)) {
    return <PenniLogin onAuthenticated={handleAuthenticated} />
  }

  if (!isGuest && (phase === 'profile' || !profile)) {
    return <StudentProfileForm onComplete={() => setPhase('main')} />
  }

  return (
    <>
      {/* Background gradient */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--app-bg)',
          zIndex: 0,
        }}
      />

      {/* Ambient animated backdrop — slow-drifting color fields */}
      <div className="bg-blobs" aria-hidden="true">
        <i /><i /><i />
      </div>

      {/* Ambient glass sheen */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--app-sheen)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Main app container */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          paddingTop: 'env(safe-area-inset-top)',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Screen router — only one screen active at a time */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {activeScreen === 'feed' && (
            <FeedScreen
              onShowToast={showToast}
              onOpenUpload={() => setUploadVisible(true)}
            />
          )}
          {activeScreen === 'revise' && (
            <Suspense fallback={<PenniLoader label="Opening revision" full />}>
              <ReviseScreen />
            </Suspense>
          )}
          {activeScreen === 'search' && (
            <Suspense fallback={<PenniLoader label="Opening search" full />}>
              <SearchScreen />
            </Suspense>
          )}
          {activeScreen === 'bookmarks' && (
            <Suspense fallback={<PenniLoader label="Opening bookmarks" full />}>
              <BookmarksScreen onShowToast={showToast} />
            </Suspense>
          )}
          {activeScreen === 'practice' && (
            <Suspense fallback={<PenniLoader label="Preparing practice" full />}>
              <PracticeScreen
                onShowToast={showToast}
                onOpenPYQ={() => setOverlay('pyq-vault')}
                onOpenMains={() => setOverlay('mains')}
              />
            </Suspense>
          )}
          {activeScreen === 'profile' && (
            <Suspense fallback={<PenniLoader label="Opening profile" full />}>
              <ProfileScreen
                onOpenSettings={() => setScreen('settings')}
                onOpenMainsRecord={(rec) => setMainsRecordOpen(rec)}
                onShowToast={showToast}
              />
            </Suspense>
          )}
          {activeScreen === 'maps' && (
            <Suspense fallback={<PenniLoader label="Loading map practice" full />}>
              <MapsArcade />
            </Suspense>
          )}
          {activeScreen === 'settings' && (
            <Suspense fallback={<PenniLoader label="Opening settings" full />}>
              <SettingsScreen
                onClose={() => setScreen('profile')}
                onShowToast={showToast}
                onOpenImport={() => setUploadVisible(true)}
              />
            </Suspense>
          )}
        </div>

        {/* Bottom navigation */}
        <BottomNav />
      </div>

      {/* ── Overlay screens (slide over the main app) ── */}

      {/* Deep Dive */}
      {overlayScreen === 'deep-dive' && (
        <Suspense fallback={<PenniLoader label="Opening Deep Dive" full />}>
          <DeepDive onShowToast={showToast} />
        </Suspense>
      )}

      {/* Daily Digest */}
      {overlayScreen === 'digest' && (
        <Suspense fallback={<PenniLoader label="Preparing digest" full />}>
          <Digest />
        </Suspense>
      )}

      {/* News Globe (3D world) */}
      {overlayScreen === 'news-globe' && (
        <Suspense fallback={<PenniLoader label="Opening News Globe" full />}>
          <NewsGlobe />
        </Suspense>
      )}

      {/* PYQ Vault */}
      {overlayScreen === 'pyq-vault' && (
        <Suspense fallback={<PenniLoader label="Opening PYQ Vault" full />}>
          <PYQVault />
        </Suspense>
      )}

      {/* Maps Arcade overlay entry, used from Revise and other cards */}
      {overlayScreen === 'maps-arcade' && (
        <Suspense fallback={<PenniLoader label="Loading map practice" full />}>
          <MapsArcade />
        </Suspense>
      )}

      {/* Mains Screen */}
      {overlayScreen === 'mains' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <Suspense fallback={<PenniLoader label="Opening Mains" full />}>
            <MainsScreen
              onClose={() => setOverlay(null)}
              onShowToast={showToast}
              onOpenSettings={() => {
                setOverlay(null)
                setScreen('settings')
              }}
            />
          </Suspense>
        </div>
      )}

      {/* Import sheet */}
      {uploadVisible && (
        <Suspense fallback={<PenniLoader label="Opening import" full />}>
          <ImportSheet
            visible={uploadVisible}
            onClose={() => setUploadVisible(false)}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {/* Toast notifications */}
      <Toast message={toastMsg} onClear={clearToast} />

      {streakRecoveryOpen && (
        <StreakRecoverySheet
          lastStreak={stats.streak.longest}
          onDismiss={dismissStreakRecovery}
          onPractice={() => {
            dismissStreakRecovery()
            setScreen('practice')
          }}
        />
      )}
    </>
  )
}
