import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS } from '@/constants/categories'
import type { Category } from '@/types/article'

export function ReviseScreen() {
  const { setScreen, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const [openCat, setOpenCat] = useState<Category | null>(null)

  // Collect all articles grouped by category
  const byCategory: Record<string, typeof allArticles> = {}
  const allArticles = Object.values(articlesByDate).flat()
  for (const a of allArticles) {
    if (!byCategory[a.category]) byCategory[a.category] = []
    byCategory[a.category].push(a)
  }

  function openArticle(a: (typeof allArticles)[number]) {
    setActiveArticle(a)
    setOverlay('deep-dive')
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
        <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.3, flex: 1, color: 'var(--on)' }}>Revise by Subject</h2>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px calc(110px + env(safe-area-inset-bottom))', position: 'relative', zIndex: 2 }}>
        {CATEGORIES.map((cat) => {
          const articles = byCategory[cat] ?? []
          if (!articles.length) return null
          const isOpen = openCat === cat
          const color = CATEGORY_COLORS[cat]
          const icon = CATEGORY_ICONS[cat]

          return (
            <div
              key={cat}
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--panel-border)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                marginBottom: 10,
                overflow: 'hidden',
              }}
            >
              {/* Category header */}
              <div
                onClick={() => setOpenCat(isOpen ? null : cat)}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.85)',
                    color: color,
                  }}
                >
                  <FontAwesomeIcon icon={{ prefix: 'fas', iconName: icon.replace('fa-', '') } as never} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 1, color: 'var(--on)' }}>{cat}</h3>
                  <span style={{ fontSize: 11, color: 'var(--on2)', fontWeight: 600 }}>{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    background: 'var(--panel2)',
                    border: '1px solid var(--panel-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--on2)',
                    fontSize: 10,
                    transition: 'transform 0.3s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <FontAwesomeIcon icon={faChevronDown} />
                </div>
              </div>

              {/* Articles list */}
              <div
                style={{
                  maxHeight: isOpen ? 2000 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.4s ease',
                }}
              >
                {articles.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => openArticle(a)}
                    style={{
                      padding: '11px 16px 11px 72px',
                      borderTop: '1px solid var(--panel-border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <h4 style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--on)' }}>
                      {a.headline}
                    </h4>
                    <div style={{ fontSize: 10, color: 'var(--on2)', display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
                      <span>{a.date}</span>
                      <span>·</span>
                      <span>{a.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
