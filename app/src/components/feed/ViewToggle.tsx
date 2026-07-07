import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLayerGroup, faList } from '@fortawesome/free-solid-svg-icons'
import { useAppStore, type ViewMode } from '@/stores/useAppStore'

export function ViewToggle() {
  const { viewMode, setViewMode } = useAppStore()

  function btn(mode: ViewMode, icon: typeof faLayerGroup, label: string) {
    const active = viewMode === mode
    return (
      <button
        key={mode}
        onClick={() => setViewMode(mode)}
        aria-label={label}
        className={active ? 'active' : ''}
        style={{
          width: 40,
          height: 34,
          borderRadius: 13,
          border: active ? '1px solid transparent' : '1px solid var(--panel-border)',
          background: active ? '#fff' : 'var(--panel2)',
          backdropFilter: 'blur(12px)',
          color: active ? '#4A4E8C' : 'var(--on2)',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s',
          boxShadow: active ? 'var(--shadow-soft)' : 'none',
        }}
      >
        <FontAwesomeIcon icon={icon} />
      </button>
    )
  }

  return (
    <div
      className="view-toggle"
      style={{
        display: 'flex',
        gap: 6,
        justifyContent: 'center',
        padding: '0 20px 10px',
        position: 'relative',
        zIndex: 2,
        flexShrink: 0,
      }}
    >
      {btn('deck', faLayerGroup, 'Card view')}
      {btn('list', faList, 'List view')}
    </div>
  )
}
