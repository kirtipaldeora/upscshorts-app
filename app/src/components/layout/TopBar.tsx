import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark,
  faFileImport,
  faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

interface TopBarProps {
  showBack?: boolean
  onBack?: () => void
  onOpenUpload?: () => void
}

export function TopBar({ showBack, onBack, onOpenUpload }: TopBarProps) {
  const { setScreen, setOverlay, categoryFilter, setCategoryFilter } = useAppStore()
  const { profile, user } = useAuthStore()

  function handleBack() {
    if (onBack) {
      onBack()
    } else if (categoryFilter) {
      setCategoryFilter(null)
    }
  }

  const isBackVisible = showBack || !!categoryFilter

  return (
    <div
      className={`top-bar ${isBackVisible ? 'has-back' : ''}`}
      style={{
        height: 58,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        flexShrink: 0,
        background: 'transparent',
        zIndex: 50,
        position: 'relative',
      }}
    >
      {/* Left: back button + title */}
      <div className="top-bar-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isBackVisible && (
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="glass-icon-btn top-back-button"
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              border: '1px solid var(--panel-border)',
              background: 'var(--panel)',
              backdropFilter: 'blur(16px)',
              color: 'var(--on)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        )}
        <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.3, color: 'var(--on)' }}>
          Penni<span style={{ color: 'var(--yellow)' }}>.</span>
        </h1>
      </div>

      {/* Right: action buttons */}
      <div className="top-actions" style={{ display: 'flex', gap: 9 }}>
        <NotificationCenter />
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            aria-label="Import content"
            className="glass-icon-btn top-import-button"
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              border: '1px solid var(--panel-border)',
              background: 'var(--panel)',
              backdropFilter: 'blur(16px)',
              color: 'var(--on)',
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={faFileImport} />
          </button>
        )}
        <button
          onClick={() => setScreen('bookmarks')}
          aria-label="Bookmarks"
          className="glass-icon-btn top-bookmarks-button"
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(16px)',
            color: 'var(--on)',
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <FontAwesomeIcon icon={faBookmark} />
        </button>
        <button
          onClick={() => setOverlay('news-globe')}
          aria-label="Open News Globe"
          className="glass-icon-btn top-maps-button"
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(16px)',
            color: 'var(--on)',
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <FontAwesomeIcon icon={faMapLocationDot} />
        </button>
        <button
          onClick={() => setScreen('profile')}
          aria-label="Open account and profile"
          className="glass-icon-btn top-account-button"
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(16px)',
            color: 'var(--on)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <ProfileAvatar profile={profile} user={user} size="sm" />
        </button>
      </div>
    </div>
  )
}
