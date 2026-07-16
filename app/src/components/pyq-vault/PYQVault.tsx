import { useEffect, useMemo, useState } from 'react'
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
import { usePracticeStore } from '@/stores/usePracticeStore'
import type { PyqDifficulty, PyqManifest, PyqQuestion } from '@/types/pyq'
import { splitUPSCStem } from '@/utils/questionQuality'
import { seededPick } from '@/utils/practiceUtils'
import {
  loadPyqManifest,
  loadPyqYears,
  pyqQuestionId,
  pyqToPracticeQuestion,
} from '@/utils/pyqData'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { PyqSolutionView } from './PyqSolutionView'
import { getPyqSubtopic } from '@/utils/pyqTaxonomy'
import { useAllArticles } from '@/hooks/useAllArticles'
import { articleQs } from '@/utils/practiceUtils'
import { relatedCurrentQuestions } from '@/utils/questionLinks'

type AllOr<T> = T | 'all'

function QuestionStem({ text, compact = false }: { text: string; compact?: boolean }) {
  const structured = splitUPSCStem(text)
  if (!structured.statements.length) return <p className="pyqv-question-text">{text}</p>
  const shownStatements = compact ? structured.statements.slice(0, 2) : structured.statements
  return (
    <div className={`pyqv-question-text structured ${compact ? 'compact' : ''}`}>
      {structured.lead && <p>{structured.lead}</p>}
      <ol className="upsc-statement-list">{shownStatements.map((statement, index) => (
        <li key={index}>
          <span className="upsc-statement-label">{structured.statementLabels[index] ?? index + 1}</span>
          <span className="upsc-statement-text">{statement}</span>
        </li>
      ))}</ol>
      {compact && structured.statements.length > shownStatements.length && (
        <span className="pyqv-more-statements">+{structured.statements.length - shownStatements.length} more statements</span>
      )}
      {structured.ask && <p className="ask">{structured.ask}</p>}
    </div>
  )
}

function answerLabel(question: PyqQuestion) {
  if (question.answer === undefined) return ''
  return String.fromCharCode(65 + question.answer)
}

export function PYQVault() {
  const { setOverlay, articlesByDate } = useAppStore()
  const { stats, questionBookmarks, toggleQbm } = usePracticeStore()
  const [manifest, setManifest] = useState<PyqManifest | null>(null)
  const [questions, setQuestions] = useState<PyqQuestion[]>([])
  const [loadedYears, setLoadedYears] = useState<Set<number>>(new Set())
  const [activeYear, setActiveYear] = useState<AllOr<number>>('all')
  const [mode, setMode] = useState<'prelims' | 'mains'>('prelims')
  const [subject, setSubject] = useState('all')
  const [subtopic, setSubtopic] = useState('all')
  const [difficulty, setDifficulty] = useState<AllOr<PyqDifficulty>>('all')
  const [query, setQuery] = useState('')
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(24)
  const [practiceCount, setPracticeCount] = useState<number | 'all'>(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<PyqQuestion | null>(null)
  const [detailMode, setDetailMode] = useState<'question' | 'solution'>('question')
  const [quizQuestions, setQuizQuestions] = useState<PyqQuestion[] | null>(null)
  const [toast, setToast] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  useAllArticles()

  const currentQuestionEntries = useMemo(() => Object.values(articlesByDate).flat().flatMap(article =>
    articleQs([article]).map(question => ({ article, question }))), [articlesByDate])
  const currentLinksByQuestion = useMemo(() => {
    const links = new Map<string, ReturnType<typeof relatedCurrentQuestions>>()
    questions.forEach(question => {
      const related = relatedCurrentQuestions(question, currentQuestionEntries)
      if (related.length) links.set(question.id, related)
    })
    return links
  }, [currentQuestionEntries, questions])
  const selectedCurrentLinks = selected ? currentLinksByQuestion.get(selected.id) ?? [] : []

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  useEffect(() => {
    let active = true
    loadPyqManifest()
      .then((nextManifest) => {
        if (!active) return
        setManifest(nextManifest)
        setActiveYear(nextManifest.totals.years[0] ?? 'all')
      })
      .catch(() => {
        if (active) setError('The PYQ library could not be loaded. Please try again.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!manifest) return
    const wanted = activeYear === 'all' ? manifest.totals.years : [activeYear]
    const missing = wanted.filter((year) => !loadedYears.has(year))
    if (!missing.length) { setLoading(false); return }
    let active = true
    setLoading(true)
    loadPyqYears(missing)
      .then((loaded) => {
        if (!active) return
        setQuestions((current) => {
          const merged = new Map(current.map((question) => [question.id, question]))
          loaded.forEach((question) => merged.set(question.id, question))
          return [...merged.values()]
        })
        setLoadedYears((current) => new Set([...current, ...missing]))
        setError('')
      })
      .catch(() => {
        if (active) setError('This question set could not be loaded. Please try another year.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeYear, loadedYears, manifest])

  const availableSubjects = useMemo(() => {
    if (!manifest) return []
    const papers = activeYear === 'all'
      ? manifest.papers
      : manifest.papers.filter((paper) => paper.year === activeYear)
    return [...new Set(papers.flatMap((paper) => Object.keys(paper.subjects)))].sort()
  }, [activeYear, manifest])

  const yearPool = useMemo(() => questions
    .filter((question) => activeYear === 'all' || question.year === activeYear)
    .sort((a, b) => b.year - a.year || a.qno - b.qno), [activeYear, questions])

  const availableSubtopics = useMemo(() => {
    const counts = new Map<string, number>()
    yearPool
      .filter((question) => subject === 'all' || question.subject === subject)
      .forEach((question) => {
        const value = getPyqSubtopic(question)
        counts.set(value, (counts.get(value) ?? 0) + 1)
      })
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [subject, yearPool])

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return yearPool.filter((question) => {
      if (subject !== 'all' && question.subject !== subject) return false
      const questionSubtopic = getPyqSubtopic(question)
      if (subtopic !== 'all' && questionSubtopic !== subtopic) return false
      if (difficulty !== 'all' && question.difficulty !== difficulty) return false
      if (bookmarkedOnly && !questionBookmarks.includes(pyqQuestionId(question))) return false
      if (!normalizedQuery) return true
      const searchable = [
        question.stem,
        question.subject,
        questionSubtopic,
        question.year,
        ...question.tags,
        ...(question.options ?? []),
      ].join(' ').toLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [bookmarkedOnly, difficulty, query, questionBookmarks, subject, subtopic, yearPool])

  const attempted = useMemo(() => results.filter((question) => stats.a[pyqQuestionId(question)]).length, [results, stats.a])
  const bookmarkedCount = useMemo(() => results.filter((question) => questionBookmarks.includes(pyqQuestionId(question))).length, [questionBookmarks, results])
  const activeFilterCount = [activeYear, subject, subtopic, difficulty]
    .filter(value => value !== 'all').length + (bookmarkedOnly ? 1 : 0)

  useEffect(() => {
    setVisibleCount(24)
  }, [activeYear, subject, difficulty, query, bookmarkedOnly])

  useEffect(() => { setSubtopic('all') }, [activeYear, subject])

  function clearFilters() {
    setSubject('all')
    setSubtopic('all')
    setDifficulty('all')
    setQuery('')
    setBookmarkedOnly(false)
  }

  function startPractice(pool: PyqQuestion[], count: number | 'all' = practiceCount) {
    const eligible = pool.filter((question) => question.options?.length === 4 && question.answer !== undefined)
    if (!eligible.length) { showToast('No practice-ready questions in this selection'); return }
    const requested = count === 'all' ? eligible.length : Math.max(1, count)
    const picked = seededPick(eligible, Math.min(requested, eligible.length), `pyq-${Date.now()}`)
    setQuizQuestions(picked)
    setSelected(null)
  }

  function openDetail(question: PyqQuestion, view: 'question' | 'solution') {
    setDetailMode(view)
    setSelected(question)
  }

  if (quizQuestions) {
    return (
      <QuizPlayer
        title="UPSC Prelims PYQ"
        questions={quizQuestions.map(pyqToPracticeQuestion)}
        onClose={() => setQuizQuestions(null)}
        onShowToast={showToast}
      />
    )
  }

  return (
    <div className="pyqv-shell">
      <header className="pyqv-header">
        <button className="pyqv-icon-btn" onClick={() => setOverlay(null)} aria-label="Close PYQ Vault">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <span>UPSC Question Library</span>
          <h2>PYQ Vault</h2>
        </div>
        <div className="pyqv-mode-switch" role="tablist" aria-label="Examination stage">
          <button className={mode === 'prelims' ? 'active' : ''} onClick={() => { setMode('prelims'); setSelected(null); setFiltersOpen(false) }}>Prelims</button>
          <button className={mode === 'mains' ? 'active' : ''} onClick={() => { setMode('mains'); setSelected(null); setFiltersOpen(false) }}>Mains</button>
        </div>
      </header>

      <main className="pyqv-main">
        {mode === 'mains' ? (
          <section className="pyqv-mains-placeholder">
            <span>Mains PYQ workspace</span>
            <h3>Answer-writing archive, coming next.</h3>
            <p>This section is reserved for paper-wise Mains questions, syllabus filters and model-answer frameworks. Prelims remains fully available from the switch above.</p>
          </section>
        ) : (
        <>
        <section className="pyqv-overview">
          <div className="pyqv-overview-copy">
            <span>PYQ Vault</span>
            <h3>Learn the patterns UPSC repeats.</h3>
            <p>Choose a subject and its connected subtopic, then practise the filtered paper or study the full solution.</p>
          </div>
          <div className="pyqv-metrics">
            <div><b>{results.length.toLocaleString('en-IN')}</b><span>in selection</span></div>
            <div><b>{attempted}</b><span>attempted</span></div>
            <div><b>{bookmarkedCount}</b><span>bookmarked</span></div>
          </div>
        </section>

        <div className="vault-mobile-tools" aria-label="PYQ tools">
          <button onClick={() => setFiltersOpen(true)}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <span>{query || 'Search PYQs'}</span>
          </button>
          <button onClick={() => setFiltersOpen(true)}>
            <FontAwesomeIcon icon={faSliders} />
            <span>Filters</span>
            {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
          </button>
        </div>
        {filtersOpen && <button className="vault-filter-scrim" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />}

        <section className={`pyqv-controls vault-filter-surface ${filtersOpen ? 'mobile-open' : ''}`} aria-label="Question filters">
          <div className="vault-mobile-sheet-head">
            <i />
            <div><b>Search and filters</b><span>{results.length.toLocaleString('en-IN')} questions match</span></div>
            <button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          <div className="pyqv-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search concepts, subtopics or question text"
              aria-label="Search PYQs"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><FontAwesomeIcon icon={faXmark} /></button>}
          </div>

          <div className="pyqv-filter-grid">
            <label>
              <span>Year</span>
              <div><select value={activeYear} onChange={(event) => setActiveYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">All years</option>
                {manifest?.totals.years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select><FontAwesomeIcon icon={faChevronDown} /></div>
            </label>
            <label>
              <span>Subject</span>
              <div><select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="all">All subjects</option>
                {availableSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
              </select><FontAwesomeIcon icon={faChevronDown} /></div>
            </label>
            <label>
              <span>Sub-topic</span>
              <div><select value={subtopic} onChange={(event) => setSubtopic(event.target.value)}>
                <option value="all">All sub-topics</option>
                {availableSubtopics.map((item) => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}
              </select><FontAwesomeIcon icon={faChevronDown} /></div>
            </label>
            <label>
              <span>Difficulty</span>
              <div><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as AllOr<PyqDifficulty>)}>
                <option value="all">All levels</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
              </select><FontAwesomeIcon icon={faChevronDown} /></div>
            </label>
          </div>

          <div className="pyqv-control-footer">
            <button className={`pyqv-bookmark-filter ${bookmarkedOnly ? 'active' : ''}`} onClick={() => setBookmarkedOnly((value) => !value)}>
              <FontAwesomeIcon icon={bookmarkedOnly ? faBookmarkSolid : faBookmarkRegular} /> Bookmarked only
            </button>
            <button className="pyqv-reset" onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset</button>
          </div>
          <button className="vault-mobile-apply" onClick={() => setFiltersOpen(false)}>Show {results.length.toLocaleString('en-IN')} questions</button>
        </section>

        <section className="pyqv-practice-bar">
          <div>
            <span>Build a test</span>
            <b>{results.length ? `${practiceCount === 'all' ? results.length : Math.min(practiceCount, results.length)} questions from this selection` : 'Adjust filters to find questions'}</b>
          </div>
          <div className="pyqv-count-picker" aria-label="Question count">
            {[10, 20, 50].map((count) => <button key={count} className={practiceCount === count ? 'active' : ''} onClick={() => setPracticeCount(count)}>{count}</button>)}
            <input
              type="number"
              min="1"
              max={Math.max(results.length, 1)}
              value={typeof practiceCount === 'number' && ![10, 20, 50].includes(practiceCount) ? practiceCount : ''}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (value > 0) setPracticeCount(value)
              }}
              placeholder="Custom"
              aria-label="Custom question count"
            />
          </div>
          <button className="pyqv-start" onClick={() => startPractice(results)} disabled={!results.length || loading}>
            <FontAwesomeIcon icon={faPlay} /> Start test
          </button>
        </section>

        <div className="pyqv-result-head">
          <div><span>Question bank</span><b>{loading ? 'Loading paper…' : `${results.length.toLocaleString('en-IN')} questions`}</b></div>
          {activeYear === 'all' && loading && <span className="pyqv-loading-note">Loading all 31 years</span>}
        </div>

        {error ? (
          <div className="pyqv-empty"><FontAwesomeIcon icon={faBookOpen} /><b>Library unavailable</b><p>{error}</p></div>
        ) : !loading && !results.length ? (
          <div className="pyqv-empty"><FontAwesomeIcon icon={faMagnifyingGlass} /><b>No questions match</b><p>Try a wider year, subject or search term.</p><button onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <div className={`pyqv-list ${loading && !results.length ? 'loading' : ''}`}>
            {loading && !results.length
              ? Array.from({ length: 5 }, (_, index) => <div className="pyqv-skeleton" key={index} />)
              : results.slice(0, visibleCount).map((question) => {
                  const bookmarked = questionBookmarks.includes(pyqQuestionId(question))
                  const answered = Boolean(stats.a[pyqQuestionId(question)])
                  const currentLinks = currentLinksByQuestion.get(question.id) ?? []
                  return (
                    <article
                      className="pyqv-card"
                      key={question.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(question, 'question')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openDetail(question, 'question')
                        }
                      }}
                    >
                      <div className="pyqv-card-meta">
                        <span>{question.year} · Q{question.qno}</span>
                        <span>{question.subject}</span>
                        <span>{getPyqSubtopic(question)}</span>
                        <i className={question.difficulty}>{question.difficulty}</i>
                        {answered && <i className="attempted"><FontAwesomeIcon icon={faCheck} /> attempted</i>}
                        <button
                          className={bookmarked ? 'active' : ''}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleQbm(pyqQuestionId(question), showToast)
                          }}
                          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
                        >
                          <FontAwesomeIcon icon={bookmarked ? faBookmarkSolid : faBookmarkRegular} />
                        </button>
                      </div>
                      <QuestionStem text={question.stem} compact />
                      {currentLinks.length > 0 && (
                        <details className="question-link-signal current" onClick={event => event.stopPropagation()}>
                          <summary><span>Seen in recent news</span><b>{currentLinks.length === 1 ? new Date(`${currentLinks[0].article.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `${currentLinks.length} close news links`}</b><FontAwesomeIcon icon={faChevronDown} /></summary>
                          <div>{currentLinks.map(({ article, reason }) => <p key={article.id}><span>{article.date} · {article.category}</span><b>{article.headline}</b><i>{reason}</i></p>)}</div>
                        </details>
                      )}
                      <div className="pyqv-card-actions">
                        <button onClick={(event) => { event.stopPropagation(); openDetail(question, 'question') }}><FontAwesomeIcon icon={faBookOpen} /> View question</button>
                        <button onClick={(event) => { event.stopPropagation(); openDetail(question, 'solution') }}>See answer <FontAwesomeIcon icon={faChevronRight} /></button>
                      </div>
                    </article>
                  )
                })}
          </div>
        )}

        {visibleCount < results.length && (
          <button className="pyqv-load-more" onClick={() => setVisibleCount((count) => count + 24)}>
            Show 24 more <span>{results.length - visibleCount} remaining</span>
          </button>
        )}
        </>
        )}
      </main>

      {selected && (
        <div className="pyqv-detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="pyqv-detail" onClick={(event) => event.stopPropagation()}>
            <div className="pyqv-detail-head">
              <div><span>UPSC Prelims {selected.year} · Question {selected.qno} · {detailMode === 'question' ? 'Question' : 'Answer'}</span><b>{selected.subject} · {getPyqSubtopic(selected)}</b></div>
              <button onClick={() => setSelected(null)} aria-label="Close solution"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
            <div className="pyqv-detail-scroll">
              <QuestionStem text={selected.stem} />
              <div className="pyqv-detail-options">
                {selected.options?.map((option, index) => (
                  <div key={index} className={detailMode === 'solution' && index === selected.answer ? 'correct' : ''}>
                    <span>{String.fromCharCode(65 + index)}</span><p>{option}</p>{detailMode === 'solution' && index === selected.answer && <FontAwesomeIcon icon={faCheck} />}
                  </div>
                ))}
              </div>
              {detailMode === 'solution' && <PyqSolutionView solution={selected.solution} answerLabel={answerLabel(selected)} />}
              {selectedCurrentLinks.length > 0 && (
                <section className="question-connection current-link">
                  <div className="question-connection-head"><span>Seen in recent news</span><p>These links are visible before the solution because they are revision context, not another test.</p></div>
                  {selectedCurrentLinks.map(({ article, question, reason }) => (
                    <details key={article.id}>
                      <summary><span>{article.date} · {article.category}</span><b>{article.headline}</b><i>{reason}</i></summary>
                      <div><p>{question.q}</p>{detailMode === 'solution' && <><b>Current MCQ answer: {String.fromCharCode(65 + question.answer)}</b><em>{question.explanation}</em></>}</div>
                    </details>
                  ))}
                </section>
              )}
            </div>
            {detailMode === 'question' && (
              <div className="pyqv-detail-actions">
                <button onClick={() => setDetailMode('solution')}><FontAwesomeIcon icon={faBookOpen} /> See solution</button>
                <button onClick={() => startPractice([selected], 1)}><FontAwesomeIcon icon={faPlay} /> Practise question</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {toast && <div className="pyqv-toast">{toast}</div>}
    </div>
  )
}
