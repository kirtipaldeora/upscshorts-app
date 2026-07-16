import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
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
import { useFocusRuntime } from '@/hooks/useFocusRuntime'
import { useFocusCloudSync } from '@/hooks/useFocusCloudSync'
import { useFocusStore } from '@/stores/useFocusStore'
import { useThemeStore } from '@/stores/useThemeStore'
import type { FocusSession } from '@/types/focus'
import { BreakAlarm } from '@/components/focus/BreakAlarm'
import { MotivationCelebration } from '@/components/ui/MotivationCelebration'

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
const FocusExperience = lazy(() => import('@/components/focus/FocusExperience').then(module => ({ default: module.FocusExperience })))

type AppPhase = 'splash' | 'auth' | 'profile' | 'main'
type BreakAlarmState = { id: string; phase: 'short-break' | 'long-break' }

function getInitialPhase(): AppPhase {
  return 'splash'
}

function phaseForCurrentAccount(): Exclude<AppPhase, 'splash'> {
  const { user, profile, isGuest } = useAuthStore.getState()
  if (isGuest) return 'main'
  if (!user) return 'auth'
  return profile ? 'main' : 'profile'
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(getInitialPhase)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [mainsRecordOpen, setMainsRecordOpen] = useState<MainsRecord | null>(null)
  const [streakRecoveryOpen, setStreakRecoveryOpen] = useState(false)
  const [streakCelebrationOpen, setStreakCelebrationOpen] = useState(false)
  const streakOpeningChecked = useRef(false)
  const { activeScreen, overlayScreen, setOverlay, setScreen, goBack } = useAppStore()
  const { user, profile, isGuest, bootstrap } = useAuthStore()
  const { settings, stats } = usePracticeStore()
  const { message: toastMsg, show: showToast, clear: clearToast } = useToast()
  const [breakAlarm, setBreakAlarm] = useState<BreakAlarmState | null>(null)
  const [extendingBreak, setExtendingBreak] = useState(false)
  const focusAlarmSoundEnabled = useFocusStore(state => state.settings.soundsEnabled)
  const autoShufflePalette = useThemeStore(state => state.autoShufflePalette)
  const paletteIntervalHours = useThemeStore(state => state.paletteIntervalHours)
  const paletteChangedAt = useThemeStore(state => state.paletteChangedAt)
  const randomizePalette = useThemeStore(state => state.randomizePalette)
  const handleFocusComplete = useCallback((session: FocusSession) => {
    if (session.completionReason !== 'timer' || session.phase === 'focus') return
    setBreakAlarm({ id: session.id, phase: session.phase })
  }, [])
  const focusRuntime = useFocusRuntime({ onComplete: handleFocusComplete, onShowToast: showToast })
  useFocusCloudSync(showToast)

  useEffect(() => {
    if (!autoShufflePalette) return
    const intervalMs = paletteIntervalHours * 60 * 60 * 1_000
    const dueIn = Math.max(500, paletteChangedAt + intervalMs - Date.now())
    const timer = window.setTimeout(randomizePalette, dueIn)
    return () => window.clearTimeout(timer)
  }, [autoShufflePalette, paletteChangedAt, paletteIntervalHours, randomizePalette])

  const finishBreakAlarm = useCallback(() => {
    const preparedFocus = useFocusStore.getState().activeTimer
    let resumed = false
    if (preparedFocus?.phase === 'focus' && preparedFocus.status === 'paused' && preparedFocus.segments.length === 0) {
      resumed = focusRuntime.resume(Date.now())
    }
    setBreakAlarm(null)
    showToast(resumed ? 'Break finished. Your next focus block has started.' : 'Break finished. Start again when you are ready.')
  }, [focusRuntime, showToast])

  const extendBreakAlarm = useCallback(async () => {
    if (!breakAlarm || extendingBreak) return
    setExtendingBreak(true)
    const id = await focusRuntime.replaceWithBreak({
      kind: breakAlarm.phase,
      plannedDurationMs: 5 * 60 * 1_000,
      at: Date.now(),
    })
    setExtendingBreak(false)
    if (!id) {
      showToast('The break could not be extended. Please try again.')
      return
    }
    setBreakAlarm(null)
    showToast('Break extended by five minutes.')
  }, [breakAlarm, extendingBreak, focusRuntime, showToast])

  const changeBreakAlarmSound = useCallback((enabled: boolean) => {
    useFocusStore.getState().updateSettings({ soundsEnabled: enabled })
  }, [])

  const handleSplashDone = useCallback(async () => {
    await bootstrap()
    setPhase(phaseForCurrentAccount())
  }, [bootstrap])

  const handleAuthenticated = useCallback(() => {
    setPhase(phaseForCurrentAccount())
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

  useEffect(() => {
    if (phase !== 'main' || streakOpeningChecked.current) return
    streakOpeningChecked.current = true
    const lost = stats.streak.count === 0 && Boolean(stats.streak.last) && stats.streak.last < YESTERDAY
    const shownToday = localStorage.getItem('penni.streak-celebration-shown') === TODAY
    if (lost || stats.streak.count < 1 || shownToday) return
    const timer = window.setTimeout(() => {
      localStorage.setItem('penni.streak-celebration-shown', TODAY)
      setStreakCelebrationOpen(true)
    }, 900)
    return () => window.clearTimeout(timer)
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
    if (!profile) return
    try { localStorage.setItem('penni-read-lang', profile.language === 'hindi' ? 'hi' : 'en') } catch { /* noop */ }
    useAppStore.getState().setGsFilter({
      'GS 1': profile.gsFocus.includes('GS 1'),
      'GS 2': profile.gsFocus.includes('GS 2'),
      'GS 3': profile.gsFocus.includes('GS 3'),
      'GS 4': profile.gsFocus.includes('GS 4'),
    })
    const practice = usePracticeStore.getState()
    if (practice.settings.name !== profile.name || practice.settings.target !== profile.dailyTarget) {
      practice.saveSettings({ name: profile.name, target: profile.dailyTarget })
    }
  }, [profile])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return
      // Supabase warns against awaiting another auth call directly inside its
      // callback. Move the refresh to the next task, then resolve the visible
      // phase from the freshly bootstrapped account.
      window.setTimeout(() => {
        void bootstrap().then(() => setPhase(phaseForCurrentAccount()))
      }, 0)
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
          {activeScreen === 'focus' && (
            <Suspense fallback={<PenniLoader label="Opening Focus" full />}>
              <FocusExperience runtime={focusRuntime} onShowToast={showToast} />
            </Suspense>
          )}
          {activeScreen === 'settings' && (
            <Suspense fallback={<PenniLoader label="Opening settings" full />}>
              <SettingsScreen
                onClose={() => goBack('profile')}
                onShowToast={showToast}
                onOpenImport={() => setUploadVisible(true)}
              />
            </Suspense>
          )}
        </div>

        {/* Bottom navigation is reserved for the five core study areas. */}
        {(['feed', 'revise', 'maps', 'focus', 'practice'] as const).includes(activeScreen as 'feed' | 'revise' | 'maps' | 'focus' | 'practice') && <BottomNav />}
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

      {streakCelebrationOpen && (
        <MotivationCelebration
          variant="streak"
          icon="🔥"
          eyebrow={stats.streak.last === TODAY ? 'Today is protected' : 'Welcome back'}
          title={stats.streak.last === TODAY ? `${stats.streak.count}-day streak secured` : `${stats.streak.count}-day streak is waiting`}
          message={stats.streak.last === TODAY
            ? 'You showed up again. Small, consistent study sessions are becoming a serious advantage.'
            : 'One focused activity today keeps your momentum alive. You do not need a perfect day—just a return.'}
          durationMs={3300}
          onDismiss={() => setStreakCelebrationOpen(false)}
        />
      )}

      {breakAlarm && (
        <BreakAlarm
          key={breakAlarm.id}
          breakKind={breakAlarm.phase}
          soundEnabled={focusAlarmSoundEnabled}
          extending={extendingBreak}
          onFinish={finishBreakAlarm}
          onExtend={extendBreakAlarm}
          onSoundChange={changeBreakAlarmSound}
        />
      )}
    </>
  )
}
