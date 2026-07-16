import { lazy, Suspense, useMemo, useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import type { SourceFocus } from '@/stores/useAppStore'
import { isSourceVisible, sourceKeysFor } from '@/constants/sources'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import { useGsapReveal, useStaggerReveal } from '@/anim/animations'
import { TopBar } from '@/components/layout/TopBar'
import { PenniLoader } from '@/components/layout/PenniLoader'
import { DateTabs } from './DateTabs'
import { ViewToggle } from './ViewToggle'
import { FeedCard } from './FeedCard'
import { DeckView } from './DeckCard'
import { FeedEmptyState } from './FeedEmptyState'
import { useReadingLanguage } from '@/hooks/useReadingLanguage'

const FeedCosmicBackdrop = lazy(() => import('./FeedCosmicBackdrop').then(module => ({ default: module.FeedCosmicBackdrop })))

interface FeedScreenProps {
  onShowToast: (msg: string) => void
  onOpenUpload: () => void
}

export function FeedScreen({ onShowToast, onOpenUpload }: FeedScreenProps) {
  const { selectedDate, setSelectedDate, viewMode, getArticlesForDate, getAvailableDates, sourceFocus, setSourceFocus, gsFocus, setGsFocus, getFocusableGsPapers } = useAppStore()
  const { settings } = usePracticeStore()
  const [readLang] = useReadingLanguage()
  const { loading } = useArticles(selectedDate)
  useAllArticles()

  const dates = getAvailableDates()
  const articles = getArticlesForDate(selectedDate)
  const focusablePapers = getFocusableGsPapers(selectedDate)
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false)
  const [gsMenuOpen, setGsMenuOpen] = useState(false)

  // Story count per GS paper for the dropdown — the feed as it stands but
  // ignoring the GS-focus itself, so counts don't collapse to the focused paper.
  const gsCounts = useMemo(() => {
    const s = useAppStore.getState()
    const day = (s.articlesByDate[selectedDate] ?? [])
      .filter(a => s.gsFilter[a.gsPaper])
      .filter(a => isSourceVisible(a.source, s.sourceFilter))
      .filter(a => {
        if (!sourceFocus) return true
        const keys = sourceKeysFor(a.source)
        if (sourceFocus === 'pib') return keys.includes('pib')
        if (sourceFocus === 'govt') return keys.some(k => ['rbi', 'mea', 'prs', 'airdd'].includes(k))
        return keys.includes(sourceFocus)
      })
      .filter(a => !s.categoryFilter || a.category === s.categoryFilter)
    const counts: Record<string, number> = {}
    for (const a of day) counts[a.gsPaper] = (counts[a.gsPaper] ?? 0) + 1
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, articles.length, gsFocus, sourceFocus])

  const sourceOptions: { key: SourceFocus; label: string; short: string; tone: string; logo: string }[] = [
    { key: null, label: 'All sources', short: 'All', tone: 'all', logo: '/source-logos/all.svg' },
    { key: 'hindu', label: 'The Hindu', short: 'TH', tone: 'hindu', logo: '/source-logos/the-hindu.svg' },
    { key: 'ie', label: 'Indian Express', short: 'IE', tone: 'ie', logo: '/source-logos/indian-express.svg' },
    { key: 'pib', label: 'PIB', short: 'PIB', tone: 'pib', logo: '/source-logos/pib.svg' },
    { key: 'govt', label: 'Govt sources', short: 'Govt', tone: 'govt', logo: '/source-logos/govt.svg' },
  ]
  const sourceCounts = useMemo(() => {
    const s = useAppStore.getState()
    const day = (s.articlesByDate[selectedDate] ?? [])
      .filter(a => s.gsFilter[a.gsPaper])
      .filter(a => isSourceVisible(a.source, s.sourceFilter))
      .filter(a => !s.categoryFilter || a.category === s.categoryFilter)
    const counts = { all: day.length, hindu: 0, ie: 0, pib: 0, govt: 0 }
    for (const a of day) {
      const keys = sourceKeysFor(a.source)
      if (keys.includes('hindu')) counts.hindu += 1
      if (keys.includes('ie')) counts.ie += 1
      if (keys.includes('pib')) counts.pib += 1
      if (keys.some(k => ['rbi', 'mea', 'prs', 'airdd'].includes(k))) counts.govt += 1
    }
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, articles.length, sourceFocus])
  const activeSource = sourceOptions.find(option => option.key === sourceFocus) ?? sourceOptions[0]
  const briefingTitle = readLang === 'hi' ? 'दैनिक समाचार' : 'Daily Briefing'

  // If the feed opens on a date that has no pack yet (e.g. today's hasn't been
  // generated), fall back to the most recent date that actually has stories.
  const autoDatePicked = useRef(false)
  useEffect(() => {
    if (autoDatePicked.current) return
    if (dates.length > 0 && !dates.includes(selectedDate)) {
      autoDatePicked.current = true
      setSelectedDate(dates[0])
    }
  }, [dates, selectedDate, setSelectedDate])

  function chooseGs(paper: typeof gsFocus) {
    setGsFocus(paper)
    setGsMenuOpen(false)
  }
  function chooseSource(source: SourceFocus) {
    setSourceFocus(source)
    setSourceMenuOpen(false)
  }
  const briefing = useMemo(() => {
    const gs = new Set<string>()
    articles.forEach(article => {
      gs.add(article.gsPaper)
    })
    return {
      gsCount: gs.size,
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
      <div ref={heroRef} className="hero-head" style={{ padding: '4px 20px 12px', position: 'relative', zIndex: 120, flexShrink: 0, textAlign: 'center' }}>
        <p className="hero-sub" style={{ fontSize: 12.5, color: 'var(--on2)', fontWeight: 700, marginBottom: 3 }}>{readLang === 'hi' ? 'नमस्ते, अभ्यर्थी 👋' : 'Hello, aspirant 👋'}</p>
        <h2 aria-label={briefingTitle} style={{ fontSize: 27, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.08, color: 'var(--on)' }}>
          {readLang === 'hi'
            ? <span className="hero-ch" aria-hidden="true">{briefingTitle}</span>
            : briefingTitle.split('').map((ch, i) => (
                <span className="hero-ch" aria-hidden="true" key={i}>{ch}</span>
              ))}
        </h2>
        <div className="briefing-rail">
          <div className="briefing-source-dd">
            <button
              type="button"
              className={`briefing-source-toggle ${activeSource.tone}`}
              onClick={() => {
                setGsMenuOpen(false)
                setSourceMenuOpen(o => !o)
              }}
              aria-haspopup="listbox"
              aria-expanded={sourceMenuOpen}
            >
              <span className={`source-logo ${activeSource.tone}`}><img src={activeSource.logo} alt="" /></span>
              <b>{activeSource.label}</b>
              <i>{articles.length}</i>
              <FontAwesomeIcon icon={faChevronDown} className={`briefing-gs-caret ${sourceMenuOpen ? 'open' : ''}`} />
            </button>
            {sourceMenuOpen && (
              <>
                <div className="briefing-gs-scrim" onClick={() => setSourceMenuOpen(false)} />
                <div className="briefing-source-menu" role="listbox">
                  {sourceOptions.map(option => {
                    const countKey = option.key ?? 'all'
                    return (
                      <button
                        key={option.tone}
                        role="option"
                        aria-selected={sourceFocus === option.key}
                        className={sourceFocus === option.key ? 'on' : ''}
                        onClick={() => chooseSource(option.key)}
                      >
                        <span className={`source-logo ${option.tone}`}><img src={option.logo} alt="" /></span>
                        <b>{option.label}</b>
                        <i>{sourceCounts[countKey]}</i>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {focusablePapers.length > 0 && (
            <div className="briefing-gs-dd">
              <button
                type="button"
                className={`briefing-gs-toggle ${gsFocus ? 'on' : ''}`}
                onClick={() => {
                  setSourceMenuOpen(false)
                  setGsMenuOpen(o => !o)
                }}
                aria-haspopup="listbox"
                aria-expanded={gsMenuOpen}
              >
                {gsFocus ? <><b>{gsFocus}</b> {readLang === 'hi' ? 'केवल' : 'only'}</> : <><b>{briefing.gsCount}</b> {readLang === 'hi' ? 'GS क्षेत्र' : 'GS areas'}</>}
                <FontAwesomeIcon icon={faChevronDown} className={`briefing-gs-caret ${gsMenuOpen ? 'open' : ''}`} />
              </button>
              {gsMenuOpen && (
                <>
                  <div className="briefing-gs-scrim" onClick={() => setGsMenuOpen(false)} />
                  <div className="briefing-gs-menu" role="listbox">
                    <button
                      role="option"
                      aria-selected={!gsFocus}
                      className={!gsFocus ? 'on' : ''}
                      onClick={() => chooseGs(null)}
                    >
                      {readLang === 'hi' ? 'सभी GS क्षेत्र' : 'All GS areas'}<i>{focusablePapers.reduce((n, p) => n + (gsCounts[p] ?? 0), 0)}</i>
                    </button>
                    {focusablePapers.map(p => (
                      <button
                        key={p}
                        role="option"
                        aria-selected={gsFocus === p}
                        className={gsFocus === p ? 'on' : ''}
                        onClick={() => chooseGs(p)}
                      >
                        {p}<i>{gsCounts[p] ?? 0}</i>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
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
            <FeedEmptyState date={selectedDate} animate={settings.feedCosmicBackdrop} />
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
            <FeedEmptyState date={selectedDate} animate={settings.feedCosmicBackdrop} />
          )}
        </div>
      )}
    </div>
  )
}
