import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faDownload, faBookmark, faExpand } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import type { Article } from '@/types/article'
import { fmtShort } from '@/constants/categories'
import { CATEGORY_COLORS } from '@/constants/categories'

export function BookmarksScreen() {
  const { setScreen, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const { bookmarkedIds, toggle } = useBookmarkStore()

  const allArticles = Object.values(articlesByDate).flat()
  const bookmarked = allArticles.filter((a) => bookmarkedIds.includes(a.id))

  function openArticle(a: Article) {
    setActiveArticle(a)
    setOverlay('deep-dive')
  }

  function exportBookmarks() {
    const data = bookmarked.map((a) => ({
      headline: a.headline,
      date: a.date,
      category: a.category,
      summary: a.summary,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'michi-bookmarks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        zIndex: 10,
        animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Header */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <button onClick={() => setScreen('feed')} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.3, flex: 1, color: 'var(--on)' }}>Bookmarks</h2>
        {bookmarked.length > 0 && (
          <button onClick={exportBookmarks} className="icon-btn" title="Export">
            <FontAwesomeIcon icon={faDownload} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px calc(110px + env(safe-area-inset-bottom))', position: 'relative', zIndex: 2 }}>
        {bookmarked.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--on2)', gap: 12 }}>
            <FontAwesomeIcon icon={faBookmark} style={{ fontSize: 36, opacity: 0.5 }} />
            <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 1.5, fontWeight: 700 }}>
              No bookmarks yet.<br />Tap ⭐ on any article to save it.
            </p>
          </div>
        ) : (
          bookmarked.map((a) => {
            const catColor = CATEGORY_COLORS[a.category]
            return (
              <div
                key={a.id}
                onClick={() => openArticle(a)}
                style={{
                  background: 'var(--card)',
                  borderRadius: 20,
                  padding: 15,
                  marginBottom: 9,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  boxShadow: 'var(--shadow-soft)',
                  color: 'var(--ink)',
                }}
              >
                {/* Category dot */}
                <div style={{ position: 'absolute', top: 17, right: 17, width: 9, height: 9, borderRadius: '50%', background: catColor }} />

                <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, lineHeight: 1.3, paddingRight: 20, color: 'var(--ink)' }}>{a.headline}</h4>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', fontWeight: 700 }}>
                  <span>{a.category}</span>
                  <span>·</span>
                  <span>{fmtShort(a.date)}</span>
                  <span>·</span>
                  <span>{a.gsPaper}</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 600 }}>
                  {a.summary}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(a.id) }}
                    style={{ width: 36, height: 36, borderRadius: 13, fontSize: 12, cursor: 'pointer', border: 'none', background: 'var(--yellow)', color: 'var(--yellow-ink)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FontAwesomeIcon icon={faBookmark} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openArticle(a) }}
                    style={{ marginLeft: 'auto', width: 'auto', padding: '0 16px', height: 36, borderRadius: 14, border: 'none', background: 'var(--yellow)', color: 'var(--yellow-ink)', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <FontAwesomeIcon icon={faExpand} style={{ fontSize: 10 }} />
                    Deep Dive
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
