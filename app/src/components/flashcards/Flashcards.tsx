import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'

export function Flashcards() {
  const { 
    overlayScreen, 
    setOverlay, 
    flashcardQueue, 
    flashcardIndex, 
    setFlashcardIndex,
    activeArticle 
  } = useAppStore()
  
  const haptic = useHaptic()
  const [flipped, setFlipped] = useState(false)

  const visible = overlayScreen === 'flashcards'
  const fc = flashcardQueue[flashcardIndex]
  const total = flashcardQueue.length

  useEffect(() => {
    if (visible) {
      setFlipped(false)
    }
  }, [visible])

  function handleClose() {
    setFlipped(false)
    // Go back to deep-dive if we have an active article, else clear overlay (return to profile)
    setOverlay(activeArticle ? 'deep-dive' : null)
  }

  async function handleFlip() {
    await haptic()
    setFlipped((f) => !f)
  }

  async function handlePrev() {
    if (flashcardIndex > 0) {
      await haptic()
      setFlipped(false)
      setFlashcardIndex(flashcardIndex - 1)
    }
  }

  async function handleNext() {
    if (flashcardIndex < total - 1) {
      await haptic()
      setFlipped(false)
      setFlashcardIndex(flashcardIndex + 1)
    }
  }

  if (!fc) return null

  return (
    <div id="flashcards" className={visible ? 'active' : ''}>
      {/* Header */}
      <div className="fc-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Flashcards</h2>
        <span className="fc-counter">
          {flashcardIndex + 1} / {total}
        </span>
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
            <p>{fc.front}</p>
          </div>

          {/* Back */}
          <div className="fc-back">
            <p>{fc.back}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="fc-nav">
        <button onClick={handlePrev} aria-label="Previous">
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
        <button onClick={handleNext} aria-label="Next">
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  )
}
