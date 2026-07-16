import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark } from '@fortawesome/free-solid-svg-icons'
import type { Article } from '@/types/article'
import { CATEGORY_COLORS, CATEGORY_ICONS, fmtShort } from '@/constants/categories'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { burstElement, popElement } from '@/anim/animations'
import { useReadingLanguage } from '@/hooks/useReadingLanguage'
import { categoryLabel, getArticleCopy } from '@/utils/articleLocalization'

interface DeckViewProps {
  articles: Article[]
  onShowToast: (msg: string) => void
}

export function DeckView({ articles, onShowToast }: DeckViewProps) {
  const [centerIdx, setCenterIdx] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  
  const { toggle, isBookmarked } = useBookmarkStore()
  const { setActiveArticle, setOverlay } = useAppStore()
  const haptic = useHaptic()
  const [readLang] = useReadingLanguage()

  const articlesKey = articles.map((a) => a.id).join(',')

  useEffect(() => {
    // Reset active index if list of articles actually changes
    setCenterIdx(0)
    setMounted(false)
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [articlesKey])

  if (!articles.length) return null

  const total = articles.length

  async function handleCardClick(i: number) {
    if (i === centerIdx) {
      await haptic()
      setActiveArticle(articles[i])
      setOverlay('deep-dive')
    } else {
      await haptic()
      setCenterIdx(i)
    }
  }

  async function handleBookmark(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    popElement(e.currentTarget)
    await haptic()
    const article = articles.find(item => item.id === id)
    if (article && !isBookmarked(id)) burstElement(e.currentTarget, CATEGORY_COLORS[article.category])
    toggle(id)
    onShowToast(isBookmarked(id) ? 'Bookmark removed' : 'Bookmarked!')
  }

  // Touch Swipe Handlers
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
  }

  async function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return
    const diffX = e.changedTouches[0].clientX - touchStartX
    const diffY = e.changedTouches[0].clientY - touchStartY

    // Detect horizontal swipe if delta X is significantly larger than delta Y
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        // Swipe right -> previous card
        if (centerIdx > 0) {
          await haptic()
          setCenterIdx(centerIdx - 1)
        }
      } else {
        // Swipe left -> next card
        if (centerIdx < total - 1) {
          await haptic()
          setCenterIdx(centerIdx + 1)
        }
      }
    }
    setTouchStartX(null)
    setTouchStartY(null)
  }

  return (
    <>
      <div
        className="deck-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {articles.map((a, i) => {
          const copy = getArticleCopy(a, readLang)
          const d = i - centerIdx
          const isCenter = d === 0
          const bookmarked = isBookmarked(a.id)
          const catColor = CATEGORY_COLORS[a.category]
          const catIconName = CATEGORY_ICONS[a.category]

          // Dynamic positioning style
          let transformStr = ''
          let opacityVal = 0
          let zIndexVal = 20 - Math.abs(d)

          if (!mounted) {
            // Slide/Scale up transition when first loading
            transformStr = 'translateY(24px) scale(0.92)'
            opacityVal = 0
          } else {
            if (d === 0) {
              transformStr = 'translateX(0) rotate(0deg) scale(1)'
              opacityVal = 1
            } else if (Math.abs(d) === 1) {
              transformStr = `translateX(${d * 70}%) rotate(${d * 5}deg) scale(0.84)`
              opacityVal = 0.96
            } else if (Math.abs(d) === 2) {
              transformStr = `translateX(${d * 124}%) rotate(${d * 9}deg) scale(0.7)`
              opacityVal = 0.55
            } else {
              transformStr = `translateX(${d * 150}%) scale(0.6)`
              opacityVal = 0
              zIndexVal = 0
            }
          }

          const cardStyle: React.CSSProperties = {
            '--cat': catColor,
            transform: transformStr,
            opacity: opacityVal,
            zIndex: zIndexVal,
            pointerEvents: Math.abs(d) > 2 ? 'none' : 'auto',
          } as React.CSSProperties

          const formattedDate = fmtShort(a.date).toUpperCase()

          return (
            <div
              key={a.id}
              className={`deck-card ${isCenter ? 'is-center' : 'is-side'}`}
              data-feed-article={a.id}
              style={cardStyle}
              onClick={() => handleCardClick(i)}
            >
              {/* Bookmark button */}
              <button
                onClick={(e) => handleBookmark(e, a.id)}
                className={`dk-bm ${bookmarked ? 'on' : ''}`}
              >
                <FontAwesomeIcon icon={faBookmark} />
              </button>

              {/* Date / GS paper header */}
              <div className="dk-date">
                {formattedDate} · {a.gsPaper}
              </div>

              {/* Category icon */}
              <div
                className="dk-icon"
                style={{
                  background: catColor + '22',
                  color: catColor,
                }}
              >
                <FontAwesomeIcon icon={{ prefix: 'fas', iconName: catIconName.replace('fa-', '') } as never} />
              </div>

              {/* Core Card Info */}
              <div>
                <div className="dk-head">{copy.headline}</div>
                <div className="dk-sub">{copy.summary}</div>
                <div className="dk-tags">
                  <span className="dk-tag" style={{ color: catColor }}>
                    {categoryLabel(a.category, readLang)}
                  </span>
                  <span className="dk-tag">{a.source}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Counter */}
      <div className="deck-cnt">
        {centerIdx + 1} / {total}
      </div>
    </>
  )
}
