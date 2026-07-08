import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { asset } from '@/utils/asset'

/**
 * Maps Arcade — embeds the original Atlas Arcade (a self-contained d3 + React
 * app served from public/arcade/) via an iframe, so it behaves exactly like the
 * standalone HTML version. A slim app bar provides a way back into Penni.
 */
export function MapsArcade() {
  const setOverlay = useAppStore((s) => s.setOverlay)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
        }}
      >
        <button
          onClick={() => setOverlay(null)}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(16px)',
            color: 'var(--on)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--on)' }}>
          Maps <span style={{ color: 'var(--acc)' }}>Arcade</span>
        </h2>
      </div>

      <iframe
        src={asset('arcade/index.html')}
        title="Maps Arcade"
        style={{ flex: 1, width: '100%', border: 'none', background: 'transparent' }}
        allow="fullscreen"
      />
    </div>
  )
}
