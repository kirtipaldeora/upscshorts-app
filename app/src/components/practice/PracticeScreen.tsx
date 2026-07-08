import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay,
  faScroll,
  faArrowLeft,
  faDice,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import {
  articleQs,
  allQs,
  dailySet,
  bookmarkPracticeSet,
  subjectCounts,
  seededPick,
} from '@/utils/practiceUtils'
import type { Question } from '@/utils/practiceUtils'
import { QuizPlayer } from './QuizPlayer'
import { CATEGORY_COLORS } from '@/constants/categories'
import { TODAY, YESTERDAY, fmtFull, fmtShort } from '@/constants/categories'

interface PracticeScreenProps {
  onShowToast: (msg: string) => void
  onOpenPYQ: () => void
  onOpenMains: () => void
}

type ActiveQuiz = { title: string; questions: Question[] } | null

const TEST_SIZES = [10, 20, 30]

export function PracticeScreen({ onShowToast, onOpenPYQ, onOpenMains }: PracticeScreenProps) {
  const { articlesByDate, selectedDate, setScreen } = useAppStore()
  const { stats, settings, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const { bookmarkedIds } = useBookmarkStore()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [drillDate, setDrillDate] = useState('')
  const { loading } = useArticles(selectedDate)
  useAllArticles() // pull in every available day so all questions are practiceable

  // Load PYQ data once
  useEffect(() => {
    if (!pyqReady) {
      fetch('/data/pyq-data.json')
        .then(r => r.json())
        .then(d => setPyqData(d))
        .catch(() => {})
    }
  }, [pyqReady, setPyqData])

  const availableDates = Object.keys(articlesByDate)
    .filter(d => (articlesByDate[d] ?? []).some(a => (a.prelimsQs ?? []).length > 0))
    .sort((a, b) => (a > b ? -1 : 1))

  const allArticles = Object.values(articlesByDate).flat()
  const allArticleQuestions = articleQs(allArticles)
  const pool = allQs(allArticles, pyqData)
  const subs = subjectCounts(pool)

  // ─── Practice-by-day drills ───────────────────────────────────
  const activeDrillDate = (drillDate && articlesByDate[drillDate]?.length) ? drillDate : (availableDates[0] ?? selectedDate)
  const drillArticles = (articlesByDate[activeDrillDate] ?? []).filter(a => (a.prelimsQs ?? []).length > 0)
  const drillArticleIds = new Set(drillArticles.map(a => a.id))
  const drillQuestions = allArticleQuestions.filter(q => drillArticleIds.has(q.aid ?? ''))
  const drillCategoryCounts = drillArticles.reduce<Record<string, number>>((acc, article) => {
    acc[article.category] = (acc[article.category] ?? 0) + (article.prelimsQs ?? []).length
    return acc
  }, {})
  const dateQCount = (d: string) => (articlesByDate[d] ?? []).reduce((n, a) => n + (a.prelimsQs?.length ?? 0), 0)
  const dateLabel = (d: string) => (d === TODAY ? 'Today' : d === YESTERDAY ? 'Yesterday' : fmtShort(d))

  const todayDay = stats.d[TODAY] ?? { n: 0, c: 0 }
  const pct = Math.min(100, Math.round(todayDay.n / settings.target * 100))
  const bmQs = bookmarkPracticeSet(allArticles, bookmarkedIds, usePracticeStore.getState().questionBookmarks, pyqData)
  const mainsLeft = 5 - (usePracticeStore.getState().mainsQuota[TODAY] ?? 0)

  function startQuiz(title: string, qs: Question[]) {
    if (!qs.length) { onShowToast('No questions here yet'); return }
    setActiveQuiz({ title, questions: qs })
  }

  function startRandom(n: number) {
    const qs = seededPick(pool, Math.min(n, pool.length), `rand-${Date.now()}`)
    startQuiz(`Random Test · ${qs.length} Q`, qs)
  }

  if (activeQuiz) {
    return (
      <QuizPlayer
        title={activeQuiz.title}
        questions={activeQuiz.questions}
        onClose={() => setActiveQuiz(null)}
        onShowToast={onShowToast}
      />
    )
  }

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      {/* Header */}
      <div className="screen-header">
        <button onClick={() => setScreen('feed')} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Practice</h2>
      </div>

      {/* Body */}
      <div className="screen-body practice-body" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>

        {/* Hero — streak + target */}
        <div className="pn-hero">
          <div className="pn-streak">
            <span className="pn-fire">🔥</span>
            <div>
              <b>{stats.streak.count} day{stats.streak.count !== 1 ? 's' : ''}</b>
              <span>practice streak</span>
            </div>
          </div>
          <div className="pn-target">
            <div className="pn-target-top">
              <span>Today's target</span>
              <b>{todayDay.n} / {settings.target}</b>
            </div>
            <div className="pn-bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        {/* Test yourself */}
        <div className="pn-sec">Test yourself</div>

        <div className="pn-random">
          <div className="pn-random-top">
            <div className="pc-icon" style={{ color: '#6C71C4' }}><FontAwesomeIcon icon={faDice} /></div>
            <div className="pc-info">
              <h3>Random Test</h3>
              <p>{pool.length} questions from every day &amp; PYQs — shuffled fresh.</p>
            </div>
          </div>
          <div className="pn-testsizes">
            {TEST_SIZES.map(n => (
              <button key={n} onClick={() => startRandom(n)} disabled={pool.length === 0}>
                {n} <span>Q</span>
              </button>
            ))}
            <button className="all" onClick={() => startRandom(pool.length)} disabled={pool.length === 0}>
              All {pool.length}
            </button>
          </div>
        </div>

        <div className="pyq-card" onClick={() => startQuiz('Daily Practice', dailySet(allArticles, pyqData, settings.target, TODAY))}>
          <div className="pc-icon" style={{ color: '#B8860B' }}>🎯</div>
          <div className="pc-info">
            <h3>Daily Practice</h3>
            <p>{settings.target} fresh questions for {fmtFull(TODAY)} — build your streak.</p>
          </div>
          <div className="pc-go"><FontAwesomeIcon icon={faPlay} /></div>
        </div>

        {bmQs.length > 0 && (
          <div className="pyq-card" onClick={() => startQuiz('Bookmarked Practice', bmQs)}>
            <div className="pc-icon" style={{ color: '#4CAF82' }}>🔖</div>
            <div className="pc-info">
              <h3>Bookmarked Practice</h3>
              <p>{bmQs.length} questions from your saved articles &amp; bookmarks.</p>
            </div>
            <div className="pc-go"><FontAwesomeIcon icon={faPlay} /></div>
          </div>
        )}

        {/* Practice by day */}
        <div className="pn-sec">Practice by day</div>

        {availableDates.length > 0 ? (
          <>
            <div className="pn-datechips">
              {availableDates.map(d => (
                <button
                  key={d}
                  className={`pn-datechip ${d === activeDrillDate ? 'on' : ''}`}
                  onClick={() => setDrillDate(d)}
                >
                  <b>{dateLabel(d)}</b>
                  <span>{dateQCount(d)} Q</span>
                </button>
              ))}
            </div>

            <div className="article-drill-card">
              <div className="adc-top">
                <div>
                  <b>{drillQuestions.length} questions</b>
                  <span>{drillArticles.length} articles · {fmtFull(activeDrillDate)}</span>
                </div>
                <button onClick={() => startQuiz(`${dateLabel(activeDrillDate)} Drills`, drillQuestions)} aria-label="Start day drills">
                  <FontAwesomeIcon icon={faPlay} />
                </button>
              </div>

              <div className="adc-chips">
                {Object.entries(drillCategoryCounts).map(([category, count]) => (
                  <button
                    key={category}
                    onClick={() => startQuiz(category, drillQuestions.filter(q => q.subject === category))}
                    style={{ borderColor: `${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]}55` }}
                  >
                    {category}<span>{count}</span>
                  </button>
                ))}
              </div>

              <div className="adc-preview">
                {drillArticles.map(a => (
                  <button
                    key={a.id}
                    onClick={() => startQuiz(a.category, allArticleQuestions.filter(q => q.aid === a.id))}
                  >
                    <i style={{ background: CATEGORY_COLORS[a.category] }} />
                    <span>{a.headline}</span>
                    <b>{(a.prelimsQs ?? []).length}</b>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : loading ? (
          <p className="pn-empty">Loading questions…</p>
        ) : (
          <p className="pn-empty">No article questions yet.</p>
        )}

        {/* Subject-wise */}
        <div className="pn-sec">By subject</div>
        <div className="pn-subs">
          {Object.keys(subs).sort().map(s => (
            <button
              key={s}
              className="pn-sub"
              onClick={() => startQuiz(s, seededPick(pool.filter(q => q.subject === s), 10, `sub${Date.now()}`))}
            >
              {s}<span>{subs[s]}</span>
            </button>
          ))}
        </div>

        {/* Mains & more */}
        <div className="pn-sec">Mains &amp; more</div>
        <div className="pyq-card" onClick={onOpenMains}>
          <div className="pc-icon" style={{ color: '#6C71C4' }}>✍️</div>
          <div className="pc-info">
            <h3>Mains Answer Writing</h3>
            <p>Upload up to 5 handwritten answers a day — AI evaluates &amp; annotates.</p>
          </div>
          <div className="pc-go" style={{ background: mainsLeft > 0 ? 'var(--yellow)' : 'var(--panel2)', color: mainsLeft > 0 ? 'var(--yellow-ink)' : 'var(--on3)' }}>
            {mainsLeft}
          </div>
        </div>

        <div className="quick-row">
          <div className="quick-tile" onClick={onOpenPYQ}>
            <div className="qt-ic" style={{ color: '#6C71C4' }}>
              <FontAwesomeIcon icon={faScroll} />
            </div>
            <h4>PYQ Vault</h4>
            <span>Previous year papers</span>
          </div>
        </div>

      </div>
    </div>
  )
}
