import { useAppStore } from '@/stores/useAppStore'
import { useArticles } from '@/hooks/useArticles'
import { TopBar } from '@/components/layout/TopBar'
import { DateTabs } from './DateTabs'
import { ViewToggle } from './ViewToggle'
import { FeedCard } from './FeedCard'
import { DeckView } from './DeckCard'

interface FeedScreenProps {
  onShowToast: (msg: string) => void
  onOpenUpload: () => void
}

export function FeedScreen({ onShowToast, onOpenUpload }: FeedScreenProps) {
  const { selectedDate, viewMode, getArticlesForDate, getAvailableDates } = useAppStore()
  const { loading } = useArticles(selectedDate)

  const dates = getAvailableDates()
  const articles = getArticlesForDate(selectedDate)

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
      <TopBar />

      {/* Hero header */}
      <div className="hero-head" style={{ padding: '4px 20px 12px', position: 'relative', zIndex: 2, flexShrink: 0, textAlign: 'center' }}>
        <p style={{ fontSize: 12.5, color: 'var(--on2)', fontWeight: 700, marginBottom: 3 }}>Hello, aspirant 👋</p>
        <h2 style={{ fontSize: 27, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.08, color: 'var(--on)' }}>
          Daily Briefing
        </h2>
      </div>

      {/* Date tabs */}
      {dates.length > 0 && <DateTabs dates={dates} />}

      {/* View toggle */}
      <ViewToggle />

      {/* Feed content */}
      {viewMode === 'list' ? (
        <div
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--on2)', fontSize: 13, fontWeight: 700, gap: 10 }}>
              <i className="fas fa-circle-notch" style={{ animation: 'spin 1s linear infinite' }} />
              Loading…
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
