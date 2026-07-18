import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookOpen,
  faCalendarDay,
  faChevronRight,
  faEarthAsia,
  faPenFancy,
  faPlay,
  faScroll,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useArticles } from '@/hooks/useArticles'
import { useAllArticles } from '@/hooks/useAllArticles'
import {
  articleQs,
  pyqPrelims,
  seededPick,
} from '@/utils/practiceUtils'
import type { Question } from '@/utils/practiceUtils'
import { QuizPlayer } from './QuizPlayer'
import { TODAY, YESTERDAY, fmtFull, fmtShort } from '@/constants/categories'
import { loadPyqYears, pyqToPracticeQuestion } from '@/utils/pyqData'

interface PracticeScreenProps {
  onShowToast: (msg: string) => void
  onOpenPYQ: () => void
  onOpenMains: () => void
}

type ActiveQuiz = {
  title: string
  questions: Question[]
  eyebrow?: string
  description?: string
} | null

type Panel = null | 'previous' | 'mistakes'

export function PracticeScreen({ onShowToast, onOpenPYQ, onOpenMains }: PracticeScreenProps) {
  const { articlesByDate, selectedDate, setScreen, goBack } = useAppStore()
  const { stats, settings, pyqData } = usePracticeStore()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [pyqMistakesLoading, setPyqMistakesLoading] = useState(false)
  const [loadedPyqMistakes, setLoadedPyqMistakes] = useState<Question[]>([])
  useArticles(selectedDate)
  useAllArticles()

  const availableDates = Object.keys(articlesByDate)
    .filter(d => (articlesByDate[d] ?? []).some(a => (a.prelimsQs ?? []).length > 0))
    .sort((a, b) => (a > b ? -1 : 1))

  const allArticles = useMemo(() => Object.values(articlesByDate).flat(), [articlesByDate])
  const allArticleQuestions = useMemo(() => articleQs(allArticles), [allArticles])
  const currentMistakes = useMemo(
    () => allArticleQuestions.filter(question => stats.a[question.id]?.[0] === 0),
    [allArticleQuestions, stats.a],
  )
  const pyqMistakeCount = Object.entries(stats.a).filter(([id, answer]) => id.startsWith('pyq-') && answer[0] === 0).length
  const storedPyqMistakes = useMemo(
    () => pyqPrelims(pyqData).filter(question => stats.a[question.id]?.[0] === 0),
    [pyqData, stats.a],
  )
  const pyqMistakes = useMemo(() => {
    const activeMistakes = new Map<string, Question>()
    for (const question of [...storedPyqMistakes, ...loadedPyqMistakes]) {
      // Loaded papers remain cached, but the latest recorded answer always
      // decides whether a question is still offered by the notebook.
      if (stats.a[question.id]?.[0] === 0) activeMistakes.set(question.id, question)
    }
    return [...activeMistakes.values()]
  }, [loadedPyqMistakes, stats.a, storedPyqMistakes])
  const pyqMistakeYears = useMemo(() => [...new Set(Object.entries(stats.a)
    .filter(([id, answer]) => id.startsWith('pyq-') && answer[0] === 0)
    .map(([id]) => Number(id.match(/prelims-(\d{4})-/)?.[1]))
    .filter(year => Number.isFinite(year)))], [stats.a])
  const mainsLeft = 5 - (usePracticeStore.getState().mainsQuota[TODAY] ?? 0)

  const activePackDate = articlesByDate[TODAY]?.length ? TODAY : (availableDates[0] ?? selectedDate)
  const todayArticles = articlesByDate[activePackDate] ?? []
  const todayArticleIds = new Set(todayArticles.map(article => article.id))
  const todayQuestions = allArticleQuestions.filter(q => todayArticleIds.has(q.aid ?? ''))
  const activePackIsToday = activePackDate === TODAY
  const activePackTitle = activePackIsToday ? "Today's Current Affairs" : 'Latest Current Affairs Pack'
  const activePackMeta = activePackIsToday ? "Today's newspaper pack" : `${fmtFull(activePackDate)} newspaper pack`
  const dailyTestQuestions = seededPick(
    todayQuestions,
    Math.min(settings.target, todayQuestions.length),
    `daily-current-${activePackDate}`,
  )
  const dailyAttempted = dailyTestQuestions.filter(q => stats.a[q.id]).length
  const dailySubjects = Array.from(new Set(dailyTestQuestions.map(q => q.subject).filter(Boolean)))
  const estimatedMinutes = Math.max(1, Math.ceil(dailyTestQuestions.length * 1.2))

  useEffect(() => {
    if (panel !== 'mistakes' || !pyqMistakeCount || pyqMistakes.length >= pyqMistakeCount || !pyqMistakeYears.length) return
    let cancelled = false
    setPyqMistakesLoading(true)
    void loadPyqYears(pyqMistakeYears)
      .then(items => {
        if (cancelled || !items.length) return
        setLoadedPyqMistakes(items.map(pyqToPracticeQuestion).filter(question => stats.a[question.id]?.[0] === 0))
      })
      .catch(() => { if (!cancelled) onShowToast('Could not load PYQ mistakes. Please try again.') })
      .finally(() => { if (!cancelled) setPyqMistakesLoading(false) })
    return () => { cancelled = true }
  }, [onShowToast, panel, pyqMistakeCount, pyqMistakeYears, pyqMistakes.length, stats.a])

  function startQuiz(title: string, qs: Question[], description?: string, eyebrow?: string) {
    if (!qs.length) { onShowToast('No questions here yet'); return }
    setPanel(null)
    setActiveQuiz({ title, questions: qs, description, eyebrow })
  }

  function questionsForDate(date: string) {
    const articleIds = new Set((articlesByDate[date] ?? []).map(a => a.id))
    const datedQuestions = allArticleQuestions.filter(q => articleIds.has(q.aid ?? ''))
    return seededPick(datedQuestions, Math.min(settings.target, datedQuestions.length), `daily-current-${date}`)
  }

  function dateLabel(date: string) {
    return date === TODAY ? 'Today' : date === YESTERDAY ? 'Yesterday' : fmtShort(date)
  }

  function startDailyCurrent() {
    startQuiz(
      activePackIsToday ? 'Daily Current Affairs Test' : `${dateLabel(activePackDate)} Current Affairs Test`,
      dailyTestQuestions,
      'A dated UPSC-style test based only on this current-affairs pack.',
      fmtFull(activePackDate),
    )
  }

  if (activeQuiz) {
    return (
      <QuizPlayer
        title={activeQuiz.title}
        questions={activeQuiz.questions}
        eyebrow={activeQuiz.eyebrow}
        description={activeQuiz.description}
        onClose={() => setActiveQuiz(null)}
        onShowToast={onShowToast}
      />
    )
  }

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      <div className="screen-header">
        <button onClick={() => goBack('feed')} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Practice</h2>
      </div>

      <div className="screen-body practice-body practice-journey" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        <section className="daily-test-card">
          <div className="daily-test-head">
            <div>
              <span className="daily-test-kicker">{activePackTitle}</span>
              <h3>Daily Current Affairs Test</h3>
              <p>{activePackMeta}</p>
            </div>
            <span className="daily-test-status">{dailyAttempted ? `${dailyAttempted}/${dailyTestQuestions.length} practised` : 'New'}</span>
          </div>

          <div className="daily-test-facts">
            <div><b>{dailyTestQuestions.length}</b><span>questions</span></div>
            <div><b>{estimatedMinutes} min</b><span>estimated</span></div>
            <div><b>+2 / −0.66</b><span>marking</span></div>
          </div>

          <div className="daily-test-coverage">
            <span>GS coverage</span>
            <p>{dailySubjects.length ? dailySubjects.slice(0, 4).join(' · ') : 'Questions are being prepared'}</p>
          </div>

          <button className="daily-test-cta" onClick={startDailyCurrent} disabled={!dailyTestQuestions.length}>
            <FontAwesomeIcon icon={faPlay} />
            {dailyAttempted >= dailyTestQuestions.length && dailyTestQuestions.length
              ? 'Retake test'
              : 'View test instructions'}
          </button>
        </section>

        <section className="practice-library">
          <div className="practice-section-head">
            <span>Test library</span>
            <h3>Choose an assessed practice format</h3>
          </div>

          <div className="practice-library-grid">
            <button onClick={() => { setPanel(null); onOpenPYQ() }}>
              <FontAwesomeIcon icon={faScroll} />
              <span><b>Previous Year Questions</b><i>Official UPSC questions with solutions</i></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => { localStorage.setItem('penni.ca-vault.mode', 'questions'); setScreen('revise') }}>
              <FontAwesomeIcon icon={faBookOpen} />
              <span><b>Current Affairs Topic Tests</b><i>Build a focused test by year, subject and sub-topic</i></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => setPanel('previous')}>
              <FontAwesomeIcon icon={faCalendarDay} />
              <span><b>Previous Daily Tests</b><i>{availableDates.length} dated current-affairs packs</i></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => setPanel('mistakes')}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span><b>Mistakes Notebook</b><i>{currentMistakes.length + pyqMistakeCount
                ? `${currentMistakes.length + pyqMistakeCount} ${currentMistakes.length + pyqMistakeCount === 1 ? 'question' : 'questions'} to strengthen`
                : 'Incorrect answers will collect here'}</i></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => setScreen('maps')}>
              <FontAwesomeIcon icon={faEarthAsia} />
              <span><b>Maps Practice</b><i>India and world map drills</i></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </section>

        <section className="mains-practice-row">
          <FontAwesomeIcon icon={faPenFancy} />
          <span><b>Mains Answer Writing</b><i>{mainsLeft > 0 ? `${mainsLeft} evaluations available today` : 'Daily evaluation limit used'}</i></span>
          <button onClick={() => { setPanel(null); onOpenMains() }}>Open</button>
        </section>

      </div>

      {panel && (
        <div className="practice-panel" onClick={() => setPanel(null)}>
          <div className="practice-panel-sheet" onClick={event => event.stopPropagation()}>
            <div className="panel-head">
              <h3>
                {panel === 'previous' && 'Previous Daily Tests'}
                {panel === 'mistakes' && 'Mistakes Notebook'}
              </h3>
              <button onClick={() => setPanel(null)} aria-label="Close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {panel === 'previous' && (
              <div className="panel-list">
                {availableDates.map(date => {
                  const qs = questionsForDate(date)
                  return (
                    <button
                      key={date}
                      onClick={() => startQuiz(
                        `${dateLabel(date)} Current Affairs Test`,
                        qs,
                        'A dated test based only on this current-affairs pack.',
                        fmtFull(date),
                      )}
                    >
                      <FontAwesomeIcon icon={faBookOpen} />
                      <span><b>{dateLabel(date)}</b><em>{fmtFull(date)}</em></span>
                      <strong>{qs.length} Q</strong>
                    </button>
                  )
                })}
              </div>
            )}

            {panel === 'mistakes' && (
              <div className="mistakes-practice-panel">
                <p>Your latest answer decides the notebook. Once you answer a mistake correctly, it leaves this list automatically.</p>
                <div className="mistakes-practice-sets">
                  <section>
                    <span>Current Affairs</span>
                    <b>{currentMistakes.length}</b>
                    <small>Incorrect newspaper-based MCQs</small>
                    <button
                      disabled={!currentMistakes.length}
                      onClick={() => startQuiz('Current Affairs Mistakes', seededPick(currentMistakes, Math.min(10, currentMistakes.length), `current-mistakes-${TODAY}`), 'A focused set of your latest incorrect current-affairs answers.', 'Mistakes Notebook')}
                    ><FontAwesomeIcon icon={faPlay} />{currentMistakes.length ? `Practise ${Math.min(10, currentMistakes.length)}` : 'No mistakes yet'}</button>
                  </section>
                  <section>
                    <span>Previous Year Questions</span>
                    <b>{pyqMistakeCount}</b>
                    <small>Incorrect official UPSC PYQs</small>
                    <button
                      disabled={!pyqMistakeCount || pyqMistakesLoading || pyqMistakes.length === 0}
                      onClick={() => startQuiz('PYQ Mistakes', seededPick(pyqMistakes, Math.min(10, pyqMistakes.length), `pyq-mistakes-${TODAY}`), 'A focused set of your latest incorrect Previous Year Questions.', 'Mistakes Notebook')}
                    ><FontAwesomeIcon icon={faPlay} />{pyqMistakesLoading ? 'Loading PYQs…' : pyqMistakeCount ? `Practise ${Math.min(10, pyqMistakeCount)}` : 'No mistakes yet'}</button>
                  </section>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
