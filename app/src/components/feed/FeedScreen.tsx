import { lazy, Suspense, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import { useGsapReveal, useStaggerReveal } from '@/anim/animations'
import { TopBar } from '@/components/layout/TopBar'
import { LoadingBadge } from '@/components/layout/LoadingBadge'
import { ViewToggle } from './ViewToggle'
import { FeedFilters } from './FeedFilters'
import { FeedThemeToggle } from './FeedThemeToggle'
import { FeedCard } from './FeedCard'
import { DeckView } from './DeckCard'
import { FeedEmptyState } from './FeedEmptyState'
import { useReadingLanguage } from '@/hooks/useReadingLanguage'

const FeedCosmicBackdrop = lazy(() => import('./FeedCosmicBackdrop').then(module => ({ default: module.FeedCosmicBackdrop })))
const GlobalNewsView = lazy(() => import('./GlobalNewsView').then(module => ({ default: module.GlobalNewsView })))

interface FeedScreenProps {
  onShowToast: (msg: string) => void
}

export function FeedScreen({ onShowToast }: FeedScreenProps) {
  const { selectedDate, setSelectedDate, viewMode, getArticlesForDate, getAvailableDates } = useAppStore()
  const { settings } = usePracticeStore()
  const [readLang] = useReadingLanguage()
  const { loading } = useArticles(selectedDate)
  useAllArticles()

  const dates = getAvailableDates()
  const articles = getArticlesForDate(selectedDate)
  const briefingTitle = readLang === 'hi' ? 'दैनिक समाचार' : 'Daily Briefing'
  const briefingDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    readLang === 'hi' ? 'hi-IN' : 'en-IN',
    { day: 'numeric', month: 'long' },
  )

  const autoDatePicked = useRef(false)
  useEffect(() => {
    if (autoDatePicked.current) return
    if (dates.length > 0 && !dates.includes(selectedDate)) {
      autoDatePicked.current = true
      setSelectedDate(dates[0])
    }
  }, [dates, selectedDate, setSelectedDate])

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

      <div ref={heroRef} className="hero-head" style={{ padding: '4px 20px 12px', position: 'relative', zIndex: 120, flexShrink: 0, textAlign: 'center' }}>
        <h2 aria-label={briefingTitle} style={{ fontSize: 27, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.08, color: 'var(--on)' }}>
          {readLang === 'hi'
            ? <span className="hero-ch" aria-hidden="true">{briefingTitle}</span>
            : briefingTitle.split('').map((character, index) => (
                <span className="hero-ch" aria-hidden="true" key={index}>{character}</span>
              ))}
        </h2>
        <p className="hero-sub feed-briefing-context">
          <time dateTime={selectedDate}>{briefingDate}</time>
        </p>
      </div>

      <div className="feed-quick-controls">
        <ViewToggle />
        <FeedFilters dates={dates} storyCount={articles.length} />
        <FeedThemeToggle />
      </div>

      <div className={`feed-content-stage feed-content-${viewMode}`}>
        {viewMode === 'global' && (
          <Suspense fallback={<LoadingBadge label="Opening Global News" full />}>
            <GlobalNewsView loading={loading} />
          </Suspense>
        )}

        {viewMode === 'list' && (
          <div
            ref={listRef}
            className="feed-scroll"
            style={{
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '4px 16px calc(var(--app-bottom-nav-clearance) + 12px)',
              WebkitOverflowScrolling: 'touch' as never,
              zIndex: 2,
            }}
          >
            {loading && articles.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                <LoadingBadge label="Loading briefing" delayed={false} />
              </div>
            )}
            {!loading && articles.length === 0 && (
              <FeedEmptyState date={selectedDate} animate={settings.feedCosmicBackdrop} />
            )}
            {articles.map((article, index) => (
              <FeedCard
                key={article.id}
                article={article}
                animationDelay={index * 60}
                onShowToast={onShowToast}
              />
            ))}
          </div>
        )}

        {viewMode === 'deck' && (
          loading && articles.length === 0
            ? <LoadingBadge label="Loading briefing cards" full />
            : articles.length > 0
              ? <DeckView articles={articles} onShowToast={onShowToast} />
              : <FeedEmptyState date={selectedDate} animate={settings.feedCosmicBackdrop} />
        )}
      </div>
    </div>
  )
}
