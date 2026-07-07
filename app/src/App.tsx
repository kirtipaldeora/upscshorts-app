import { useState, useCallback } from 'react'
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
import { Flashcards } from '@/components/flashcards/Flashcards'
import { ImportSheet } from '@/components/upload/ImportSheet'
import { MapsArcade } from '@/components/maps-arcade/MapsArcade'
import { PYQVault } from '@/components/pyq-vault/PYQVault'
import { Digest } from '@/components/feed/Digest'
import { Toast, useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/stores/useAppStore'
import type { MainsRecord } from '@/hooks/useMainsDB'

type AppPhase = 'splash' | 'onboarding' | 'main'

function getInitialPhase(): AppPhase {
  return 'splash'
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(getInitialPhase)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [mainsRecordOpen, setMainsRecordOpen] = useState<MainsRecord | null>(null)
  const { activeScreen, overlayScreen, setOverlay } = useAppStore()
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
          background: 'linear-gradient(180deg, var(--bg1) 0%, var(--bg2) 55%, var(--bg3) 100%)',
          zIndex: 0,
        }}
      />

      {/* Radial glow overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(500px 360px at 50% -8%, rgba(255,255,255,.12), transparent 60%)',
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
              onOpenMapsArcade={() => setOverlay('maps-arcade')}
              onOpenPYQ={() => setOverlay('pyq-vault')}
              onOpenMains={() => setOverlay('mains')}
            />
          )}
          {activeScreen === 'profile' && (
            <ProfileScreen
              onOpenUpload={() => setUploadVisible(true)}
              onShowToast={showToast}
              onOpenSettings={() => setOverlay('settings')}
              onOpenMainsRecord={(rec) => setMainsRecordOpen(rec)}
            />
          )}
        </div>

        {/* Bottom navigation */}
        <BottomNav
          onOpenPYQ={() => setOverlay('pyq-vault')}
        />
      </div>

      {/* ── Overlay screens (slide over the main app) ── */}

      {/* Deep Dive */}
      <DeepDive onShowToast={showToast} />

      {/* Flashcards */}
      <Flashcards />

      {/* Daily Digest */}
      <Digest />

      {/* Maps Arcade */}
      {overlayScreen === 'maps-arcade' && <MapsArcade />}

      {/* PYQ Vault */}
      {overlayScreen === 'pyq-vault' && <PYQVault />}

      {/* Mains Screen */}
      {overlayScreen === 'mains' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <MainsScreen
            onClose={() => setOverlay(null)}
            onShowToast={showToast}
            onOpenSettings={() => setOverlay('settings')}
          />
        </div>
      )}

      {/* Settings Screen */}
      {overlayScreen === 'settings' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <SettingsScreen
            onClose={() => setOverlay(null)}
            onShowToast={showToast}
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
