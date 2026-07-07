import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark,
  faMagnifyingGlass,
  faMoon,
  faSun,
  faFileImport,
} from '@fortawesome/free-solid-svg-icons'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAppStore } from '@/stores/useAppStore'

interface TopBarProps {
  showBack?: boolean
  onBack?: () => void
  onOpenUpload?: () => void
}

export function TopBar({ showBack, onBack, onOpenUpload }: TopBarProps) {
  const { theme, toggle } = useThemeStore()
  const { setScreen, categoryFilter, setCategoryFilter } = useAppStore()

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isBackVisible && (
          <button
            onClick={handleBack}
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
          michi<span style={{ color: 'var(--yellow)' }}>.</span>
        </h1>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', gap: 9 }}>
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            aria-label="Import content"
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
          onClick={() => setScreen('search')}
          aria-label="Search"
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
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
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
          <FontAwesomeIcon icon={theme === 'light' ? faMoon : faSun} />
        </button>
      </div>
    </div>
  )
}
