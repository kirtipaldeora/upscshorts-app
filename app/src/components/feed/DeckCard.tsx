import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark } from '@fortawesome/free-solid-svg-icons'
import type { Article } from '@/types/article'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/constants/categories'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'

interface DeckViewProps {
  articles: Article[]
  onShowToast: (msg: string) => void
}

export function DeckView({ articles, onShowToast }: DeckViewProps) {
  const [centerIdx, setCenterIdx] = useState(0)
  const { toggle, isBookmarked } = useBookmarkStore()
  const { setActiveArticle, setOverlay } = useAppStore()
  const haptic = useHaptic()

  if (!articles.length) return null

  const total = articles.length

  // Show center + 1 left + 1 right (3 visible)
  function getPosition(i: number): 'center' | 'left' | 'right' | 'hidden' {
    if (i === centerIdx) return 'center'
    if (i === (centerIdx - 1 + total) % total) return 'left'
    if (i === (centerIdx + 1) % total) return 'right'
    return 'hidden'
  }

  async function handleCardClick(i: number) {
    await haptic()
    if (i === centerIdx) {
      // Open deep dive for center card
      setActiveArticle(articles[i])
      setOverlay('deep-dive')
    } else {
      setCenterIdx(i)
    }
  }

  async function handleBm(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await haptic()
    toggle(id)
    onShowToast(isBookmarked(id) ? 'Bookmark removed' : 'Bookmarked!')
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {articles.map((a, i) => {
        const pos = getPosition(i)
        if (pos === 'hidden') return null

        const catColor = CATEGORY_COLORS[a.category]
        const catIconName = CATEGORY_ICONS[a.category]
        const bookmarked = isBookmarked(a.id)
        const isCenter = pos === 'center'

        const cardStyle: React.CSSProperties = {
          position: 'absolute',
          width: 'min(76%, 330px)',
          height: 'min(78%, 470px)',
          borderRadius: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '26px 22px 22px',
          textAlign: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          willChange: 'transform',
          transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s, box-shadow 0.5s',
          ...(isCenter
            ? {
                background: 'var(--card)',
                boxShadow: 'var(--shadow)',
                transform: 'translateX(0) scale(1)',
                zIndex: 10,
              }
            : {
                background: 'var(--panel)',
                border: '1px solid var(--panel-border)',
                backdropFilter: 'blur(16px)',
                transform: pos === 'left' ? 'translateX(-72%) scale(0.88)' : 'translateX(72%) scale(0.88)',
                opacity: 0.7,
                zIndex: 5,
              }),
        }

        return (
          <div key={a.id} style={cardStyle} onClick={() => handleCardClick(i)}>
            {/* Date badge */}
            <p style={{ fontSize: 12.5, fontWeight: 800, color: isCenter ? 'var(--ink2)' : 'var(--on2)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
              {a.date}
            </p>

            {/* Bookmark button (center only) */}
            {isCenter && (
              <button
                onClick={(e) => handleBm(e, a.id)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  border: 'none',
                  background: bookmarked ? 'var(--yellow)' : 'var(--card2)',
                  color: bookmarked ? 'var(--yellow-ink)' : 'var(--ink2)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesomeIcon icon={faBookmark} />
              </button>
            )}

            {/* Category icon */}
            <div
              style={{
                width: 104,
                height: 104,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                margin: 'auto 0',
                flexShrink: 0,
                background: catColor + '22',
                color: catColor,
                opacity: isCenter ? 1 : 0.75,
                filter: isCenter ? 'none' : 'saturate(0.7)',
              }}
            >
              <FontAwesomeIcon icon={{ prefix: 'fas', iconName: catIconName.replace('fa-', '') } as never} />
            </div>

            {/* Headline */}
            {isCenter && (
              <>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: 17.5,
                    lineHeight: 1.3,
                    color: 'var(--ink)',
                    marginBottom: 8,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {a.headline}
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink2)',
                    lineHeight: 1.55,
                    marginBottom: 12,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {a.summary}
                </p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 14, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', background: 'var(--card2)', color: 'var(--ink2)' }}>
                    {a.category}
                  </span>
                  <span style={{ padding: '5px 12px', borderRadius: 14, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', background: 'var(--card2)', color: 'var(--ink2)' }}>
                    {a.gsPaper}
                  </span>
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* Counter */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(94px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
          background: 'var(--panel2)',
          border: '1px solid var(--panel-border)',
          backdropFilter: 'blur(12px)',
          color: 'var(--on2)',
          fontSize: 11.5,
          fontWeight: 800,
          padding: '7px 16px',
          borderRadius: 18,
          letterSpacing: 0.5,
        }}
      >
        {centerIdx + 1} / {total}
      </div>
    </div>
  )
}
