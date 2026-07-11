import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark,
  faBookOpen,
  faChartLine,
  faChevronRight,
  faDice,
  faDumbbell,
  faFlagCheckered,
  faLayerGroup,
  faMagnifyingGlass,
  faPenFancy,
  faPlay,
  faRotateLeft,
  faScroll,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import { PenniLoader } from '@/components/layout/PenniLoader'
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
import { asset } from '@/utils/asset'

interface PracticeScreenProps {
  onShowToast: (msg: string) => void
  onOpenPYQ: () => void
  onOpenMains: () => void
}

type ActiveQuiz = { title: string; questions: Question[] } | null
type Panel = null | 'library' | 'random' | 'articles' | 'previous' | 'subjects'

const TEST_SIZES = [10, 20, 30]
const GS_GROUPS = [
  { name: 'GS I', subjects: ['History', 'Geography', 'Society', 'Art & Culture', 'Social Issues'] },
  { name: 'GS II', subjects: ['Polity', 'Governance', 'International Relations', 'Social Justice'] },
  { name: 'GS III', subjects: ['Economy', 'Environment', 'Agriculture', 'Science and Tech', 'Internal Security', 'Security', 'Disaster Management'] },
  { name: 'GS IV', subjects: ['Ethics'] },
  { name: 'Optional', subjects: ['Anthropology', 'Schemes', 'Reports and Indices'] },
]

export function PracticeScreen({ onShowToast, onOpenPYQ, onOpenMains }: PracticeScreenProps) {
  const { articlesByDate, selectedDate, setScreen } = useAppStore()
  const { stats, settings, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const { bookmarkedIds } = useBookmarkStore()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [expandedGroup, setExpandedGroup] = useState('GS III')
  const { loading } = useArticles(selectedDate)
  useAllArticles()

  useEffect(() => {
    if (!pyqReady) {
      fetch(asset('data/pyq-data.json'))
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
  const todayDay = stats.d[TODAY] ?? { n: 0, c: 0 }
  const pct = Math.min(100, Math.round((todayDay.n / Math.max(settings.target, 1)) * 100))
  const remaining = Math.max(settings.target - todayDay.n, 0)
  const correctAnswers = Object.values(stats.a).filter(([correct]) => correct === 1).length
  const xp = correctAnswers * 10 + Object.keys(stats.d).length * 15 + stats.badges.length * 30
  const level = Math.max(1, Math.floor(xp / 250) + 1)
  const nextLevelXp = level * 250
  const goalLabel = settings.target <= 10 ? 'Relaxed goal' : settings.target <= 20 ? 'Focused goal' : 'Intensive goal'
  const dailyBaseQuestions = dailySet(allArticles, pyqData, settings.target, TODAY)
  const dailyBaseIds = new Set(dailyBaseQuestions.map(q => q.id))
  const dailyQuestions = dailyBaseQuestions.filter(q => !stats.a[q.id])
  const dailyTopUpQuestions = seededPick(
    pool.filter(q => !stats.a[q.id] && !dailyBaseIds.has(q.id)),
    Math.max(remaining - dailyQuestions.length, 0),
    `penni-topup-${TODAY}`,
  )
  const missionQuestions = remaining > 0
    ? dailyQuestions.concat(dailyTopUpQuestions).slice(0, remaining)
    : dailyBaseQuestions.filter(q => stats.a[q.id])
  const pyqQuestions = pool.filter(q => q.src === 'pyq')
  const mistakes = pool.filter(q => stats.a[q.id]?.[0] === 0)
  const bmQs = bookmarkPracticeSet(allArticles, bookmarkedIds, usePracticeStore.getState().questionBookmarks, pyqData)
  const mainsLeft = 5 - (usePracticeStore.getState().mainsQuota[TODAY] ?? 0)

  const activePackDate = articlesByDate[TODAY]?.length ? TODAY : (availableDates[0] ?? selectedDate)
  const todayArticles = articlesByDate[activePackDate] ?? []
  const todayQuestions = allArticleQuestions.filter(q => todayArticles.some(a => a.id === q.aid))
  const activePackIsToday = activePackDate === TODAY
  const activePackTitle = activePackIsToday ? "Today's Current Affairs" : 'Latest Current Affairs Pack'
  const activePackMeta = activePackIsToday ? "Today's newspaper pack" : `${fmtFull(activePackDate)} newspaper pack`

  const weakSubjects = Object.entries(subs)
    .map(([subject, total]) => {
      const wrong = pool.filter(q => q.subject === subject && stats.a[q.id]?.[0] === 0).length
      return { subject, total, wrong }
    })
    .filter(s => s.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)

  function startQuiz(title: string, qs: Question[]) {
    if (!qs.length) { onShowToast('No questions here yet'); return }
    setPanel(null)
    setActiveQuiz({ title, questions: qs })
  }

  function startRandom(n: number) {
    const qs = seededPick(pool, Math.min(n, pool.length), `rand-${Date.now()}`)
    startQuiz(`Random Test · ${qs.length} Q`, qs)
  }

  function questionsForDate(date: string) {
    const articleIds = new Set((articlesByDate[date] ?? []).map(a => a.id))
    return allArticleQuestions.filter(q => articleIds.has(q.aid ?? ''))
  }

  function dateLabel(d: string) {
    return d === TODAY ? 'Today' : d === YESTERDAY ? 'Yesterday' : fmtShort(d)
  }

  function subjectProgress(subject: string) {
    const attempted = pool.filter(q => q.subject === subject && stats.a[q.id]).length
    return Math.min(100, Math.round((attempted / Math.max(subs[subject] ?? 1, 1)) * 100))
  }

  function subjectAccuracy(subject: string) {
    const attempted = pool.filter(q => q.subject === subject && stats.a[q.id])
    if (!attempted.length) return 0
    const correct = attempted.filter(q => stats.a[q.id]?.[0] === 1).length
    return Math.round((correct / attempted.length) * 100)
  }

  function groupSubjects(group: string[]) {
    const known = group.filter(subject => subs[subject])
    if (group.includes('Reports and Indices')) {
      return known.concat(Object.keys(subs).filter(subject => !GS_GROUPS.some(g => g.subjects.includes(subject))))
    }
    return known
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
      <div className="screen-header">
        <button onClick={() => setScreen('feed')} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Practice</h2>
      </div>

      <div className="screen-body practice-body practice-journey" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        <section className="mission-hero">
          <div className="mission-copy">
            <span className="mission-kicker">Today&apos;s Mission · {goalLabel}</span>
            <h3>{todayDay.n} / {settings.target} questions</h3>
            <p>{remaining > 0 ? `${remaining} questions remaining. Penni has prepared the next set for you.` : 'Mission complete. Excellent consistency today.'}</p>
          </div>

          <div className="mission-ring" style={{ '--p': `${pct}%` } as CSSProperties}>
            <b>{pct}</b>
            <span>%</span>
          </div>

          <div className="mission-stats">
            <div><b>{stats.streak.count}</b><span>day streak</span></div>
            <div><b>+{xp}</b><span>XP · Level {level}</span></div>
            <div><b>{nextLevelXp}</b><span>next level</span></div>
          </div>

          <button className="mission-cta" onClick={() => startQuiz(remaining > 0 ? 'Daily Practice' : 'Mission Review', missionQuestions)}>
            <FontAwesomeIcon icon={faPlay} />
            {remaining > 0 ? (todayDay.n > 0 ? 'Continue Practice' : 'Start Practice') : 'Review Mission'}
          </button>
        </section>

        <section className="today-pack-card">
          <div>
            <span>{activePackTitle}</span>
            <h3>{todayArticles.length} articles · {todayQuestions.length} questions</h3>
            <p>{fmtFull(activePackDate)} · {Math.min(todayDay.n, todayArticles.length)} read · {activePackMeta}</p>
          </div>
          <button onClick={() => setPanel('articles')}>Continue</button>
        </section>

        <section>
          <div className="journey-title"><span>Revision</span></div>
          <div className="review-grid">
            <button onClick={() => startQuiz('Review Mistakes', mistakes)}>
              <FontAwesomeIcon icon={faRotateLeft} />
              <b>{mistakes.length}</b>
              <span>mistakes</span>
            </button>
            <button onClick={() => startQuiz('Bookmarked Questions', bmQs)}>
              <FontAwesomeIcon icon={faBookmark} />
              <b>{bmQs.length}</b>
              <span>bookmarks</span>
            </button>
            <button onClick={() => weakSubjects[0] ? startQuiz(`Weak Subject · ${weakSubjects[0].subject}`, pool.filter(q => q.subject === weakSubjects[0].subject && stats.a[q.id]?.[0] === 0)) : onShowToast('No weak subjects yet')}>
              <FontAwesomeIcon icon={faChartLine} />
              <b>{weakSubjects[0]?.subject ?? 'Clear'}</b>
              <span>{weakSubjects[0] ? `${weakSubjects[0].wrong} weak` : 'weak areas'}</span>
            </button>
            <button onClick={() => startQuiz('Recently Revised', seededPick(pool.filter(q => stats.a[q.id]), Math.min(10, Object.keys(stats.a).length), `recent-${TODAY}`))}>
              <FontAwesomeIcon icon={faBookOpen} />
              <b>{Object.keys(stats.a).length}</b>
              <span>recently revised</span>
            </button>
          </div>
        </section>

        <section className="practice-library-card">
          <div>
            <span>Practice Library</span>
            <h3>Explore subjects, PYQs, mock tests and older packs</h3>
            <p>Use this when you want to choose manually. Daily learning stays guided.</p>
          </div>
          <button onClick={() => setPanel('library')}>
            Open Library
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </section>

        {loading && <div className="pn-empty"><PenniLoader label="Loading questions" /></div>}
      </div>

      {panel && (
        <div className="practice-panel" onClick={() => setPanel(null)}>
          <div className="practice-panel-sheet" onClick={e => e.stopPropagation()}>
            <div className="panel-head">
              <h3>
                {panel === 'random' && 'Random Test'}
                {panel === 'articles' && "Today's Articles"}
                {panel === 'previous' && 'Previous Days'}
                {panel === 'subjects' && 'All Subjects'}
                {panel === 'library' && 'Practice Library'}
              </h3>
              <button onClick={() => setPanel(null)} aria-label="Close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {panel === 'library' && (
              <div className="library-grid">
                <button onClick={() => setPanel('subjects')}>
                  <FontAwesomeIcon icon={faLayerGroup} />
                  <span><b>Subjects</b><i>GS-wise practice map</i></span>
                </button>
                <button onClick={() => { setPanel(null); onOpenPYQ() }}>
                  <FontAwesomeIcon icon={faScroll} />
                  <span><b>Previous Year Questions</b><i>{pyqQuestions.length} prelims questions</i></span>
                </button>
                <button onClick={() => setPanel('random')}>
                  <FontAwesomeIcon icon={faDice} />
                  <span><b>Mock Tests</b><i>Choose 10, 20, 30 or full bank</i></span>
                </button>
                <button onClick={() => setPanel('previous')}>
                  <FontAwesomeIcon icon={faBookOpen} />
                  <span><b>Previous Current Affairs Packs</b><i>{availableDates.length} dated packs</i></span>
                </button>
                <button onClick={() => startRandom(pool.length)}>
                  <FontAwesomeIcon icon={faFlagCheckered} />
                  <span><b>Custom Practice</b><i>Full mixed question bank</i></span>
                </button>
                <button onClick={() => { setPanel(null); setScreen('search') }}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                  <span><b>Search Topics</b><i>Find articles and concepts</i></span>
                </button>
                <button onClick={() => { setPanel(null); onOpenMains() }}>
                  <FontAwesomeIcon icon={faPenFancy} />
                  <span><b>Mains Practice</b><i>{mainsLeft > 0 ? `${mainsLeft} evaluations left today` : 'Daily limit used'}</i></span>
                </button>
              </div>
            )}

            {panel === 'random' && (
              <div className="panel-options">
                {TEST_SIZES.map(n => (
                  <button key={n} onClick={() => startRandom(n)} disabled={pool.length === 0}>
                    <FontAwesomeIcon icon={faDumbbell} />
                    <span><b>{n} questions</b><i>Quick mixed test</i></span>
                  </button>
                ))}
                <button onClick={() => startRandom(pool.length)} disabled={pool.length === 0}>
                  <FontAwesomeIcon icon={faFlagCheckered} />
                  <span><b>All {pool.length}</b><i>Full question bank</i></span>
                </button>
              </div>
            )}

            {panel === 'articles' && (
              <div className="panel-list">
                {todayArticles.map(article => {
                  const qs = allArticleQuestions.filter(q => q.aid === article.id)
                  return (
                    <button key={article.id} onClick={() => startQuiz(article.category, qs)}>
                      <i style={{ background: CATEGORY_COLORS[article.category] }} />
                      <span><b>{article.headline}</b><em>{article.category}</em></span>
                      <strong>{qs.length} Q</strong>
                    </button>
                  )
                })}
              </div>
            )}

            {panel === 'previous' && (
              <div className="panel-list">
                {availableDates.map(date => {
                  const qs = questionsForDate(date)
                  return (
                    <button key={date} onClick={() => startQuiz(`${dateLabel(date)} Drills`, qs)}>
                      <FontAwesomeIcon icon={faBookOpen} />
                      <span><b>{dateLabel(date)}</b><em>{fmtFull(date)}</em></span>
                      <strong>{qs.length} Q</strong>
                    </button>
                  )
                })}
              </div>
            )}

            {panel === 'subjects' && (
              <div className="gs-accordion">
                {GS_GROUPS.map(group => {
                  const subjects = groupSubjects(group.subjects)
                  if (!subjects.length) return null
                  const open = expandedGroup === group.name
                  return (
                    <div className={`gs-group ${open ? 'open' : ''}`} key={group.name}>
                      <button className="gs-group-head" onClick={() => setExpandedGroup(open ? '' : group.name)}>
                        <span><b>{group.name}</b><i>{subjects.length} subjects</i></span>
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                      {open && (
                        <div className="gs-subjects">
                          {subjects.map(subject => {
                            const solved = pool.filter(q => q.subject === subject && stats.a[q.id]).length
                            const accuracy = subjectAccuracy(subject)
                            return (
                              <button key={subject} onClick={() => startQuiz(subject, seededPick(pool.filter(q => q.subject === subject), 10, `sub-${subject}-${Date.now()}`))}>
                                <i style={{ background: CATEGORY_COLORS[subject as keyof typeof CATEGORY_COLORS] ?? 'var(--acc)' }} />
                                <span>
                                  <b>{subject}</b>
                                  <em>{solved} solved · {accuracy || 0}% accuracy · revision due</em>
                                  <small><strong style={{ width: `${subjectProgress(subject)}%` }} /></small>
                                </span>
                                <strong>{subs[subject]} Q</strong>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
