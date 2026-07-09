import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { CATEGORIES, CATEGORY_COLORS } from '@/constants/categories'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useHaptic } from '@/hooks/useHaptic'
import type { Article, Category } from '@/types/article'

export function SearchScreen() {
  const { setScreen, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const rootRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()

  const allArticles = useMemo(() => Object.values(articlesByDate).flat(), [articlesByDate])

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    return allArticles.filter((a) => {
      const matchesQuery =
        !q ||
        a.headline.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.date.includes(q)
      const matchesCat = activeCategory === 'all' || a.category === activeCategory
      return matchesQuery && matchesCat
    })
  }, [query, activeCategory, allArticles])

  useEffect(() => {
    const el = rootRef.current
    if (!el || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.search-panel, .search-result',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.42, ease: EASE.out, stagger: 0.035, clearProps: 'transform,opacity' })
    }, el)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || reducedMotion()) return
    const results = el.querySelectorAll('.search-result')
    gsap.fromTo(results,
      { opacity: 0.78, y: 6 },
      { opacity: 1, y: 0, duration: 0.24, ease: EASE.out, stagger: 0.018, overwrite: true, clearProps: 'transform,opacity' })
  }, [activeCategory])

  async function openArticle(a: Article) {
    await haptic()
    setActiveArticle(a)
    setOverlay('deep-dive')
  }

  async function goBack() {
    await haptic()
    setScreen('feed')
  }

  async function chooseCategory(cat: Category | 'all') {
    await haptic()
    setActiveCategory(cat)
  }

  function highlighted(value: string) {
    const clean = query.trim()
    if (!clean) return value
    const index = value.toLowerCase().indexOf(clean.toLowerCase())
    if (index < 0) return value
    return (
      <>
        {value.slice(0, index)}
        <mark>{value.slice(index, index + clean.length)}</mark>
        {value.slice(index + clean.length)}
      </>
    )
  }

  return (
    <div
      ref={rootRef}
      className="search-command"
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
        <button onClick={goBack} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.3, flex: 1, color: 'var(--on)' }}>Search</h2>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px calc(110px + env(safe-area-inset-bottom))', position: 'relative', zIndex: 2 }}>
        {/* Search box */}
        <div className="search-box search-panel" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)', backdropFilter: 'blur(16px)', borderRadius: 20, padding: '13px 17px', marginBottom: 13 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: 'var(--on2)', fontSize: 14 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, keywords, dates..."
            autoFocus
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--on)', fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 600 }}
          />
          <span className="search-count">{results.length}</span>
        </div>

        {/* Filter chips */}
        <div className="search-panel" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 11, marginBottom: 2, scrollbarWidth: 'none' }}>
          {(['all', ...CATEGORIES] as (Category | 'all')[]).map((cat) => (
            <button
              key={cat}
              onClick={() => chooseCategory(cat)}
              className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
              style={{
                '--cat': cat === 'all' ? 'var(--acc)' : CATEGORY_COLORS[cat],
                padding: '8px 15px',
                borderRadius: 18,
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: activeCategory === cat ? '1px solid transparent' : '1px solid var(--panel-border)',
                background: activeCategory === cat ? '#fff' : 'var(--panel2)',
                color: activeCategory === cat ? '#4A4E8C' : 'var(--on2)',
                transition: 'all 0.2s',
                flexShrink: 0,
              } as CSSProperties}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', color: 'var(--on2)', gap: 12 }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 36, opacity: 0.5 }} />
            <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 1.5, fontWeight: 700 }}>
              {query ? `No results for "${query}"` : 'Start typing to search…'}
            </p>
          </div>
        ) : (
          results.map((a) => (
            <div
              key={a.id}
              className="search-result"
              onClick={() => openArticle(a)}
              style={{
                '--cat': CATEGORY_COLORS[a.category],
                background: 'var(--card)',
                borderRadius: 20,
                padding: 15,
                marginBottom: 9,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-soft)',
                color: 'var(--ink)',
              } as CSSProperties}
            >
              <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, lineHeight: 1.3, color: 'var(--ink)' }}>{highlighted(a.headline)}</h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 600 }}>
                {highlighted(a.summary)}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 9.5, fontWeight: 800, background: 'var(--card2)', color: CATEGORY_COLORS[a.category], textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {a.category}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 9.5, fontWeight: 800, background: 'var(--card2)', color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {a.date}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
