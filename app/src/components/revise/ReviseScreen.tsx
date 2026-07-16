import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark as faBookmarkSolid,
  faBookOpen,
  faCheck,
  faChevronDown,
  faChevronRight,
  faMagnifyingGlass,
  faPlay,
  faRotateLeft,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkRegular } from '@fortawesome/free-regular-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useAllArticles } from '@/hooks/useAllArticles'
import { articleQs, CURRENT_AFFAIRS_MCQ_START, seededPick } from '@/utils/practiceUtils'
import type { Question } from '@/utils/practiceUtils'
import type { Article } from '@/types/article'
import { splitUPSCStem } from '@/utils/questionQuality'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { relatedPyqs } from '@/utils/questionLinks'
import { loadPyqManifest, loadPyqYears } from '@/utils/pyqData'
import type { PyqItem } from '@/stores/usePracticeStore'

type VaultMode = 'questions' | 'articles'
type PracticeCount = 10 | 20 | 50 | 'all'
type StatusFilter = 'all' | 'unattempted' | 'incorrect' | 'bookmarked'
type QuestionEntry = { question: Question; article: Article; number: number }
const PAGE_SIZE = 12

const relatedPyqCache = new WeakMap<PyqItem[], Map<string, ReturnType<typeof relatedPyqs>>>()

function cachedRelatedPyqs(article: Article, pyqData: PyqItem[]) {
  let cache = relatedPyqCache.get(pyqData)
  if (!cache) {
    cache = new Map()
    relatedPyqCache.set(pyqData, cache)
  }
  const cached = cache.get(article.id)
  if (cached) return cached
  if (cache.has(article.id)) return []

  const representative = articleQs([article])[0]
  const related = representative ? relatedPyqs(article, representative, pyqData, 2) : []
  cache.set(article.id, related)
  return related
}

function loadVaultMode(): VaultMode {
  const value = localStorage.getItem('penni.ca-vault.mode')
  localStorage.removeItem('penni.ca-vault.mode')
  return value === 'questions' ? 'questions' : 'articles'
}

function articleTopics(article: Article) {
  const topics = (article.keyTerms ?? []).map(term => term.trim()).filter(Boolean)
  return topics.length ? topics : [article.category]
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function QuestionStem({ text, compact = false }: { text: string; compact?: boolean }) {
  const structured = splitUPSCStem(text)
  if (!structured.statements.length) return <p className="pyqv-question-text">{text}</p>
  const shownStatements = compact ? structured.statements.slice(0, 2) : structured.statements
  return (
    <div className={`pyqv-question-text structured ${compact ? 'compact' : ''}`}>
      {structured.lead && <p>{structured.lead}</p>}
      <ol className="upsc-statement-list">
        {shownStatements.map((statement, index) => (
          <li key={index}>
            <span className="upsc-statement-label">{structured.statementLabels[index] ?? index + 1}</span>
            <span className="upsc-statement-text">{statement}</span>
          </li>
        ))}
      </ol>
      {compact && structured.statements.length > shownStatements.length && (
        <span className="pyqv-more-statements">+{structured.statements.length - shownStatements.length} more statement{structured.statements.length - shownStatements.length > 1 ? 's' : ''}</span>
      )}
      {structured.ask && <p className="qz-ask">{structured.ask}</p>}
    </div>
  )
}

export function ReviseScreen() {
  const { goBack, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const { toggle, isBookmarked } = useBookmarkStore()
  const { stats, questionBookmarks, toggleQbm, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const [mode, setMode] = useState<VaultMode>(loadVaultMode)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [subject, setSubject] = useState('all')
  const [gsPaper, setGsPaper] = useState('all')
  const [subtopic, setSubtopic] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [practiceCount, setPracticeCount] = useState<PracticeCount>(10)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [quizQuestions, setQuizQuestions] = useState<Question[] | null>(null)
  const [selected, setSelected] = useState<QuestionEntry | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [toast, setToast] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { loading: articlesLoading } = useAllArticles()

  useEffect(() => {
    if (mode !== 'questions' || (pyqReady && pyqData.length > 1000)) return
    let cancelled = false

    // PYQs are only needed in Questions mode. Start after its first paint and
    // yield between small year batches so the 31-year archive stays off the
    // Revise launch path and never monopolises the mobile main thread.
    const timeout = window.setTimeout(() => {
      void loadPyqManifest()
        .then(async manifest => {
          const items = []
          for (let index = 0; index < manifest.totals.years.length; index += 4) {
            if (cancelled) return []
            items.push(...await loadPyqYears(manifest.totals.years.slice(index, index + 4)))
            await new Promise<void>(resolve => window.setTimeout(resolve, 0))
          }
          return items
        })
        .then(items => {
          if (cancelled || !items.length) return
          setPyqData(items.map((item): PyqItem => ({
            id: item.id,
            exam: item.exam,
            year: item.year,
            subject: item.subject,
            question: item.stem,
            options: item.options,
            answer: item.answer,
            explanation: item.solution.detail,
            paper: item.paper,
            keyPoints: item.keyPoints,
          })))
        })
        .catch(() => {})
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [mode, pyqData.length, pyqReady, setPyqData])

  const allArticles = useMemo(
    () => Object.values(articlesByDate).flat().sort((a, b) => b.date.localeCompare(a.date)),
    [articlesByDate],
  )

  const archiveArticles = useMemo(() => allArticles.filter(article => article.date >= CURRENT_AFFAIRS_MCQ_START), [allArticles])
  const entries = useMemo(() => archiveArticles.flatMap(article =>
    articleQs([article]).map((question, number) => ({ question, article, number: number + 1 }))), [archiveArticles])

  const years = useMemo(() => [...new Set(archiveArticles.map(article => article.date.slice(0, 4)))].sort().reverse(), [archiveArticles])
  const months = useMemo(() => [...new Set(archiveArticles
    .filter(article => year === 'all' || article.date.startsWith(year))
    .map(article => article.date.slice(0, 7)))].sort().reverse(), [archiveArticles, year])
  const subjects = useMemo(() => [...new Set(archiveArticles
    .filter(article => year === 'all' || article.date.startsWith(year))
    .filter(article => month === 'all' || article.date.startsWith(month))
    .map(article => article.category))].sort(), [archiveArticles, month, year])
  const subtopics = useMemo(() => {
    const counts = new Map<string, number>()
    archiveArticles
      .filter(article => year === 'all' || article.date.startsWith(year))
      .filter(article => month === 'all' || article.date.startsWith(month))
      .filter(article => subject === 'all' || article.category === subject)
      .forEach(article => articleTopics(article).forEach(topic => counts.set(topic, (counts.get(topic) ?? 0) + 1)))
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label))
  }, [archiveArticles, month, subject, year])

  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  function articleMatches(article: Article) {
    if (year !== 'all' && !article.date.startsWith(year)) return false
    if (month !== 'all' && !article.date.startsWith(month)) return false
    if (subject !== 'all' && article.category !== subject) return false
    if (gsPaper !== 'all' && article.gsPaper !== gsPaper) return false
    if (subtopic !== 'all' && !articleTopics(article).includes(subtopic)) return false
    return true
  }

  const questionResults = useMemo(() => entries.filter(entry => {
    if (!articleMatches(entry.article)) return false
    const answer = stats.a[entry.question.id]
    const bookmarked = questionBookmarks.includes(entry.question.id) || isBookmarked(entry.article.id)
    if (status === 'unattempted' && answer) return false
    if (status === 'incorrect' && answer?.[0] !== 0) return false
    if (status === 'bookmarked' && !bookmarked) return false
    if (!normalizedQuery) return true
    return [entry.question.q, entry.article.headline, entry.article.category, entry.article.gsPaper, ...articleTopics(entry.article)]
      .join(' ').toLowerCase().includes(normalizedQuery)
  }), [entries, gsPaper, month, normalizedQuery, questionBookmarks, stats.a, status, subject, subtopic, year])

  const articleResults = useMemo(() => archiveArticles.filter(article => {
    if (!articleMatches(article)) return false
    const articleQuestionIds = articleQs([article]).map(question => question.id)
    if (status === 'unattempted' && articleQuestionIds.some(id => stats.a[id])) return false
    if (status === 'incorrect' && !articleQuestionIds.some(id => stats.a[id]?.[0] === 0)) return false
    if (status === 'bookmarked' && !isBookmarked(article.id) && !articleQuestionIds.some(id => questionBookmarks.includes(id))) return false
    if (!normalizedQuery) return true
    return [article.headline, article.summary, article.category, article.gsPaper, ...articleTopics(article)]
      .join(' ').toLowerCase().includes(normalizedQuery)
  }), [archiveArticles, gsPaper, month, normalizedQuery, questionBookmarks, stats.a, status, subject, subtopic, year])

  const attempted = questionResults.filter(entry => stats.a[entry.question.id]).length
  const incorrect = questionResults.filter(entry => stats.a[entry.question.id]?.[0] === 0).length
  const resultCount = mode === 'questions' ? questionResults.length : articleResults.length
  const activeFilterCount = [year, month, subject, gsPaper, subtopic, status]
    .filter(value => value !== 'all').length
  const linkCandidateArticles = useMemo(() => {
    const candidates = new Map<string, Article>()
    if (mode === 'questions') {
      questionResults.slice(0, visibleCount).forEach(entry => candidates.set(entry.article.id, entry.article))
      if (selected) candidates.set(selected.article.id, selected.article)
    }
    return [...candidates.values()]
  }, [mode, questionResults, selected, visibleCount])

  const relatedPyqsByArticle = useMemo(() => {
    const links = new Map<string, ReturnType<typeof relatedPyqs>>()
    if (pyqData.length < 1000) return links
    linkCandidateArticles.forEach(article => {
      const related = cachedRelatedPyqs(article, pyqData)
      if (related.length) links.set(article.id, related)
    })
    return links
  }, [linkCandidateArticles, pyqData])
  const selectedRelatedPyqs = selected ? relatedPyqsByArticle.get(selected.article.id) ?? [] : []

  useEffect(() => { setSubtopic('all') }, [year, month, subject])
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [year, month, subject, gsPaper, subtopic, status, query, mode])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  function clearFilters() {
    setYear('all')
    setMonth('all')
    setSubject('all')
    setGsPaper('all')
    setSubtopic('all')
    setStatus('all')
    setQuery('')
  }

  function startPractice(pool = questionResults.map(entry => entry.question), count: PracticeCount = practiceCount) {
    if (!pool.length) { showToast('No questions match this selection'); return }
    const requested = count === 'all' ? pool.length : count
    setQuizQuestions(seededPick(pool, Math.min(requested, pool.length), `ca-vault-${Date.now()}`))
    setSelected(null)
  }

  function openArticle(article: Article) {
    setActiveArticle(article)
    setOverlay('deep-dive')
  }

  function switchMode(next: VaultMode) {
    setMode(next)
    setSelected(null)
    setFiltersOpen(false)
  }

  if (quizQuestions) {
    return (
      <QuizPlayer
        title="Current Affairs Practice"
        eyebrow="Current Affairs Vault"
        description="A topic-filtered UPSC-style test built from your current-affairs archive."
        questions={quizQuestions}
        onClose={() => setQuizQuestions(null)}
        onShowToast={showToast}
      />
    )
  }

  return (
    <div className={`pyqv-shell ca-vault-shell mode-${mode}`}>
      <header className="pyqv-header">
        <button className="pyqv-icon-btn" onClick={() => goBack('feed')} aria-label="Back from Current Affairs Vault">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <span>Year-round revision library</span>
          <h2><span className="ca-vault-title-full">Current Affairs Vault</span><span className="ca-vault-title-short">CA Vault</span></h2>
        </div>
        <div className="pyqv-mode-switch" role="tablist" aria-label="Library view">
          <button className={mode === 'questions' ? 'active' : ''} onClick={() => switchMode('questions')}>Questions</button>
          <button className={mode === 'articles' ? 'active' : ''} onClick={() => switchMode('articles')}>Articles</button>
        </div>
      </header>

      <main className="pyqv-main">
        <section className="pyqv-overview">
          <div className="pyqv-overview-copy">
            <span>Current Affairs Vault</span>
            <h3>{mode === 'questions' ? 'Build a precise topic set.' : 'Read the archive without the clutter.'}</h3>
            <p>{mode === 'questions'
              ? 'Filter by year, month, GS paper, subject or sub-topic. Mistakes and saved questions become focused revision sets.'
              : 'A clean dated reading archive from 15 July 2026 onward, organised by subject and linked to each deep dive.'}</p>
          </div>
          <div className="pyqv-metrics">
            {mode === 'questions' ? <>
              <div><b>{resultCount}</b><span>in selection</span></div>
              <div><b>{attempted}</b><span>attempted</span></div>
              <div><b>{incorrect}</b><span>to revise</span></div>
            </> : <>
              <div><b>{articleResults.length}</b><span>articles</span></div>
              <div><b>{new Set(articleResults.map(article => article.category)).size}</b><span>subjects</span></div>
              <div><b>{articleResults.filter(article => isBookmarked(article.id)).length}</b><span>saved</span></div>
            </>}
          </div>
        </section>

        <div className="vault-mobile-tools" aria-label="Archive tools">
          <button onClick={() => setFiltersOpen(true)}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <span>{query || `Search ${mode}`}</span>
          </button>
          <button onClick={() => setFiltersOpen(true)}>
            <FontAwesomeIcon icon={faSliders} />
            <span>Filters</span>
            {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
          </button>
        </div>
        {filtersOpen && <button className="vault-filter-scrim" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />}

        {mode === 'questions' && <section className={`pyqv-controls vault-filter-surface ${filtersOpen ? 'mobile-open' : ''}`} aria-label="Current affairs filters">
          <div className="vault-mobile-sheet-head">
            <i />
            <div><b>Search and filters</b><span>{questionResults.length} questions match</span></div>
            <button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          <div className="pyqv-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions, issues, concepts or sub-topics" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><FontAwesomeIcon icon={faXmark} /></button>}
          </div>

          <div className="pyqv-filter-grid ca-vault-filters">
            <label><span>Year</span><div><select value={year} onChange={event => { setYear(event.target.value); setMonth('all') }}><option value="all">All years</option>{years.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Month</span><div><select value={month} onChange={event => setMonth(event.target.value)}><option value="all">All months</option>{months.map(item => <option key={item} value={item}>{monthLabel(item)}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>GS paper</span><div><select value={gsPaper} onChange={event => setGsPaper(event.target.value)}><option value="all">All GS papers</option>{['GS 1', 'GS 2', 'GS 3', 'GS 4'].map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Subject</span><div><select value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Sub-topic</span><div><select value={subtopic} onChange={event => setSubtopic(event.target.value)}><option value="all">All sub-topics</option>{subtopics.map(item => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Revision status</span><div><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">All content</option><option value="unattempted">Not attempted</option><option value="incorrect">Incorrect answers</option><option value="bookmarked">Bookmarked</option></select><FontAwesomeIcon icon={faChevronDown} /></div></label>
          </div>

          <div className="pyqv-control-footer">
            <div className="ca-vault-active-filter">{subtopic !== 'all' ? subtopic : subject !== 'all' ? subject : 'All current affairs'}</div>
            <button className="pyqv-reset" onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset filters</button>
          </div>
          <button className="vault-mobile-apply" onClick={() => setFiltersOpen(false)}>Show {questionResults.length} questions</button>
        </section>}

        {mode === 'articles' && (
          <section className={`ca-article-toolbar vault-filter-surface ${filtersOpen ? 'mobile-open' : ''}`}>
            <div className="vault-mobile-sheet-head">
              <i />
              <div><b>Search and filters</b><span>{articleResults.length} articles match</span></div>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="pyqv-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the article archive" />{query && <button onClick={() => setQuery('')}><FontAwesomeIcon icon={faXmark} /></button>}</div>
            <div className="ca-article-filter-grid">
              <label><span>Year</span><div><select value={year} onChange={event => { setYear(event.target.value); setMonth('all') }}><option value="all">All years</option>{years.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Month</span><div><select value={month} onChange={event => setMonth(event.target.value)}><option value="all">All months</option>{months.map(item => <option key={item} value={item}>{monthLabel(item)}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>GS paper</span><div><select value={gsPaper} onChange={event => setGsPaper(event.target.value)}><option value="all">All GS papers</option>{['GS 1', 'GS 2', 'GS 3', 'GS 4'].map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Topic</span><div><select value={subtopic} onChange={event => setSubtopic(event.target.value)}><option value="all">All topics</option>{subtopics.map(item => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Saved</span><div><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">All articles</option><option value="bookmarked">Bookmarked only</option></select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            </div>
            <div className="ca-article-subjects"><button className={subject === 'all' ? 'active' : ''} onClick={() => setSubject('all')}>All</button>{subjects.map(item => <button key={item} className={subject === item ? 'active' : ''} onClick={() => setSubject(item)}>{item}</button>)}</div>
            <div className="ca-article-filter-footer"><span>{articleResults.length} articles match</span><button onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset</button></div>
            <button className="vault-mobile-apply" onClick={() => setFiltersOpen(false)}>Show {articleResults.length} articles</button>
          </section>
        )}

        {mode === 'questions' && (
          <section className="pyqv-practice-bar">
            <div><span>Build a topic test</span><b>{questionResults.length ? `${practiceCount === 'all' ? questionResults.length : Math.min(practiceCount, questionResults.length)} questions from this selection` : 'Adjust filters to find questions'}</b></div>
            <div className="pyqv-count-picker" aria-label="Question count">
              {[10, 20, 50].map(count => <button key={count} className={practiceCount === count ? 'active' : ''} onClick={() => setPracticeCount(count as PracticeCount)}>{count}</button>)}
            </div>
            <button className="pyqv-start" onClick={() => startPractice()} disabled={!questionResults.length}><FontAwesomeIcon icon={faPlay} /> Start test</button>
          </section>
        )}

        <div className="pyqv-result-head">
          <div><span>{mode === 'questions' ? 'Question bank' : 'Article archive'}</span><b>{resultCount} {mode}</b></div>
        </div>

        {articlesLoading && !resultCount ? (
          <div className="pyqv-list loading" role="status" aria-label="Loading current affairs archive">
            {Array.from({ length: 3 }, (_, index) => <div className="pyqv-skeleton" key={index} />)}
          </div>
        ) : !resultCount ? (
          <div className="pyqv-empty"><FontAwesomeIcon icon={faMagnifyingGlass} /><b>No results match</b><p>Try a wider date, subject, sub-topic or revision status.</p><button onClick={clearFilters}>Clear filters</button></div>
        ) : mode === 'questions' ? (
          <div className="pyqv-list">
            {questionResults.slice(0, visibleCount).map(entry => {
              const answered = stats.a[entry.question.id]
              const bookmarked = questionBookmarks.includes(entry.question.id)
              const related = relatedPyqsByArticle.get(entry.article.id) ?? []
              return (
                <article className="pyqv-card" key={entry.question.id} role="button" tabIndex={0} onClick={() => { setSelected(entry); setShowAnswer(false) }}>
                  <div className="pyqv-card-meta">
                    <span>{new Date(`${entry.article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>{entry.article.gsPaper}</span><span>{entry.article.category}</span><span>{articleTopics(entry.article)[0]}</span>
                    {answered && <i className="attempted"><FontAwesomeIcon icon={faCheck} /> {answered[0] ? 'correct' : 'revise'}</i>}
                    <button className={bookmarked ? 'active' : ''} onClick={event => { event.stopPropagation(); toggleQbm(entry.question.id, showToast) }} aria-label="Bookmark question"><FontAwesomeIcon icon={bookmarked ? faBookmarkSolid : faBookmarkRegular} /></button>
                  </div>
                  <QuestionStem text={entry.question.q} compact />
                  <div className="ca-vault-source">From: {entry.article.headline}</div>
                  {related.length > 0 && (
                    <details className="question-link-signal" onClick={event => event.stopPropagation()}>
                      <summary><span>Related PYQ available</span><b>{related.length === 1 ? `UPSC ${related[0].item.year}` : `${related.length} close matches`}</b><FontAwesomeIcon icon={faChevronDown} /></summary>
                      <div>{related.map(({ item, reason }) => <p key={item.id}><span>UPSC {item.year} · {item.subject}</span><b>{item.question}</b><i>{reason}</i></p>)}</div>
                    </details>
                  )}
                  <div className="pyqv-card-actions">
                    <button onClick={event => { event.stopPropagation(); setSelected(entry); setShowAnswer(false) }}><FontAwesomeIcon icon={faBookOpen} /> View question</button>
                    <button onClick={event => { event.stopPropagation(); setSelected(entry); setShowAnswer(true) }}>See answer <FontAwesomeIcon icon={faChevronRight} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="pyqv-list ca-vault-article-list">
            {articleResults.slice(0, visibleCount).map(article => {
              const bookmarked = isBookmarked(article.id)
              const questionCount = article.prelimsQs?.length ?? 0
              return (
                <article className="pyqv-card ca-vault-article" key={article.id} role="button" tabIndex={0} onClick={() => openArticle(article)}>
                  <div className="pyqv-card-meta"><span>{new Date(`${article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{article.gsPaper}</span><span>{article.category}</span><span>{articleTopics(article)[0]}</span><button className={bookmarked ? 'active' : ''} onClick={event => { event.stopPropagation(); toggle(article.id) }}><FontAwesomeIcon icon={bookmarked ? faBookmarkSolid : faBookmarkRegular} /></button></div>
                  <h3>{article.headline}</h3><p>{article.summary}</p>
                  <div className="pyqv-card-actions"><button onClick={event => { event.stopPropagation(); openArticle(article) }}><FontAwesomeIcon icon={faBookOpen} /> Open deep dive</button><button onClick={event => { event.stopPropagation(); startPractice(articleQs([article]), 'all') }}>{questionCount} MCQs <FontAwesomeIcon icon={faChevronRight} /></button></div>
                </article>
              )
            })}
          </div>
        )}

        {visibleCount < resultCount && <button className="pyqv-load-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, resultCount - visibleCount)} more <span>{resultCount - visibleCount} remaining</span></button>}
      </main>

      {selected && (
        <div className="pyqv-detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="pyqv-detail" onClick={event => event.stopPropagation()}>
            <div className="pyqv-detail-head"><div><span>{selected.article.date} · Question {selected.number}</span><b>{selected.article.category} · {articleTopics(selected.article)[0]}</b></div><button onClick={() => setSelected(null)}><FontAwesomeIcon icon={faXmark} /></button></div>
            <div className="pyqv-detail-scroll">
              <QuestionStem text={selected.question.q} />
              <div className="pyqv-detail-options">{selected.question.options.map((option, index) => <div key={index} className={showAnswer && index === selected.question.answer ? 'correct' : ''}><span>{String.fromCharCode(65 + index)}</span><p>{option}</p>{showAnswer && index === selected.question.answer && <FontAwesomeIcon icon={faCheck} />}</div>)}</div>
              {showAnswer && <div className="ca-vault-explanation"><b>Explanation</b><p>{selected.question.explanation}</p>{selected.question.ref && <span>Reference: {selected.question.ref}</span>}</div>}
              {selectedRelatedPyqs.length > 0 && (
                <section className="question-connection">
                  <div className="question-connection-head"><span>Related PYQ available</span><p>Open the precedent now; you do not need to reveal this question first.</p></div>
                  {selectedRelatedPyqs.map(({ item, reason }) => (
                    <details key={item.id}>
                      <summary><span>UPSC {item.year} · {item.subject}</span><b>{item.question}</b><i>{reason}</i></summary>
                      <div><p>{item.options?.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('  ·  ')}</p>{item.answer !== undefined && <b>Answer: {String.fromCharCode(65 + item.answer)}</b>}{item.explanation && <em>{item.explanation}</em>}</div>
                    </details>
                  ))}
                </section>
              )}
            </div>
            <div className="pyqv-detail-actions">
              {!showAnswer && <button onClick={() => setShowAnswer(true)}><FontAwesomeIcon icon={faBookOpen} /> See solution</button>}
              <button onClick={() => startPractice([selected.question], 'all')}><FontAwesomeIcon icon={faPlay} /> Practise question</button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="pyqv-toast">{toast}</div>}
    </div>
  )
}
