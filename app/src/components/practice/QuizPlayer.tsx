import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faXmark,
  faCheck,
  faArrowRight,
  faChevronLeft,
  faBookmark as faBookmarkSolid,
  faClock,
  faBullseye,
  faChevronDown,
  faFlag,
  faListOl,
  faRotateLeft,
  faShieldHalved,
  faTriangleExclamation,
  faBookOpen,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkReg } from '@fortawesome/free-regular-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import type { PyqItem } from '@/stores/usePracticeStore'
import { useAppStore } from '@/stores/useAppStore'
import { pulseCorrect, shakeWrong } from '@/anim/animations'
import type { Question } from '@/utils/practiceUtils'
import { splitUPSCStem } from '@/utils/questionQuality'
import { PyqSolutionView } from '@/components/pyq-vault/PyqSolutionView'
import { relatedPyqs } from '@/utils/questionLinks'
import { loadPyqManifest, loadPyqYears } from '@/utils/pyqData'

interface QuizPlayerProps {
  title: string
  questions: Question[]
  eyebrow?: string
  description?: string
  onClose: () => void
  onShowToast: (msg: string) => void
}

function ReviewQuestionStem({ text }: { text: string }) {
  const structured = splitUPSCStem(text)
  if (!structured.statements.length) return <div className="qz-review-question">{text}</div>
  return (
    <div className="qz-review-question structured">
      {structured.lead && <p>{structured.lead}</p>}
      <ol className="upsc-statement-list">
        {structured.statements.map((statement, index) => (
          <li key={index}><span className="upsc-statement-label">{structured.statementLabels[index] ?? index + 1}</span><span className="upsc-statement-text">{statement}</span></li>
        ))}
      </ol>
      {structured.ask && <p>{structured.ask}</p>}
    </div>
  )
}

type AnsweredState = { picked: number; correct: boolean } | null
type TestAnswer = { picked: number | null; correct: boolean; skipped: boolean }
type FinishReason = 'submitted' | 'time' | 'exit'
type ReviewFilter = 'needs' | 'all' | 'correct'

export function QuizPlayer({ title, questions, eyebrow, description, onClose, onShowToast }: QuizPlayerProps) {
  const { settings, recordAnswer, toggleQbm, questionBookmarks, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const { articlesByDate } = useAppStore()
  const [started, setStarted] = useState(false)
  const [testMode, setTestMode] = useState<'exam' | 'learn'>('exam')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, TestAnswer>>({})
  const [answered, setAnswered] = useState<AnsweredState>(null)
  const [done, setDone] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('needs')
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(1, Math.ceil(questions.length * 1.2)) * 60)
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))
  const [reviewMarked, setReviewMarked] = useState<Set<number>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [exitConfirm, setExitConfirm] = useState(false)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [finishReason, setFinishReason] = useState<FinishReason>('submitted')
  const examRecorded = useRef(false)

  const q = questions[idx]
  const total = questions.length
  const articlesById = useMemo(() => new Map(Object.values(articlesByDate).flat().map(article => [article.id, article])), [articlesByDate])
  const linkedArticle = q.aid ? articlesById.get(q.aid) : undefined
  const currentRelatedPyqs = useMemo(
    () => linkedArticle && pyqData.length > 1000 ? relatedPyqs(linkedArticle, q, pyqData, 2) : [],
    [linkedArticle, pyqData, q],
  )

  useEffect(() => {
    // Related-PYQ hints are only rendered during an active Learn attempt.
    // Keep the 31-year archive off the intro, Exam and post-test review paths.
    if (!started || testMode !== 'learn' || !questions.some(question => question.src === 'article') || (pyqReady && pyqData.length > 1000)) return
    let cancelled = false
    loadPyqManifest()
      .then(manifest => loadPyqYears(manifest.totals.years))
      .then(items => {
        if (cancelled) return
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
    return () => { cancelled = true }
  }, [pyqData.length, pyqReady, questions, setPyqData, started, testMode])

  function pickAnswer(i: number) {
    if (answered && testMode === 'learn') return
    const correct = i === q.answer
    setAnswered({ picked: i, correct })
    setAnswers(prev => ({ ...prev, [idx]: { picked: i, correct, skipped: false } }))
    if (testMode === 'exam') {
      setExplanationOpen(false)
      return
    }
    setExplanationOpen(true)
    recordAnswer(q.id, correct, q.subject, settings.target, onShowToast)
    // Feedback motion after the correct/wrong classes render
    requestAnimationFrame(() => {
      pulseCorrect(document.querySelector('.pv-opt.correct'))
      if (!correct) shakeWrong(document.querySelector('.pv-opt.wrong'))
    })
  }

  function goToQuestion(nextIndex: number) {
    const bounded = Math.max(0, Math.min(total - 1, nextIndex))
    const saved = answers[bounded]
    setIdx(bounded)
    setAnswered(saved?.picked !== null && saved?.picked !== undefined
      ? { picked: saved.picked, correct: saved.correct }
      : null)
    setExplanationOpen(testMode === 'learn' && Boolean(saved?.picked !== null && saved?.picked !== undefined))
    setVisited(previous => new Set(previous).add(bounded))
    setPaletteOpen(false)
  }

  function next() {
    if (idx + 1 >= total) {
      if (testMode === 'exam') setPaletteOpen(true)
      else finish()
      return
    }
    goToQuestion(idx + 1)
  }

  function retry() {
    const now = Date.now()
    setIdx(0)
    setAnswers({})
    setAnswered(null)
    setDone(false)
    setReviewMode(false)
    setExplanationOpen(false)
    setStartedAt(now)
    setElapsedMs(0)
    setRemainingSeconds(Math.max(1, Math.ceil(total * 1.2)) * 60)
    setVisited(new Set([0]))
    setReviewMarked(new Set())
    setPaletteOpen(false)
    setExitConfirm(false)
    setSubmitConfirm(false)
    setFinishReason('submitted')
    examRecorded.current = false
  }

  function finish(reason: FinishReason = 'submitted') {
    setElapsedMs(Math.max(0, Date.now() - startedAt))
    setFinishReason(reason)
    setPaletteOpen(false)
    setExitConfirm(false)
    setSubmitConfirm(false)
    setDone(true)
  }

  function skip() {
    if (answered) return
    setAnswers(prev => ({ ...prev, [idx]: { picked: null, correct: false, skipped: true } }))
    if (idx + 1 >= total) {
      if (testMode === 'exam') setPaletteOpen(true)
      else finish()
      return
    }
    goToQuestion(idx + 1)
  }

  function clearSelection() {
    if (testMode !== 'exam') return
    setAnswered(null)
    setAnswers(previous => {
      const nextAnswers = { ...previous }
      delete nextAnswers[idx]
      return nextAnswers
    })
  }

  function toggleReview() {
    setReviewMarked(previous => {
      const nextMarked = new Set(previous)
      if (nextMarked.has(idx)) nextMarked.delete(idx)
      else nextMarked.add(idx)
      return nextMarked
    })
  }

  function requestClose() {
    if (started && !done && testMode === 'exam') {
      setExitConfirm(true)
      return
    }
    onClose()
  }

  function beginTest() {
    const now = Date.now()
    setStartedAt(now)
    setRemainingSeconds(Math.max(1, Math.ceil(total * 1.2)) * 60)
    setVisited(new Set([0]))
    setStarted(true)
  }

  function formatTime(ms: number) {
    const seconds = Math.max(0, Math.round(ms / 1000))
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  function formatCountdown(seconds: number) {
    const safe = Math.max(0, seconds)
    const mm = String(Math.floor(safe / 60)).padStart(2, '0')
    const ss = String(safe % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  // Reconcile every result from the picked option and the current answer key.
  // This keeps counts, accuracy, marks and the review screen on one source of truth.
  const answerList = questions.map((item, i): TestAnswer => {
    const picked = answers[i]?.picked ?? null
    return { picked, correct: picked !== null && picked === item.answer, skipped: picked === null }
  })
  const correctCount = answerList.filter(answer => answer.correct).length
  const incorrectCount = answerList.filter(answer => answer.picked !== null && !answer.correct).length
  const unattemptedCount = answerList.filter(answer => answer.picked === null).length
  const attemptedCount = correctCount + incorrectCount
  const accuracy = attemptedCount ? (correctCount / attemptedCount) * 100 : 0
  const attemptRate = total ? (attemptedCount / total) * 100 : 0
  const marks = correctCount * 2 - incorrectCount * (2 / 3)
  const positiveMarks = correctCount * 2
  const negativeMarks = incorrectCount * (2 / 3)
  const maxMarks = total * 2
  const estimatedMinutes = Math.max(1, Math.ceil(total * 1.2))
  const examDurationSeconds = estimatedMinutes * 60
  const examAnsweredCount = answerList.filter(answer => answer.picked !== null).length
  const examUnansweredCount = total - examAnsweredCount
  const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1_000))
  const secondsPerQuestion = total ? elapsedSeconds / total : 0
  const timeUsed = examDurationSeconds ? Math.round((elapsedSeconds / examDurationSeconds) * 100) : 0
  const paceTone = secondsPerQuestion < 30 ? 'rushed' : secondsPerQuestion <= 85 ? 'steady' : 'slow'
  const paceLabel = secondsPerQuestion < 30 ? 'Rushed pace' : secondsPerQuestion <= 85 ? 'On-target pace' : 'Slow pace'
  const paceAdvice = secondsPerQuestion < 30
    ? 'You moved very quickly. Leave time to read qualifiers and eliminate options.'
    : secondsPerQuestion <= 85
      ? 'Your pace is close to the UPSC benchmark of 72 seconds per question.'
      : 'Accuracy may improve, but practise quicker elimination to protect completion time.'
  const resultGuidance = attemptedCount === 0
    ? 'No responses were marked. Review the set once, then retry with a clear attempt strategy.'
    : accuracy >= 75 && attemptRate >= 75
      ? 'A controlled attempt. Review the few misses before increasing the set size.'
      : accuracy >= 60
        ? 'Your base is workable. Focus first on the incorrect concepts shown below.'
        : 'Prioritise accuracy over guesswork. Use the topic diagnosis to plan the next revision.'

  function formatMark(value: number) {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100
    if (Object.is(rounded, -0) || rounded === 0) return '0'
    return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  }

  function formatPercent(value: number) {
    if (!Number.isFinite(value)) return '0%'
    const rounded = Math.round(value * 10) / 10
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
  }

  function formatPace(seconds: number) {
    const safe = Math.max(0, Math.round(seconds))
    if (safe < 60) return `${safe}s/q`
    return `${Math.floor(safe / 60)}m ${String(safe % 60).padStart(2, '0')}s/q`
  }

  const subjects = Array.from(new Set(questions.map(item => item.subject).filter(Boolean)))
  const subjectAnalysis = subjects.map(subject => {
    const indices = questions.map((item, index) => item.subject === subject ? index : -1).filter(index => index >= 0)
    const attempted = indices.filter(index => answerList[index].picked !== null).length
    const correct = indices.filter(index => answerList[index].correct).length
    const incorrect = attempted - correct
    const unattempted = indices.length - attempted
    const rowMarks = correct * 2 - incorrect * (2 / 3)
    return {
      subject,
      total: indices.length,
      attempted,
      correct,
      incorrect,
      unattempted,
      accuracy: attempted ? (correct / attempted) * 100 : 0,
      marks: rowMarks,
    }
  })
  const topicMap = new Map<string, { topic: string; subject: string; years: Set<number>; indices: number[] }>()
  questions.forEach((item, index) => {
    const topic = item.pyq?.topic?.trim() || (item.src === 'article' ? item.srcLabel?.trim() : '')
    if (!topic) return
    const key = `${item.subject}::${topic}`
    const row = topicMap.get(key) ?? { topic, subject: item.subject, years: new Set<number>(), indices: [] }
    row.indices.push(index)
    if (item.pyq?.year) row.years.add(item.pyq.year)
    topicMap.set(key, row)
  })
  const topicAnalysis = Array.from(topicMap.values()).map(row => {
    const attempted = row.indices.filter(index => answerList[index].picked !== null).length
    const correct = row.indices.filter(index => answerList[index].correct).length
    const incorrect = attempted - correct
    const unattempted = row.indices.length - attempted
    return {
      ...row,
      total: row.indices.length,
      attempted,
      correct,
      incorrect,
      unattempted,
      accuracy: attempted ? (correct / attempted) * 100 : 0,
    }
  }).sort((a, b) => {
    const aScore = a.attempted ? a.correct / a.attempted : -1
    const bScore = b.attempted ? b.correct / b.attempted : -1
    return aScore - bScore || b.total - a.total || a.topic.localeCompare(b.topic)
  })
  const reviewEntries = questions.map((item, index) => ({ item, index, answer: answerList[index] }))
  const needsReviewCount = incorrectCount + unattemptedCount
  const filteredReviewEntries = reviewEntries.filter(entry => {
    if (reviewFilter === 'all') return true
    if (reviewFilter === 'correct') return entry.answer.correct
    return !entry.answer.correct
  })

  useEffect(() => {
    if (!started || done || testMode !== 'exam') return
    const tick = () => {
      const next = Math.max(0, Math.ceil((startedAt + examDurationSeconds * 1_000 - Date.now()) / 1_000))
      setRemainingSeconds(next)
      if (next > 0) return
      setElapsedMs(examDurationSeconds * 1_000)
      setFinishReason('time')
      setPaletteOpen(false)
      setExitConfirm(false)
      setSubmitConfirm(false)
      setDone(true)
    }
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [done, examDurationSeconds, started, startedAt, testMode])

  useEffect(() => {
    if (!started || done || testMode !== 'exam') return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [done, started, testMode])

  useEffect(() => {
    if (!done || testMode !== 'exam' || examRecorded.current) return
    examRecorded.current = true
    Object.entries(answers).forEach(([index, answer]) => {
      if (answer.picked === null) return
      const question = questions[Number(index)]
      if (question) recordAnswer(question.id, answer.picked === question.answer, question.subject, settings.target, onShowToast)
    })
  }, [answers, done, onShowToast, questions, recordAnswer, settings.target, testMode])

  if (!started) {
    return (
      <div className="quiz-overlay qz-intro-shell">
        <div className="quiz-header">
          <button className="qz-close" onClick={onClose} aria-label="Close test"><FontAwesomeIcon icon={faXmark} /></button>
          <span className="qz-title">Test instructions</span>
          <span style={{ width: 38 }} />
        </div>
        <div className="qz-intro">
          <section className="qz-intro-card">
            <span className="qz-intro-kicker">{eyebrow ?? 'Practice test'}</span>
            <h2>{title}</h2>
            <p>{description ?? 'Review the test details and choose how you want to attempt it.'}</p>
            <div className="qz-intro-facts">
              <div><b>{total}</b><span>Questions</span></div>
              <div><b>{estimatedMinutes} min</b><span>Estimated</span></div>
              <div><b>+2 / −⅔</b><span>Marking</span></div>
            </div>
            <div className="qz-intro-coverage"><span>Coverage</span><p>{subjects.slice(0, 5).join(' · ') || 'General Studies'}</p></div>
          </section>

          <section className="qz-mode-card">
            <div><span>Choose your attempt</span><p>Exam is assessed and timed. Learn gives feedback after every answer.</p></div>
            <button className={testMode === 'exam' ? 'active' : ''} onClick={() => setTestMode('exam')}>
              <FontAwesomeIcon icon={faShieldHalved} />
              <b>Exam mode</b><span>Timed test with UPSC marking and no answers until submission</span>
            </button>
            <button className={testMode === 'learn' ? 'active' : ''} onClick={() => setTestMode('learn')}>
              <FontAwesomeIcon icon={faBookOpen} />
              <b>Learn mode</b><span>Check each answer and explanation as you go</span>
            </button>
          </section>

          {testMode === 'exam' ? (
            <section className="qz-rules-card">
              <div className="qz-rules-title"><FontAwesomeIcon icon={faListOl} /><span><b>Test rules</b><small>Read before starting</small></span></div>
              <ol>
                <li><span>1</span><p>You have <b>{estimatedMinutes} minutes</b>. The test auto-submits when the timer reaches zero.</p></li>
                <li><span>2</span><p>Each correct answer earns <b>2 marks</b>; each incorrect answer deducts <b>two-thirds of a mark</b>.</p></li>
                <li><span>3</span><p>Use the palette to revisit questions or mark them for review. Unanswered questions have no penalty.</p></li>
                <li><span>4</span><p>Answers and explanations remain hidden until you submit the entire test.</p></li>
              </ol>
              <div className="qz-rules-warning"><FontAwesomeIcon icon={faTriangleExclamation} /><span>Closing the test will ask you to submit the current attempt.</span></div>
            </section>
          ) : (
            <div className="qz-intro-note"><b>Learn at your pace</b><p>Your answer is checked immediately. You can read the explanation before moving to the next question.</p></div>
          )}
          <button className="pn-btn qz-intro-start" onClick={beginTest}>
            {testMode === 'exam' ? 'Start exam' : 'Start learning'}
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="quiz-overlay">
        <div className="quiz-header">
          <button className="qz-close" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
          <span className="qz-title">{title}</span>
          <span style={{ width: 38 }} />
        </div>
        <div className="quiz-body qz-result modern">
          {!reviewMode ? (
            <>
              <section className="qz-score-card" aria-label="Test score summary">
                <span className={`qz-finish-reason ${finishReason}`}>
                  <FontAwesomeIcon icon={testMode === 'learn' ? faCheck : finishReason === 'time' ? faClock : finishReason === 'exit' ? faTriangleExclamation : faCheck} />
                  {testMode === 'learn' ? 'Learning set complete' : finishReason === 'time' ? 'Time expired · Auto-submitted' : finishReason === 'exit' ? 'Submitted while exiting' : 'Test submitted'}
                </span>
                <span className="qz-score-label">Net UPSC score</span>
                <div className={`qz-marks ${marks >= maxMarks * 0.5 ? 'good' : marks < 0 ? 'negative' : 'low'}`}>
                  {formatMark(marks)}<span>/{formatMark(maxMarks)}</span>
                </div>
                <p>{resultGuidance}</p>
                <div className="qz-score-metrics">
                  <div><FontAwesomeIcon icon={faBullseye} /><span>Accuracy</span><b>{formatPercent(accuracy)}</b><small>{correctCount} correct ÷ {attemptedCount} attempted</small></div>
                  <div><FontAwesomeIcon icon={faCheck} /><span>Attempted</span><b>{attemptedCount}/{total}</b><small>{formatPercent(attemptRate)} of the paper</small></div>
                </div>
              </section>

              <section className="qz-breakdown qz-answer-audit" aria-label="Reconciled response counts">
                <div className="qz-card-heading">
                  <span><small>Response audit</small><h3>Where every question went</h3></span>
                  <b>{total} total</b>
                </div>
                <div className="qz-audit-counts">
                  <span className="correct"><i />Correct<b>{correctCount}</b><small>Earned marks</small></span>
                  <span className="incorrect"><i />Incorrect<b>{incorrectCount}</b><small>Negative marks</small></span>
                  <span className="unattempted"><i />Unattempted<b>{unattemptedCount}</b><small>No penalty</small></span>
                </div>
                <p className="qz-reconcile-line"><b>{correctCount}</b> correct + <b>{incorrectCount}</b> incorrect + <b>{unattemptedCount}</b> unattempted = <strong>{total} questions</strong></p>
              </section>

              <div className="qz-diagnostics-grid">
                <section className="qz-marks-ledger">
                  <div className="qz-card-heading">
                    <span><small>UPSC marking</small><h3>Score calculation</h3></span>
                    <b>+2 / −⅔ / 0</b>
                  </div>
                  <div className="qz-ledger-rows">
                    <span><i className="correct">+2</i><b>{correctCount} correct</b><strong>+{formatMark(positiveMarks)}</strong></span>
                    <span><i className="incorrect">−⅔</i><b>{incorrectCount} incorrect</b><strong>−{formatMark(negativeMarks)}</strong></span>
                    <span><i>0</i><b>{unattemptedCount} unattempted</b><strong>0</strong></span>
                  </div>
                  <div className="qz-ledger-total"><span>Net score</span><b>{formatMark(positiveMarks)} − {formatMark(negativeMarks)}</b><strong>{formatMark(marks)}</strong></div>
                </section>

                <section className="qz-time-analysis">
                  <div className="qz-card-heading">
                    <span><small>Time & strategy</small><h3>Attempt pace</h3></span>
                    <b><FontAwesomeIcon icon={faClock} /> {formatTime(elapsedMs)}</b>
                  </div>
                  <div className="qz-time-stats">
                    <span><small>Average pace</small><b>{formatPace(secondsPerQuestion)}</b></span>
                    <span><small>Benchmark</small><b>1m 12s/q</b></span>
                    <span><small>Time used</small><b>{timeUsed}%</b></span>
                  </div>
                  <p className={`qz-pace-insight ${paceTone}`}><b>{paceLabel}</b><span>{paceAdvice}</span></p>
                </section>
              </div>

              <section className="qz-subject-analysis qz-performance-card">
                <div className="qz-card-heading">
                  <span><small>Syllabus diagnosis</small><h3>Performance by subject</h3></span>
                  <b>{subjectAnalysis.length} {subjectAnalysis.length === 1 ? 'subject' : 'subjects'}</b>
                </div>
                {subjectAnalysis.map(row => (
                  <div className="qz-analysis-row" key={row.subject}>
                    <div className="qz-analysis-copy">
                      <span><b>{row.subject}</b><i>{row.attempted}/{row.total} attempted · {row.incorrect} incorrect · {row.unattempted} unattempted</i></span>
                      <strong>{formatMark(row.marks)} marks</strong>
                    </div>
                    <div className="qz-analysis-bar"><i style={{ width: `${row.accuracy}%` }} /></div>
                    <small>{row.correct}/{row.attempted || 0} correct</small><b>{formatPercent(row.accuracy)}</b>
                  </div>
                ))}
              </section>

              {topicAnalysis.length > 0 && (
                <section className="qz-topic-analysis qz-performance-card">
                  <div className="qz-card-heading">
                    <span><small>Concept diagnosis</small><h3>Performance by topic</h3></span>
                    <b>Weakest first</b>
                  </div>
                  <div className="qz-topic-list">
                    {topicAnalysis.map(row => {
                      const status = row.attempted === 0 ? 'Not attempted' : row.accuracy >= 75 ? 'Strong' : row.accuracy >= 50 ? 'Revise once' : 'Priority review'
                      const tone = row.attempted === 0 ? 'unattempted' : row.accuracy >= 75 ? 'strong' : row.accuracy >= 50 ? 'revise' : 'priority'
                      const years = Array.from(row.years).sort((a, b) => b - a)
                      return (
                        <div className="qz-topic-row" key={`${row.subject}-${row.topic}`}>
                          <span><b>{row.topic}</b><small>{row.subject}{years.length ? ` · UPSC ${years.join(', ')}` : ''}</small></span>
                          <em className={tone}>{status}</em>
                          <p>{row.correct}/{row.total} correct · {row.incorrect} incorrect · {row.unattempted} unattempted</p>
                          <strong>{formatPercent(row.accuracy)}</strong>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <section className={`qz-review-entry ${incorrectCount ? 'has-mistakes' : ''}`}>
                <FontAwesomeIcon icon={incorrectCount ? faTriangleExclamation : faCheck} />
                <span>
                  <small>Recommended next step</small>
                  <b>{needsReviewCount ? `Review ${needsReviewCount} answers before another attempt` : 'This set is fully correct'}</b>
                  <p>{incorrectCount
                    ? `${incorrectCount} incorrect ${incorrectCount === 1 ? 'answer is' : 'answers are'} in your Mistakes Notebook. Unattempted questions stay available in this review.`
                    : unattemptedCount
                      ? 'No incorrect answers were recorded; review the unattempted questions before retrying.'
                      : 'Review the explanations once, then move to a new topic set.'}</p>
                </span>
              </section>

              <div className="qz-result-actions horizontal">
                <button className="pn-btn ghost" onClick={() => { setReviewFilter(needsReviewCount ? 'needs' : 'all'); setReviewMode(true) }}>Review {needsReviewCount || total}</button>
                <button className="pn-btn" onClick={onClose}>Continue</button>
              </div>
            </>
          ) : (
            <>
              <div className="qz-review-head">
                <button onClick={() => setReviewMode(false)} aria-label="Back to scorecard"><FontAwesomeIcon icon={faChevronLeft} /></button>
                <span><small>Post-test study</small><h3>Review answers</h3></span>
              </div>
              <div className="qz-review-overview" aria-label="Answer review counts">
                <span><b>{correctCount}</b><small>Correct</small></span>
                <span><b>{incorrectCount}</b><small>Incorrect</small></span>
                <span><b>{unattemptedCount}</b><small>Unattempted</small></span>
              </div>
              <div className="qz-review-filters" role="tablist" aria-label="Filter reviewed answers">
                <button className={reviewFilter === 'needs' ? 'active' : ''} onClick={() => setReviewFilter('needs')}>Needs review <span>{needsReviewCount}</span></button>
                <button className={reviewFilter === 'all' ? 'active' : ''} onClick={() => setReviewFilter('all')}>All <span>{total}</span></button>
                <button className={reviewFilter === 'correct' ? 'active' : ''} onClick={() => setReviewFilter('correct')}>Correct <span>{correctCount}</span></button>
              </div>
              <div className="qz-review-list">
                {filteredReviewEntries.map(({ item, index: i, answer }) => {
                  const status = answer.correct ? 'Correct' : answer.skipped ? 'Unattempted' : 'Incorrect'
                  return (
                    <div key={item.id} className={`qz-review-item ${answer.correct ? 'ok' : answer.skipped ? 'skip' : 'no'}`}>
                      <div className="qz-review-item-head">
                        <span>Question {i + 1} · {item.subject}</span>
                        <i>{item.src === 'pyq' ? 'PYQ' : 'Current Affairs'}</i>
                        <em className="qz-review-status"><FontAwesomeIcon icon={answer.correct ? faCheck : faXmark} />{status}</em>
                      </div>
                      <ReviewQuestionStem text={item.q} />
                      <div className="qz-review-answer-grid">
                        <div className={`response ${answer.correct ? 'ok' : answer.skipped ? 'skip' : 'no'}`}>
                          <span>Your response</span>
                          <b>{answer.skipped || answer.picked === null ? '—' : String.fromCharCode(65 + answer.picked)}</b>
                          <p>{answer.skipped || answer.picked === null ? 'Not attempted' : item.options[answer.picked]}</p>
                        </div>
                        <div className="correct-answer">
                          <span>Correct answer</span>
                          <b>{String.fromCharCode(65 + item.answer)}</b>
                          <p>{item.options[item.answer]}</p>
                        </div>
                      </div>
                      <details className="qz-review-explanation">
                        <summary><span>Explanation</span><b>Study why</b><FontAwesomeIcon icon={faChevronDown} /></summary>
                        <div>
                          {item.pyq ? (
                            <PyqSolutionView compact solution={item.pyq.solution} answerLabel={String.fromCharCode(65 + item.answer)} />
                          ) : <p>{item.explanation}</p>}
                          {item.ref && <small>Reference · {item.ref}</small>}
                        </div>
                      </details>
                    </div>
                  )
                })}
                {!filteredReviewEntries.length && (
                  <div className="qz-review-empty"><FontAwesomeIcon icon={faCheck} /><b>Nothing needs correction</b><p>Every response in this set was correct.</p><button onClick={() => setReviewFilter('all')}>Review all answers</button></div>
                )}
              </div>
              <div className="qz-result-actions horizontal">
                <button className="pn-btn ghost" onClick={retry}><FontAwesomeIcon icon={faRotateLeft} /> Retry</button>
                <button className="pn-btn" onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const bm = questionBookmarks.includes(q.id)
  const structuredStem = splitUPSCStem(q.q)

  return (
    <div className={`quiz-overlay ${testMode === 'exam' ? 'qz-exam-shell' : 'qz-learn-shell'}`}>
      {/* Header */}
      <div className={`quiz-header ${testMode === 'exam' ? 'qz-exam-header' : ''}`}>
        <button className="qz-close" onClick={requestClose} aria-label="Close test">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <span className="qz-title">{title}</span>
        {testMode === 'exam' ? (
          <>
            <span className={`qz-exam-timer ${remainingSeconds <= Math.max(60, examDurationSeconds * .2) ? 'urgent' : ''}`}>
              <FontAwesomeIcon icon={faClock} />{formatCountdown(remainingSeconds)}
            </span>
            <button className="qz-palette-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open question palette">
              <FontAwesomeIcon icon={faListOl} />
            </button>
          </>
        ) : <span className="qz-cnt">{idx + 1}<i>/{total}</i></span>}
      </div>

      {testMode === 'exam' ? (
        <div className="qz-exam-strip">
          <span><b>Question {idx + 1}</b> of {total}</span>
          <i>{answers[idx]?.picked !== null && answers[idx]?.picked !== undefined ? 'Response saved' : visited.has(idx) ? 'Not answered' : 'Not visited'}</i>
          {reviewMarked.has(idx) && <em><FontAwesomeIcon icon={faFlag} /> Review</em>}
        </div>
      ) : (
        <>
          <div className="qz-timeline" aria-label={`Question ${idx + 1} of ${total}`}>
            {questions.map((item, i) => {
              const state = answers[i]
              const cls = [
                i === idx ? 'current' : '',
                state?.correct ? 'ok' : '',
                state && !state.correct && !state.skipped ? 'no' : '',
                state?.skipped ? 'skip' : '',
              ].filter(Boolean).join(' ')
              return <span key={item.id} className={cls} title={`Question ${i + 1}`} />
            })}
          </div>
          <div className="qz-mode-indicator learn">
            <b>Learn mode</b>
            <span>Instant feedback and explanation after every answer.</span>
          </div>
        </>
      )}

      {/* Body */}
      <div className="quiz-body">
        {/* Meta */}
        <div className="qz-meta">
          {q.subject && <span className="pv-tag subject">{q.subject}</span>}
          {q.srcLabel && <span className="qz-src">{q.srcLabel}</span>}
          <button
            className={`qz-bm ${bm ? 'on' : ''}`}
            onClick={() => toggleQbm(q.id, onShowToast)}
            aria-label="Bookmark question"
          >
            <FontAwesomeIcon icon={bm ? faBookmarkSolid : faBookmarkReg} />
          </button>
        </div>

        {/* Question */}
        <div className={`qz-q ${structuredStem.statements.length ? 'structured' : ''}`}>
          {structuredStem.statements.length ? (
            <>
              {structuredStem.lead && <p>{structuredStem.lead}</p>}
              <ol className="upsc-statement-list">
                {structuredStem.statements.map((statement, i) => (
                  <li key={i}>
                    <span className="upsc-statement-label">{structuredStem.statementLabels[i] ?? i + 1}</span>
                    <span className="upsc-statement-text">{statement}</span>
                  </li>
                ))}
              </ol>
              {structuredStem.ask && <p className="qz-ask">{structuredStem.ask}</p>}
            </>
          ) : q.q}
        </div>

        {testMode === 'learn' && currentRelatedPyqs.length > 0 && (
          <details className="question-link-signal qz-link-signal">
            <summary><span>Related PYQ available</span><b>{currentRelatedPyqs.length === 1 ? `UPSC ${currentRelatedPyqs[0].item.year}` : `${currentRelatedPyqs.length} close matches`}</b><FontAwesomeIcon icon={faChevronDown} /></summary>
            <div>{currentRelatedPyqs.map(({ item, reason }) => <p key={item.id}><span>UPSC {item.year} · {item.subject}</span><b>{item.question}</b><i>{reason}</i></p>)}</div>
          </details>
        )}

        {/* Options */}
        <div className="qz-opts">
          {q.options.map((opt, i) => {
            let cls = 'pv-opt'
            let mark: 'ok' | 'no' | null = null
            if (answered) {
              if (testMode === 'exam') {
                if (i === answered.picked) cls += ' selected'
              } else if (i === q.answer) { cls += ' correct'; mark = 'ok' }
              else if (i === answered.picked) { cls += ' wrong'; mark = 'no' }
              else cls += ' dim'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => pickAnswer(i)}
                disabled={testMode === 'learn' && !!answered}
              >
                <span className="ol">{String.fromCharCode(65 + i)}</span>
                <span className="pv-opt-text">{opt}</span>
                {mark && (
                  <span className={`pv-opt-mark ${mark}`}>
                    <FontAwesomeIcon icon={mark === 'ok' ? faCheck : faXmark} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Explanation */}
        {answered && testMode === 'learn' && (
          explanationOpen ? (
            <div className={`qz-exp show ${answered.correct ? 'ok' : 'no'} ${q.pyq ? 'structured' : ''}`}>
              {q.pyq ? (
                <PyqSolutionView
                  solution={q.pyq.solution}
                  answerLabel={String.fromCharCode(65 + q.answer)}
                />
              ) : (
                <>
                  <b>{answered.correct ? 'Correct' : 'Not quite'}</b>
                  <p>{q.explanation}{q.ref ? ` (${q.ref})` : ''}</p>
                </>
              )}
            </div>
          ) : (
            <button className={`qz-reveal-exp ${answered.correct ? 'ok' : 'no'}`} onClick={() => setExplanationOpen(true)}>
              {answered.correct ? 'Correct answer saved' : 'Answer checked'} · Reveal explanation
            </button>
          )
        )}
      </div>

      {/* Sticky footer */}
      {testMode === 'exam' ? (
        <div className="qz-footer qz-exam-footer">
          <div className="qz-exam-secondary-actions">
            <button className={reviewMarked.has(idx) ? 'active' : ''} onClick={toggleReview}>
              <FontAwesomeIcon icon={faFlag} />{reviewMarked.has(idx) ? 'Marked for review' : 'Mark for review'}
            </button>
            <button onClick={clearSelection} disabled={!answered}>Clear response</button>
          </div>
          <div className="qz-exam-primary-actions">
            <button className="qz-exam-previous" onClick={() => goToQuestion(idx - 1)} disabled={idx === 0}>
              <FontAwesomeIcon icon={faChevronLeft} /> Previous
            </button>
            <button className="pn-btn qz-next" onClick={next}>
              {idx + 1 === total ? 'Review test' : answered ? 'Save & next' : 'Skip & next'}
              <FontAwesomeIcon icon={idx + 1 === total ? faListOl : faArrowRight} />
            </button>
          </div>
        </div>
      ) : (
        <div className="qz-footer">
          {answered ? (
            <button className="pn-btn qz-next" onClick={next}>
              {idx + 1 === total ? 'Finish learning' : 'Next question'}
              <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
            </button>
          ) : (
            <div className="qz-foot-actions">
              <button onClick={skip}>Skip</button>
              <span>Tap an option to answer</span>
            </div>
          )}
        </div>
      )}

      {paletteOpen && testMode === 'exam' && (
        <div className="qz-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false) }}>
          <section className="qz-palette-sheet" role="dialog" aria-modal="true" aria-label="Question palette">
            <i className="qz-sheet-handle" />
            <header>
              <div><span>Test navigation</span><h3>Question palette</h3></div>
              <button onClick={() => setPaletteOpen(false)} aria-label="Close palette"><FontAwesomeIcon icon={faXmark} /></button>
            </header>
            <div className="qz-palette-summary">
              <span><b>{examAnsweredCount}</b> Answered</span>
              <span><b>{examUnansweredCount}</b> Unanswered</span>
              <span><b>{reviewMarked.size}</b> For review</span>
            </div>
            <div className="qz-palette-grid">
              {questions.map((item, questionIndex) => {
                const response = answers[questionIndex]
                const isAnswered = response?.picked !== null && response?.picked !== undefined
                const classes = [
                  questionIndex === idx ? 'current' : '',
                  isAnswered ? 'answered' : visited.has(questionIndex) ? 'unanswered' : 'unvisited',
                  reviewMarked.has(questionIndex) ? 'review' : '',
                ].filter(Boolean).join(' ')
                return (
                  <button key={item.id} className={classes} onClick={() => goToQuestion(questionIndex)} aria-label={`Go to question ${questionIndex + 1}`}>
                    {questionIndex + 1}
                    {reviewMarked.has(questionIndex) && <FontAwesomeIcon icon={faFlag} />}
                  </button>
                )
              })}
            </div>
            <div className="qz-palette-legend">
              <span><i className="answered" />Answered</span><span><i className="unanswered" />Not answered</span><span><i className="unvisited" />Not visited</span><span><i className="review" />Review</span>
            </div>
            <button className="pn-btn qz-submit-test" onClick={() => { setPaletteOpen(false); setSubmitConfirm(true) }}>Submit test</button>
          </section>
        </div>
      )}

      {submitConfirm && (
        <div className="qz-dialog-backdrop" role="presentation">
          <section className="qz-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="qz-submit-title">
            <div className="qz-dialog-icon"><FontAwesomeIcon icon={faShieldHalved} /></div>
            <h3 id="qz-submit-title">Submit this test?</h3>
            <p>You have answered <b>{examAnsweredCount}</b> of <b>{total}</b> questions. Once submitted, responses cannot be changed.</p>
            <div className="qz-dialog-stats"><span>{examUnansweredCount}<i>Unanswered</i></span><span>{reviewMarked.size}<i>For review</i></span><span>{formatCountdown(remainingSeconds)}<i>Time left</i></span></div>
            <button className="pn-btn" onClick={() => finish('submitted')}>Submit and view result</button>
            <button className="qz-dialog-cancel" onClick={() => setSubmitConfirm(false)}>Continue test</button>
          </section>
        </div>
      )}

      {exitConfirm && (
        <div className="qz-dialog-backdrop" role="presentation">
          <section className="qz-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="qz-exit-title">
            <div className="qz-dialog-icon warning"><FontAwesomeIcon icon={faTriangleExclamation} /></div>
            <h3 id="qz-exit-title">Your exam is still running</h3>
            <p>Leaving now will submit your saved responses and end this attempt.</p>
            <button className="pn-btn" onClick={() => setExitConfirm(false)}>Continue test</button>
            <button className="qz-dialog-cancel danger" onClick={() => finish('exit')}>Submit attempt and view result</button>
          </section>
        </div>
      )}
    </div>
  )
}
