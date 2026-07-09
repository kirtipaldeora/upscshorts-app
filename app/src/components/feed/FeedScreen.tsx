import { lazy, Suspense, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import { useGsapReveal, useStaggerReveal } from '@/anim/animations'
import { TopBar } from '@/components/layout/TopBar'
import { PenniLoader } from '@/components/layout/PenniLoader'
import { CATEGORY_COLORS } from '@/constants/categories'
import { DateTabs } from './DateTabs'
import { ViewToggle } from './ViewToggle'
import { FeedCard } from './FeedCard'
import { DeckView } from './DeckCard'

const FeedCosmicBackdrop = lazy(() => import('./FeedCosmicBackdrop').then(module => ({ default: module.FeedCosmicBackdrop })))

interface FeedScreenProps {
  onShowToast: (msg: string) => void
  onOpenUpload: () => void
}

export function FeedScreen({ onShowToast, onOpenUpload }: FeedScreenProps) {
  const { selectedDate, viewMode, getArticlesForDate, getAvailableDates } = useAppStore()
  const { settings } = usePracticeStore()
  const { loading } = useArticles(selectedDate)
  useAllArticles()

  const dates = getAvailableDates()
  const articles = getArticlesForDate(selectedDate)
  const briefing = useMemo(() => {
    const categories = new Map<string, number>()
    const gs = new Set<string>()
    articles.forEach(article => {
      categories.set(article.category, (categories.get(article.category) ?? 0) + 1)
      gs.add(article.gsPaper)
    })
    const topCategory = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      topCategory: topCategory?.[0] ?? 'Briefing',
      topCategoryCount: topCategory?.[1] ?? 0,
      gsCount: gs.size,
      accent: topCategory ? CATEGORY_COLORS[topCategory[0] as keyof typeof CATEGORY_COLORS] : 'var(--acc)',
    }
  }, [articles])

  // Motion: hero settles in, list cards stagger upward on date/view change
  const heroRef = useGsapReveal<HTMLDivElement>([])
  const listRef = useStaggerReveal<HTMLDivElement>('.feed-card', [selectedDate, viewMode, articles.length])

  return (
    <div
      className={`feed-screen ${settings.feedCosmicBackdrop ? 'feed-screen-cosmic' : ''}`}
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
      {settings.feedCosmicBackdrop && (
        <Suspense fallback={null}>
          <FeedCosmicBackdrop />
        </Suspense>
      )}
      <TopBar />

      {/* Hero header — characters rise in on load */}
      <div ref={heroRef} className="hero-head" style={{ padding: '4px 20px 12px', position: 'relative', zIndex: 2, flexShrink: 0, textAlign: 'center' }}>
        <p className="hero-sub" style={{ fontSize: 12.5, color: 'var(--on2)', fontWeight: 700, marginBottom: 3 }}>Hello, aspirant 👋</p>
        <h2 aria-label="Daily Briefing" style={{ fontSize: 27, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.08, color: 'var(--on)' }}>
          {'Daily Briefing'.split('').map((ch, i) => (
            <span className="hero-ch" aria-hidden="true" key={i}>{ch}</span>
          ))}
        </h2>
        <div className="briefing-rail" style={{ '--rail': briefing.accent } as CSSProperties}>
          <span><b>{articles.length}</b> stories</span>
          <span><b>{briefing.gsCount}</b> GS areas</span>
          <span><i />{briefing.topCategoryCount ? `${briefing.topCategory} leads` : 'Ready when imported'}</span>
        </div>
      </div>

      {/* Date tabs */}
      {dates.length > 0 && <DateTabs dates={dates} />}

      {/* View toggle */}
      <ViewToggle />

      {/* Feed content */}
      {viewMode === 'list' ? (
        <div
          ref={listRef}
          className="feed-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: `4px 16px calc(110px + env(safe-area-inset-bottom))`,
            WebkitOverflowScrolling: 'touch' as never,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {loading && articles.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
              <PenniLoader label="Loading briefing" />
            </div>
          )}
          {!loading && articles.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--on2)', gap: 12 }}>
              <i className="fas fa-newspaper" style={{ fontSize: 36, opacity: 0.5 }} />
              <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 1.5, fontWeight: 700 }}>
                No articles for this date.<br />Import a JSON file to add content.
              </p>
            </div>
          )}
          {articles.map((a, i) => (
            <FeedCard
              key={a.id}
              article={a}
              animationDelay={i * 60}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      ) : (
        /* Deck mode */
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            padding: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {articles.length > 0 ? (
            <DeckView articles={articles} onShowToast={onShowToast} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--on2)', fontSize: 13, fontWeight: 700 }}>
              No articles for this date.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
