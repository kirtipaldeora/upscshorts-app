import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faShareAlt, faClone, faBullseye, faPenFancy, faCircle } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { CATEGORY_COLORS } from '@/constants/categories'

interface DeepDiveProps {
  onShowToast: (msg: string) => void
}

export function DeepDive({ onShowToast }: DeepDiveProps) {
  const { activeArticle, setOverlay, overlayScreen, setFlashcardQueue, setFlashcardIndex } = useAppStore()
  const haptic = useHaptic()

  const visible = overlayScreen === 'deep-dive'
  const a = activeArticle

  async function handleClose() {
    await haptic()
    setOverlay(null)
  }

  async function handleShare() {
    if (!a) return
    await haptic()
    try {
      if (navigator.share) {
        await navigator.share({ title: a.headline, text: a.summary })
      } else {
        throw new Error('Share API not supported')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(a.headline)
        onShowToast('Copied to clipboard')
      } catch { /* noop */ }
    }
  }

  function openFlashcards() {
    if (a?.deepDive.flashcard) {
      setFlashcardQueue([a.deepDive.flashcard])
      setFlashcardIndex(0)
      setOverlay('flashcards')
    }
  }

  const col = a ? CATEGORY_COLORS[a.category] : '#9DBCE8'

  const fdf = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div id="deep-dive" className={visible ? 'active' : ''}>
      {/* Header */}
      <div className="dd-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>{a?.headline ?? ''}</h2>
        <button onClick={handleShare} aria-label="Share">
          <FontAwesomeIcon icon={faShareAlt} />
        </button>
      </div>

      {/* Body */}
      {a && (
        <div className="dd-body">
          {/* Metadata tags */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              className="tag tag-cat"
              style={{
                color: col,
                borderColor: col + '30',
                background: col + '10',
              }}
            >
              {a.category}
            </span>
            <span className="tag tag-gs">{a.gsPaper}</span>
            <span className="tag tag-src">
              <FontAwesomeIcon
                icon={faCircle}
                style={{ fontSize: 4, verticalAlign: 'middle', marginRight: 4, opacity: 0.6 }}
              />
              {a.source}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', fontWeight: 700 }}>
              {fdf(a.date)}
            </span>
          </div>

          {/* Explanation */}
          <div
            className="dd-explain"
            dangerouslySetInnerHTML={{ __html: a.deepDive.explanation.replace(/\n/g, '<br>') }}
          />

          <div className="dd-divider"></div>

          {/* Prelims Facts */}
          <div style={{ marginBottom: 18 }}>
            <div className="dd-section-title">
              <FontAwesomeIcon icon={faBullseye} style={{ marginRight: 6 }} />
              Prelims Facts
            </div>
            <div className="dd-fact-box">
              <ul style={{ paddingLeft: 14, margin: 0 }}>
                {a.deepDive.prelimsFacts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Expected Mains Question */}
          <div>
            <div className="dd-section-title">
              <FontAwesomeIcon icon={faPenFancy} style={{ marginRight: 6 }} />
              Expected Mains Question
            </div>
            <div className="dd-question">{a.deepDive.possibleMainsQuestion}</div>
          </div>

          {/* Flashcard Practice trigger */}
          <button className="dd-flashcard-btn" onClick={openFlashcards} style={{ marginTop: 18 }}>
            <FontAwesomeIcon icon={faClone} />
            Quick Revision Flashcard
          </button>
          
          <div style={{ height: 20 }}></div>
        </div>
      )}
    </div>
  )
}
