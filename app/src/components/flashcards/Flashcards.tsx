import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'

export function Flashcards() {
  const { activeArticle, overlayScreen, setOverlay } = useAppStore()
  const haptic = useHaptic()
  const [flipped, setFlipped] = useState(false)

  const visible = overlayScreen === 'flashcards'
  const fc = activeArticle?.deepDive.flashcard

  function handleClose() {
    setFlipped(false)
    setOverlay('deep-dive') // go back to deep-dive
  }

  async function handleFlip() {
    await haptic()
    setFlipped((f) => !f)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 250,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <button onClick={handleClose} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 900, flex: 1, color: 'var(--on)' }}>Flashcards</h2>
        <span style={{ fontSize: 12, color: 'var(--on2)', fontWeight: 800 }}>1 / 1</span>
      </div>

      {/* Card container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          perspective: 1000,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          onClick={handleFlip}
          style={{
            width: '100%',
            maxWidth: 350,
            height: 280,
            position: 'relative',
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 26,
              textAlign: 'center',
              boxShadow: 'var(--shadow)',
              background: 'var(--card)',
            }}
          >
            <h3 style={{ fontSize: 11, fontWeight: 900, marginBottom: 12, color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Tap to Reveal
            </h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink)', fontWeight: 700 }}>
              {fc?.front ?? ''}
            </p>
          </div>

          {/* Back */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 26,
              textAlign: 'center',
              boxShadow: 'var(--shadow)',
              background: 'var(--yellow)',
              transform: 'rotateY(180deg)',
            }}
          >
            <p style={{ fontSize: 14, lineHeight: 1.7, fontWeight: 700, color: 'var(--yellow-ink)' }}>
              {fc?.back ?? ''}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          padding: '18px 18px',
          paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <button onClick={handleClose} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <button
          onClick={handleClose}
          style={{
            height: 50,
            width: 'auto',
            padding: '0 18px',
            borderRadius: 18,
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(16px)',
            color: 'var(--on)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Nunito, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Close
        </button>
        <button onClick={handleFlip} className="icon-btn">
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  )
}
