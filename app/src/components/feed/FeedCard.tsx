import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark as faBookmarkSolid, faShareAlt, faExpand } from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkRegular } from '@fortawesome/free-solid-svg-icons'
import type { Article } from '@/types/article'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmtShort } from '@/constants/categories'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { popElement } from '@/anim/animations'

interface FeedCardProps {
  article: Article
  animationDelay?: number
  onShowToast: (msg: string) => void
}

export function FeedCard({ article, animationDelay = 0, onShowToast }: FeedCardProps) {
  const { toggle, isBookmarked } = useBookmarkStore()
  const { setActiveArticle, setOverlay } = useAppStore()
  const haptic = useHaptic()
  const bookmarked = isBookmarked(article.id)
  const catColor = CATEGORY_COLORS[article.category]
  const catIcon = CATEGORY_ICONS[article.category]

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    popElement(e.currentTarget)
    await haptic()
    toggle(article.id)
    onShowToast(bookmarked ? 'Bookmark removed' : 'Bookmarked!')
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    await haptic()
    try {
      await navigator.share({ title: article.headline, text: article.summary })
    } catch {
      try {
        await navigator.clipboard.writeText(article.headline)
        onShowToast('Copied to clipboard')
      } catch { /* noop */ }
    }
  }

  function openDeepDive() {
    setActiveArticle(article)
    setOverlay('deep-dive')
  }

  return (
    <div
      className="feed-card"
      onClick={openDeepDive}
      style={{
        background: 'var(--card)',
        borderRadius: 26,
        marginBottom: 12,
        overflow: 'hidden',
        transition: 'transform 0.2s',
        boxShadow: 'var(--shadow-soft)',
        color: 'var(--ink)',
        cursor: 'pointer',
        animation: `cardIn 0.5s cubic-bezier(0.22,1,0.36,1) ${animationDelay}ms both`,
      }}
    >
      <div className="card-body" style={{ padding: 20 }}>
        {/* Tags */}
        <div className="card-tags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
          <span
            className="tag tag-cat"
            style={{
              padding: '5px 12px',
              borderRadius: 14,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              border: `1px solid ${catColor}`,
              color: catColor,
            }}
          >
            <FontAwesomeIcon icon={{ prefix: 'fas', iconName: catIcon.replace('fa-', '') } as never} style={{ marginRight: 5 }} />
            {article.category}
          </span>
          <span
            className="tag tag-gs"
            style={{
              padding: '5px 12px',
              borderRadius: 14,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              background: 'var(--card2)',
              color: 'var(--ink2)',
            }}
          >
            {article.gsPaper}
          </span>
          <span
            className="tag tag-src"
            style={{
              padding: '5px 12px',
              borderRadius: 14,
              fontSize: 10,
              fontWeight: 700,
              background: 'transparent',
              color: 'var(--acc)',
              border: '1px solid var(--border)',
            }}
          >
            {article.source}
          </span>
        </div>

        {/* Headline */}
        <h2 className="card-headline" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25, marginBottom: 7, letterSpacing: -0.2, color: 'var(--ink)' }}>
          {article.headline}
        </h2>

        {/* Meta */}
        <p className="card-meta" style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          {fmtShort(article.date)}
        </p>

        {/* Summary */}
        <p className="card-summary" style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink2)', marginBottom: 13, fontWeight: 600 }}>
          {article.summary}
        </p>

        {/* Why it matters */}
        <div className="card-why" style={{ background: 'var(--card2)', borderRadius: 18, padding: 13, marginBottom: 13 }}>
          <p className="card-why-label" style={{ fontSize: 9.5, fontWeight: 900, color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            Why it matters
          </p>
          <p className="card-why-text" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink2)', fontWeight: 600 }}>
            {article.whyItMatters}
          </p>
        </div>

        {/* Actions */}
        <div className="card-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleBookmark}
            className={`btn-bm ${bookmarked ? 'bookmarked' : ''}`}
            style={{
              height: 40,
              width: 40,
              borderRadius: 14,
              border: 'none',
              background: bookmarked ? 'var(--yellow)' : 'var(--card2)',
              color: bookmarked ? 'var(--yellow-ink)' : 'var(--ink2)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={faBookmarkSolid} />
          </button>

          <button
            onClick={handleShare}
            className="btn-share"
            style={{
              height: 40,
              width: 40,
              borderRadius: 14,
              border: 'none',
              background: 'var(--card2)',
              color: 'var(--ink2)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={faShareAlt} />
          </button>

          <button
            onClick={openDeepDive}
            className="btn-deep"
            style={{
              marginLeft: 'auto',
              height: 40,
              width: 'auto',
              padding: '0 18px',
              borderRadius: 16,
              border: 'none',
              background: 'var(--yellow)',
              color: 'var(--yellow-ink)',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={faExpand} style={{ fontSize: 11 }} />
            Deep Dive
          </button>
        </div>
      </div>
    </div>
  )
}
