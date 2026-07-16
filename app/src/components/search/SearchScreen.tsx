import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faChevronDown, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { CATEGORIES, CATEGORY_COLORS, TODAY } from '@/constants/categories'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useHaptic } from '@/hooks/useHaptic'
import { useAllArticles } from '@/hooks/useAllArticles'
import type { Article, Category } from '@/types/article'

type SearchScope = 'all' | 'today'

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function searchableText(article: Article) {
  return [
    article.headline,
    article.summary,
    article.whyItMatters,
    article.category,
    article.gsPaper,
    article.source,
    article.date,
    article.deepDive.syllabusLinkage ?? '',
    article.deepDive.context ?? '',
    article.deepDive.explanation,
    article.deepDive.possibleMainsQuestion,
    article.audioScript ?? '',
    article.audioScriptHi ?? '',
    ...(article.keyTerms ?? []),
    ...(article.deepDive.keyHighlights ?? []),
    ...(article.deepDive.keyConcepts?.flatMap(item => [item.term, item.definition]) ?? []),
    ...(article.deepDive.wayForward ?? []),
    article.deepDive.hindi?.syllabusLinkage ?? '',
    article.deepDive.hindi?.context ?? '',
    article.deepDive.hindi?.possibleMainsQuestion ?? '',
    ...(article.deepDive.hindi?.keyHighlights ?? []),
    ...(article.deepDive.hindi?.keyConcepts?.flatMap(item => [item.term, item.definition]) ?? []),
    ...(article.deepDive.hindi?.wayForward ?? []),
  ].join(' ').toLocaleLowerCase()
}

export function SearchScreen() {
  const { goBack, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [scope, setScope] = useState<SearchScope>('all')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const haptic = useHaptic()
  const { loading: archiveLoading } = useAllArticles()

  const allArticles = useMemo(
    () => Object.values(articlesByDate).flat().sort((left, right) => right.date.localeCompare(left.date)),
    [articlesByDate],
  )

  const results = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
    return allArticles.filter(article => {
      if (scope === 'today' && article.date !== TODAY) return false
      if (activeCategory !== 'all' && article.category !== activeCategory) return false
      if (!terms.length) return true
      const haystack = searchableText(article)
      return terms.every(term => haystack.includes(term))
    })
  }, [query, activeCategory, allArticles, scope])

  const isDiscovering = !query.trim() && activeCategory === 'all'
  const visibleResults = results
  const todayArticleCount = allArticles.filter(article => article.date === TODAY).length
  const archiveDateCount = new Set(allArticles.map(article => article.date)).size

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.search-app-header, .search-toolbar, .search-context, .search-result',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.42, ease: EASE.out, stagger: 0.035, clearProps: 'transform,opacity' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const cards = root.querySelectorAll('.search-result')
    gsap.fromTo(cards,
      { opacity: 0.7, y: 6 },
      { opacity: 1, y: 0, duration: 0.25, ease: EASE.out, stagger: 0.02, overwrite: true, clearProps: 'transform,opacity' })
  }, [activeCategory, query])

  async function openArticle(article: Article) {
    await haptic()
    setActiveArticle(article)
    setOverlay('deep-dive')
  }

  async function leaveSearch() {
    await haptic()
    goBack('feed')
  }

  async function chooseCategory(category: Category | 'all') {
    await haptic(5)
    setActiveCategory(category)
  }

  function resetSearch() {
    setQuery('')
    setActiveCategory('all')
    setScope('all')
    inputRef.current?.focus()
  }

  function highlighted(value: string) {
    const clean = query.trim()
    if (!clean || clean.includes(' ')) return value
    const index = value.toLocaleLowerCase().indexOf(clean.toLocaleLowerCase())
    if (index < 0) return value
    return <>{value.slice(0, index)}<mark>{value.slice(index, index + clean.length)}</mark>{value.slice(index + clean.length)}</>
  }

  return (
    <div ref={rootRef} className="search-command">
      <header className="search-app-header">
        <button type="button" onClick={() => void leaveSearch()} aria-label="Back to Daily Briefing">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span><small>Daily Briefing</small><h1>Search</h1></span>
      </header>

      <main className="search-app-body">
        <div className="search-toolbar">
          <label className="search-field">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search every article and Deep Dive"
              aria-label="Search all current affairs"
              autoComplete="off"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><FontAwesomeIcon icon={faXmark} /></button>}
          </label>

          <div className="search-filter-row">
            <div className="search-scope" role="group" aria-label="Choose article date range">
              <button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All articles</button>
              <button type="button" className={scope === 'today' ? 'active' : ''} onClick={() => setScope('today')}>Today {todayArticleCount > 0 && <span>{todayArticleCount}</span>}</button>
            </div>
            <label className="search-subject-filter">
              <select value={activeCategory} onChange={event => void chooseCategory(event.target.value as Category | 'all')} aria-label="Filter search by subject">
                <option value="all">All subjects</option>
                {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <FontAwesomeIcon icon={faChevronDown} />
            </label>
          </div>
        </div>

        <div className="search-context">
          <span>
            <b>{isDiscovering && scope === 'all' ? 'All published articles' : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}</b>
            <small>{scope === 'today'
              ? `Today’s briefing · ${formatDate(TODAY)}${activeCategory === 'all' ? '' : ` · ${activeCategory}`}`
              : isDiscovering
                ? archiveLoading ? 'Loading the complete archive…' : `${allArticles.length} stories across ${archiveDateCount} published ${archiveDateCount === 1 ? 'date' : 'dates'}`
                : activeCategory === 'all' ? 'Across the complete archive' : `${activeCategory} · complete archive`}</small>
          </span>
          {!isDiscovering && <button type="button" onClick={resetSearch}>Reset</button>}
        </div>

        {visibleResults.length ? (
          <section className="search-results" aria-label="Search results">
            {visibleResults.map(article => (
              <button
                type="button"
                key={`${article.date}:${article.id}`}
                className="search-result"
                style={{ '--cat': CATEGORY_COLORS[article.category] } as CSSProperties}
                onClick={() => void openArticle(article)}
              >
                <span className="search-result-meta"><i />{article.category}<em>{formatDate(article.date)}</em></span>
                <h2>{highlighted(article.headline)}</h2>
                <p>{highlighted(article.summary)}</p>
                <span className="search-result-foot"><small>{article.source} · {article.gsPaper}</small><FontAwesomeIcon icon={faArrowRight} /></span>
              </button>
            ))}
          </section>
        ) : (
          <section className="search-empty">
            <span><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
            <h2>{scope === 'today' && !todayArticleCount ? 'Today’s briefing is not published yet' : 'No matching story'}</h2>
            <p>{scope === 'today' && !todayArticleCount ? 'Switch to All articles to search the complete archive.' : 'Try one clear keyword or widen the subject filter.'}</p>
            <button type="button" onClick={resetSearch}>Clear search</button>
          </section>
        )}
      </main>
    </div>
  )
}
