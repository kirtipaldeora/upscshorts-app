import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (visible) {
      setFlipped(false)
    }
  }, [visible])

  function handleClose() {
    setFlipped(false)
    setOverlay('deep-dive') // go back to deep-dive
  }

  async function handleFlip() {
    await haptic()
    setFlipped((f) => !f)
  }

  return (
    <div id="flashcards" className={visible ? 'active' : ''}>
      {/* Header */}
      <div className="fc-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Flashcards</h2>
        <span className="fc-counter">1 / 1</span>
      </div>

      {/* Card container */}
      <div className="fc-container">
        <div
          className={`fc-card ${flipped ? 'flipped' : ''}`}
          onClick={handleFlip}
        >
          {/* Front */}
          <div className="fc-front">
            <h3>Tap to Reveal</h3>
            <p>{fc?.front ?? ''}</p>
          </div>

          {/* Back */}
          <div className="fc-back">
            <p>{fc?.back ?? ''}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="fc-nav">
        <button onClick={handleClose} aria-label="Previous">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <button
          onClick={handleClose}
          style={{
            width: 'auto',
            padding: '0 18px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          Close
        </button>
        <button onClick={handleFlip} aria-label="Next">
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  )
}
