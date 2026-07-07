import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faShareAlt, faBookmark, faLayerGroup, faLightbulb, faListCheck, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useHaptic } from '@/hooks/useHaptic'
import { CATEGORY_COLORS } from '@/constants/categories'

interface DeepDiveProps {
  onShowToast: (msg: string) => void
}

export function DeepDive({ onShowToast }: DeepDiveProps) {
  const { activeArticle, setOverlay, overlayScreen } = useAppStore()
  const { toggle, isBookmarked } = useBookmarkStore()
  const haptic = useHaptic()

  const visible = overlayScreen === 'deep-dive'
  const a = activeArticle

  async function handleClose() {
    await haptic()
    setOverlay(null)
  }

  async function handleBookmark() {
    if (!a) return
    await haptic()
    toggle(a.id)
    onShowToast(isBookmarked(a.id) ? 'Bookmark removed' : 'Bookmarked!')
  }

  async function handleShare() {
    if (!a) return
    await haptic()
    try {
      await navigator.share({ title: a.headline, text: a.summary })
    } catch {
      try {
        await navigator.clipboard.writeText(a.headline)
        onShowToast('Copied to clipboard')
      } catch { /* noop */ }
    }
  }

  function openFlashcards() {
    setOverlay('flashcards')
  }

  const catColor = a ? CATEGORY_COLORS[a.category] : '#9DBCE8'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 200,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <button onClick={handleClose} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 15, fontWeight: 800, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--on)' }}>
          {a?.headline ?? ''}
        </h2>
        <button onClick={handleShare} className="icon-btn">
          <FontAwesomeIcon icon={faShareAlt} />
        </button>
      </div>

      {/* Body */}
      {a && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 48px', position: 'relative', zIndex: 2 }}>

          {/* Category accent tag */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ padding: '5px 14px', borderRadius: 14, fontSize: 9.5, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase', border: `1px solid ${catColor}`, color: catColor }}>
              {a.category}
            </span>
            {' '}
            <span style={{ padding: '5px 12px', borderRadius: 14, fontSize: 9.5, fontWeight: 800, background: 'var(--card2)', color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {a.gsPaper}
            </span>
          </div>

          {/* Explanation */}
          <div
            style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--ink)', marginBottom: 20, background: 'var(--card)', borderRadius: 24, padding: 20, boxShadow: 'var(--shadow-soft)', fontWeight: 600 }}
            dangerouslySetInnerHTML={{ __html: a.deepDive.explanation }}
          />

          {/* Prelims Facts */}
          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--on)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
            <FontAwesomeIcon icon={faListCheck} style={{ fontSize: 10 }} />
            Prelims Facts
          </p>
          <div style={{ background: 'var(--card)', borderRadius: 22, padding: '16px 18px', marginBottom: 16, boxShadow: 'var(--shadow-soft)' }}>
            <ul style={{ listStyleType: 'disc', paddingLeft: 18 }}>
              {a.deepDive.prelimsFacts.map((f, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink2)', marginBottom: 7, fontWeight: 600 }}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Possible Mains Question */}
          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--on)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
            <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 10 }} />
            Possible Mains Question
          </p>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', backdropFilter: 'blur(14px)', borderRadius: 22, padding: 16, fontSize: 13.5, lineHeight: 1.75, color: 'var(--on)', fontStyle: 'italic', marginBottom: 16, fontWeight: 600 }}>
            {a.deepDive.possibleMainsQuestion}
          </div>

          {/* Flashcards button */}
          <button
            onClick={openFlashcards}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 22,
              background: 'var(--yellow)',
              color: 'var(--yellow-ink)',
              fontSize: 14,
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              marginTop: 8,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <FontAwesomeIcon icon={faLayerGroup} />
            Practice Flashcard
          </button>

          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 22,
              background: isBookmarked(a.id) ? 'var(--yellow)' : 'var(--panel)',
              border: '1px solid var(--panel-border)',
              backdropFilter: 'blur(16px)',
              color: isBookmarked(a.id) ? 'var(--yellow-ink)' : 'var(--on)',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              marginTop: 10,
            }}
          >
            <FontAwesomeIcon icon={faBookmark} />
            {isBookmarked(a.id) ? 'Bookmarked' : 'Save Article'}
          </button>
        </div>
      )}
    </div>
  )
}
