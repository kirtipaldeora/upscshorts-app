import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faLayerGroup, faTableCellsLarge } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useAppStore, type ViewMode } from '@/stores/useAppStore'

const VIEW_OPTIONS: ReadonlyArray<{ mode: ViewMode; label: string; icon: IconDefinition }> = [
  { mode: 'deck', label: 'Cards', icon: faLayerGroup },
  { mode: 'global', label: 'Globe', icon: faGlobe },
  { mode: 'list', label: 'Tiles', icon: faTableCellsLarge },
]

export function ViewToggle() {
  const { viewMode, setViewMode } = useAppStore()

  return (
    <div className="view-toggle feed-view-toggle" role="group" aria-label="Feed view">
      {viewMode !== 'global' && (
        <span className="feed-global-doodle" aria-hidden="true">
          <span>Go global!</span>
          <svg viewBox="0 0 76 36" focusable="false">
            <path d="M49 14c8 2 12 7 17 16" />
            <path d="m59 27 7 3-1-8" />
          </svg>
        </span>
      )}
      {VIEW_OPTIONS.map(option => (
        <button
          key={option.mode}
          type="button"
          className={viewMode === option.mode ? 'active' : ''}
          onClick={() => setViewMode(option.mode)}
          aria-label={option.label}
          aria-pressed={viewMode === option.mode}
          title={option.label}
        >
          <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
