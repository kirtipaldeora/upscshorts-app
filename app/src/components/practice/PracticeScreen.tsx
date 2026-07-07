import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay,
  faDumbbell,
  faScroll,
  faEarthAsia,
  faPenNib,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
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
import { TODAY, fmtFull } from '@/constants/categories'

interface PracticeScreenProps {
  onShowToast: (msg: string) => void
  onOpenMapsArcade: () => void
  onOpenPYQ: () => void
  onOpenMains: () => void
}

type ActiveQuiz = { title: string; questions: Question[] } | null

export function PracticeScreen({ onShowToast, onOpenMapsArcade, onOpenPYQ, onOpenMains }: PracticeScreenProps) {
  const { articlesByDate, selectedDate, setScreen } = useAppStore()
  const { stats, settings, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const { bookmarkedIds } = useBookmarkStore()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)

  // Load PYQ data once
  useEffect(() => {
    if (!pyqReady) {
      fetch('/data/pyq-data.json')
        .then(r => r.json())
        .then(d => setPyqData(d))
        .catch(() => {})
    }
  }, [pyqReady, setPyqData])

  const allArticles = Object.values(articlesByDate).flat()
  const todayArticles = (articlesByDate[selectedDate] ?? []).filter(a => (a.prelimsQs ?? []).length > 0)
  const pool = allQs(allArticles, pyqData)
  const subs = subjectCounts(pool)
  const todayDay = stats.d[TODAY] ?? { n: 0, c: 0 }
  const pct = Math.min(100, Math.round(todayDay.n / settings.target * 100))
  const bmQs = bookmarkPracticeSet(allArticles, bookmarkedIds, usePracticeStore.getState().questionBookmarks, pyqData)
  const mainsLeft = 5 - (usePracticeStore.getState().mainsQuota[TODAY] ?? 0)

  function startQuiz(title: string, qs: Question[]) {
    if (!qs.length) { onShowToast('No questions here yet'); return }
    setActiveQuiz({ title, questions: qs })
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
      <div className="screen-body" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>

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

        {/* Practice cards */}
        <div className="pn-sec">Practice</div>

        <div className="pyq-card" onClick={() => startQuiz('Daily Practice', dailySet(allArticles, pyqData, settings.target, TODAY))}>
          <div className="pc-icon" style={{ color: '#B8860B' }}>🎯</div>
          <div className="pc-info">
            <h3>Daily Practice</h3>
            <p>{settings.target} fresh questions for {fmtFull(TODAY)} — build your streak.</p>
          </div>
          <div className="pc-go"><FontAwesomeIcon icon={faPlay} /></div>
        </div>

        <div className="pyq-card" onClick={onOpenMains}>
          <div className="pc-icon" style={{ color: '#6C71C4' }}>✍️</div>
          <div className="pc-info">
            <h3>Mains Answer Writing</h3>
            <p>Upload handwritten answers — AI evaluates &amp; annotates.</p>
          </div>
          <div className="pc-go" style={{ background: mainsLeft > 0 ? 'var(--yellow)' : 'var(--panel2)', color: mainsLeft > 0 ? 'var(--yellow-ink)' : 'var(--on3)' }}>
            {mainsLeft}
          </div>
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

        {/* Article-wise */}
        <div className="pn-sec">
          Article-wise <span>({fmtFull(selectedDate)})</span>
        </div>

        {todayArticles.length > 0 ? (
          <div>
            {todayArticles.map(a => (
              <div
                key={a.id}
                className="pn-row"
                onClick={() => startQuiz(a.category, articleQs(allArticles).filter(q => q.aid === a.id))}
              >
                <div className="pn-dot" style={{ background: CATEGORY_COLORS[a.category] }} />
                <div className="pn-row-t">{a.headline}</div>
                <span className="pn-row-n">{(a.prelimsQs ?? []).length} Qs</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pn-empty">No article questions for this date.</p>
        )}

        {/* Subject-wise */}
        <div className="pn-sec">Subject-wise</div>
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

        {/* More */}
        <div className="pn-sec">More</div>
        <div className="quick-row">
          <div className="quick-tile" onClick={onOpenPYQ}>
            <div className="qt-ic" style={{ color: '#6C71C4' }}>
              <FontAwesomeIcon icon={faScroll} />
            </div>
            <h4>PYQ Vault</h4>
            <span>Previous year papers</span>
          </div>
          <div className="quick-tile" onClick={onOpenMapsArcade}>
            <div className="qt-ic" style={{ color: '#4CAF82' }}>
              <FontAwesomeIcon icon={faEarthAsia} />
            </div>
            <h4>Maps Arcade</h4>
            <span>Geography games</span>
          </div>
        </div>

      </div>
    </div>
  )
}
