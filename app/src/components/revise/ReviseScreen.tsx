import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faChevronDown,
  faChevronRight,
  faBookOpen,
  faListOl,
  faTableCellsLarge,
  faEarthAsia,
  faScroll,
  faBookmark,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkRegular } from '@fortawesome/free-regular-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useHaptic } from '@/hooks/useHaptic'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS, fmtShort } from '@/constants/categories'
import type { Category } from '@/types/article'

export function ReviseScreen() {
  const {
    setScreen,
    articlesByDate,
    setActiveArticle,
    setOverlay,
    setCategoryFilter,
  } = useAppStore()
  const { toggle, isBookmarked } = useBookmarkStore()
  const haptic = useHaptic()

  const [view, setView] = useState<'main' | 'categories'>('main')
  const [openCat, setOpenCat] = useState<Category | null>(null)

  const allArticles = Object.values(articlesByDate).flat()

  // Group articles by category
  const byCategory: Record<string, typeof allArticles> = {}
  for (const a of allArticles) {
    if (!byCategory[a.category]) byCategory[a.category] = []
    byCategory[a.category].push(a)
  }

  const fdf = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
  }

  async function handleBack() {
    await haptic()
    setScreen('feed')
  }

  async function handleOpenDigest() {
    await haptic()
    setOverlay('digest')
  }

  async function handleOpenArcade() {
    await haptic()
    setOverlay('maps-arcade')
  }

  async function handleOpenPYQ() {
    await haptic()
    setOverlay('pyq-vault')
  }

  async function handleArticleClick(a: typeof allArticles[0]) {
    await haptic()
    setActiveArticle(a)
    setOverlay('deep-dive')
  }

  async function handleToggleBookmark(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await haptic()
    toggle(id)
  }

  async function handleCategoryClick(c: Category) {
    await haptic()
    setCategoryFilter(c)
    setScreen('feed')
  }

  if (view === 'categories') {
    return (
      <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
        {/* Categories Header */}
        <div className="screen-header">
          <button onClick={() => setView('main')} aria-label="Back">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h2>Categories</h2>
        </div>

        {/* Categories Body */}
        <div className="screen-body">
          <div className="cat-grid">
            {CATEGORIES.map((c) => {
              const arts = byCategory[c] ?? []
              const count = arts.length
              const color = CATEGORY_COLORS[c]
              const iconName = CATEGORY_ICONS[c]

              return (
                <div
                  key={c}
                  className="cat-card"
                  onClick={() => handleCategoryClick(c)}
                >
                  <div className="cat-color" style={{ background: color }}></div>
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: iconName.replace('fa-', '') } as never}
                    style={{ color: color, fontSize: 22, marginBottom: 10, display: 'block' }}
                  />
                  <h3>{c}</h3>
                  <span>{count} article{count !== 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      {/* Main Revise Header */}
      <div className="screen-header">
        <button onClick={handleBack} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>
          Revise by <span style={{ color: 'var(--yellow)' }}>Subject</span>
        </h2>
      </div>

      {/* Main Revise Body */}
      <div className="screen-body">
        {/* Quick Row (Categories & Daily Digest) */}
        <div className="quick-row">
          <div className="quick-tile" onClick={() => setView('categories')}>
            <div className="qt-ic" style={{ background: 'rgba(226,154,181,.18)', color: 'var(--accent)' }}>
              <FontAwesomeIcon icon={faTableCellsLarge} />
            </div>
            <h4>Categories</h4>
            <span>Browse by subject</span>
          </div>

          <div className="quick-tile" onClick={handleOpenDigest}>
            <div className="qt-ic" style={{ background: 'rgba(143,207,192,.2)', color: 'var(--teal)' }}>
              <FontAwesomeIcon icon={faListOl} />
            </div>
            <h4>Daily Digest</h4>
            <span>Top stories of the day</span>
          </div>
        </div>

        {/* Maps Arcade Card */}
        <div className="arcade-card" onClick={handleOpenArcade}>
          <div className="ac-icon">
            <FontAwesomeIcon icon={faEarthAsia} />
          </div>
          <div className="ac-info">
            <h3>Maps Arcade</h3>
            <p>Practice world & India geography — locate and name places, rivers and more.</p>
          </div>
          <div className="ac-go">
            <FontAwesomeIcon icon={faArrowLeft} style={{ transform: 'rotate(180deg)' }} />
          </div>
        </div>

        {/* PYQ Vault Card */}
        <div className="pyq-card" onClick={handleOpenPYQ}>
          <div className="pc-icon">
            <FontAwesomeIcon icon={faScroll} />
          </div>
          <div className="pc-info">
            <h3>PYQ Vault</h3>
            <p>Access previous years questions, syllabus structure and standard references.</p>
          </div>
          <div className="pc-go">
            <FontAwesomeIcon icon={faArrowLeft} style={{ transform: 'rotate(180deg)' }} />
          </div>
        </div>

        {/* Subject cards list */}
        {CATEGORIES.map((cat) => {
          const arts = byCategory[cat] ?? []
          if (!arts.length) return null

          const isOpen = openCat === cat
          const color = CATEGORY_COLORS[cat]
          const iconName = CATEGORY_ICONS[cat]
          const uniqueDates = new Set(arts.map((a) => a.date)).size

          // Sort articles by date newest first
          const sortedArts = [...arts].sort((a, b) => b.date.localeCompare(a.date))

          return (
            <div
              key={cat}
              className={`subject-card ${isOpen ? 'open' : ''}`}
            >
              {/* Subject Header */}
              <div 
                className="subject-header" 
                onClick={() => setOpenCat(isOpen ? null : cat)}
              >
                <div className="subject-color" style={{ background: color }}></div>
                <div 
                  className="subject-icon" 
                  style={{ background: color + '12', color: color }}
                >
                  <FontAwesomeIcon icon={{ prefix: 'fas', iconName: iconName.replace('fa-', '') } as never} />
                </div>
                <div className="subject-info">
                  <h3>{cat}</h3>
                  <span>
                    {arts.length} article{arts.length !== 1 ? 's' : ''} · {uniqueDates} day{uniqueDates !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="subject-expand">
                  <FontAwesomeIcon icon={faChevronDown} />
                </div>
              </div>

              {/* Subject Articles List */}
              <div className="subject-articles">
                {sortedArts.map((a) => {
                  const bookmarked = isBookmarked(a.id)
                  return (
                    <div
                      key={a.id}
                      className="subject-article"
                      onClick={() => handleArticleClick(a)}
                    >
                      <h4>{a.headline}</h4>
                      <div className="sa-meta">
                        <span>{fdf(a.date)}</span>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <span>{a.gsPaper}</span>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <span style={{ color: 'var(--teal)' }}>{a.source}</span>
                        
                        {/* Bookmark Button */}
                        <button
                          className={`sa-bm ${bookmarked ? 'bookmarked' : ''}`}
                          onClick={(e) => handleToggleBookmark(e, a.id)}
                        >
                          <FontAwesomeIcon 
                            icon={bookmarked ? faBookmark : faBookmarkRegular} 
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
