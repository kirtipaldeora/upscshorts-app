import { useState, useCallback, lazy, Suspense } from 'react'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { Onboarding } from '@/components/layout/Onboarding'
import { BottomNav } from '@/components/layout/BottomNav'
import { FeedScreen } from '@/components/feed/FeedScreen'
import { ReviseScreen } from '@/components/revise/ReviseScreen'
import { SearchScreen } from '@/components/search/SearchScreen'
import { BookmarksScreen } from '@/components/bookmarks/BookmarksScreen'
import { ProfileScreen } from '@/components/profile/ProfileScreen'
import { PracticeScreen } from '@/components/practice/PracticeScreen'
import { MainsScreen } from '@/components/practice/MainsScreen'
import { SettingsScreen } from '@/components/settings/SettingsScreen'
import { DeepDive } from '@/components/deep-dive/DeepDive'
import { ImportSheet } from '@/components/upload/ImportSheet'
import { MapsArcade } from '@/components/maps-arcade/MapsArcade'
import { PYQVault } from '@/components/pyq-vault/PYQVault'
import { Digest } from '@/components/feed/Digest'
import { Toast, useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/stores/useAppStore'
import type { MainsRecord } from '@/hooks/useMainsDB'

// Heavy / seldom-used screens are code-split so they never bloat first load.
const NewsGlobe = lazy(() => import('@/components/news-globe/NewsGlobe'))

type AppPhase = 'splash' | 'onboarding' | 'main'

function getInitialPhase(): AppPhase {
  return 'splash'
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(getInitialPhase)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [mainsRecordOpen, setMainsRecordOpen] = useState<MainsRecord | null>(null)
  const { activeScreen, overlayScreen, setOverlay, setScreen } = useAppStore()
  const { message: toastMsg, show: showToast, clear: clearToast } = useToast()

  const handleSplashDone = useCallback(() => {
    try {
      const u4ob = localStorage.getItem('u4ob')
      if (u4ob === '1' || u4ob === 'true') {
        setPhase('main')
      } else {
        setPhase('onboarding')
      }
    } catch {
      setPhase('onboarding')
    }
  }, [])

  const handleOnboardingDone = useCallback(() => {
    setPhase('main')
  }, [])

  if (phase === 'splash') {
    return <SplashScreen onDone={handleSplashDone} />
  }

  if (phase === 'onboarding') {
    return <Onboarding onDone={handleOnboardingDone} />
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
          {activeScreen === 'revise' && <ReviseScreen />}
          {activeScreen === 'search' && <SearchScreen />}
          {activeScreen === 'bookmarks' && <BookmarksScreen onShowToast={showToast} />}
          {activeScreen === 'practice' && (
            <PracticeScreen
              onShowToast={showToast}
              onOpenPYQ={() => setOverlay('pyq-vault')}
              onOpenMains={() => setOverlay('mains')}
            />
          )}
          {activeScreen === 'profile' && (
            <ProfileScreen
              onOpenSettings={() => setScreen('settings')}
              onOpenMainsRecord={(rec) => setMainsRecordOpen(rec)}
            />
          )}
          {activeScreen === 'maps' && <MapsArcade />}
          {activeScreen === 'settings' && (
            <SettingsScreen
              onClose={() => setScreen('profile')}
              onShowToast={showToast}
              onOpenImport={() => setUploadVisible(true)}
            />
          )}
        </div>

        {/* Bottom navigation */}
        <BottomNav />
      </div>

      {/* ── Overlay screens (slide over the main app) ── */}

      {/* Deep Dive */}
      <DeepDive onShowToast={showToast} />

      {/* Daily Digest */}
      <Digest />

      {/* News Globe (3D world) */}
      {overlayScreen === 'news-globe' && (
        <Suspense fallback={<div className="globe-screen"><div className="globe-empty">Loading globe…</div></div>}>
          <NewsGlobe />
        </Suspense>
      )}

      {/* PYQ Vault */}
      {overlayScreen === 'pyq-vault' && <PYQVault />}

      {/* Mains Screen */}
      {overlayScreen === 'mains' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <MainsScreen
            onClose={() => setOverlay(null)}
            onShowToast={showToast}
            onOpenSettings={() => {
              setOverlay(null)
              setScreen('settings')
            }}
          />
        </div>
      )}

      {/* Import sheet */}
      <ImportSheet
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onShowToast={showToast}
      />

      {/* Toast notifications */}
      <Toast message={toastMsg} onClear={clearToast} />
    </>
  )
}
