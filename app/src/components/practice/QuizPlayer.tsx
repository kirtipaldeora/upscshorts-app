import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faXmark,
  faCheck,
  faArrowRight,
  faBookmark as faBookmarkSolid,
  faClock,
  faBullseye,
  faChevronDown,
  faRotateLeft,
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

type AnsweredState = { picked: number; correct: boolean } | null
type TestAnswer = { picked: number | null; correct: boolean; skipped: boolean }

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
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  const q = questions[idx]
  const total = questions.length
  const articlesById = useMemo(() => new Map(Object.values(articlesByDate).flat().map(article => [article.id, article])), [articlesByDate])
  const linkedArticle = q.aid ? articlesById.get(q.aid) : undefined
  const currentRelatedPyqs = useMemo(
    () => linkedArticle && pyqData.length > 1000 ? relatedPyqs(linkedArticle, q, pyqData, 2) : [],
    [linkedArticle, pyqData, q],
  )

  useEffect(() => {
    if (!questions.some(question => question.src === 'article') || (pyqReady && pyqData.length > 1000)) return
    loadPyqManifest()
      .then(manifest => loadPyqYears(manifest.totals.years))
      .then(items => setPyqData(items.map((item): PyqItem => ({
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
      }))))
      .catch(() => {})
  }, [pyqData.length, pyqReady, questions, setPyqData])

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

  function next() {
    if (testMode === 'exam' && answered) {
      recordAnswer(q.id, answered.correct, q.subject, settings.target, onShowToast)
    }
    if (idx + 1 >= total) { finish(); return }
    setIdx(i => i + 1)
    setAnswered(null)
    setExplanationOpen(false)
  }

  function retry() {
    setIdx(0); setAnswers({}); setAnswered(null); setDone(false); setReviewMode(false); setExplanationOpen(false); setStartedAt(Date.now()); setElapsedMs(0)
  }

  function finish() {
    setElapsedMs(Date.now() - startedAt)
    setDone(true)
  }

  function skip() {
    if (answered) return
    setAnswers(prev => ({ ...prev, [idx]: { picked: null, correct: false, skipped: true } }))
    if (idx + 1 >= total) { finish(); return }
    setIdx(i => i + 1)
    setExplanationOpen(false)
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

  function formatTime(ms: number) {
    const seconds = Math.max(0, Math.round(ms / 1000))
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const answerList = questions.map((item, i) => answers[i] ?? { picked: null, correct: false, skipped: true })
  const correctCount = answerList.filter(a => a.correct).length
  const incorrectCount = answerList.filter(a => !a.correct && !a.skipped).length
  const skippedCount = answerList.filter(a => a.skipped).length
  const attemptedCount = correctCount + incorrectCount
  const accuracy = attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0
  const pct = total > 0 ? Math.round(correctCount / total * 100) : 0
  const marks = correctCount * 2 - incorrectCount * (2 / 3)
  const maxMarks = total * 2
  const marksText = `${Number(marks.toFixed(2))} / ${maxMarks}`
  const estimatedMinutes = Math.max(1, Math.ceil(total * 1.2))
  const subjects = Array.from(new Set(questions.map(item => item.subject).filter(Boolean)))
  const subjectAnalysis = subjects.map(subject => {
    const indices = questions.map((item, index) => item.subject === subject ? index : -1).filter(index => index >= 0)
    const attempted = indices.filter(index => !answerList[index].skipped).length
    const correct = indices.filter(index => answerList[index].correct).length
    return { subject, total: indices.length, attempted, correct }
  })

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
              <div><b>+2 / −0.66</b><span>Marking</span></div>
            </div>
            <div className="qz-intro-coverage"><span>Coverage</span><p>{subjects.slice(0, 5).join(' · ') || 'General Studies'}</p></div>
          </section>

          <section className="qz-mode-card">
            <div><span>Attempt mode</span><p>You can change the feedback style before starting.</p></div>
            <button className={testMode === 'exam' ? 'active' : ''} onClick={() => setTestMode('exam')}>
              <b>Exam mode</b><span>No answers or explanations until submission</span>
            </button>
            <button className={testMode === 'learn' ? 'active' : ''} onClick={() => setTestMode('learn')}>
              <b>Learn mode</b><span>Check each answer and explanation as you go</span>
            </button>
          </section>

          <div className="qz-intro-note"><b>Before you begin</b><p>Unanswered questions receive no penalty. Your result will include accuracy, attempt data and subject-wise performance.</p></div>
          <button className="pn-btn qz-intro-start" onClick={() => { setStartedAt(Date.now()); setStarted(true) }}>Start test</button>
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
              <div className="qz-score-card">
                <span className="qz-flag">Scorecard</span>
                <h3>Total Marks</h3>
                <div className={`qz-marks ${marks >= maxMarks * 0.5 ? 'good' : 'low'}`}>{Number(marks.toFixed(2))}<span>/{maxMarks}</span></div>
                <p>{pct >= 80 ? 'Excellent control. Keep building speed.' : pct >= 50 ? 'Good attempt. Review errors before the next set.' : "One test does not define you. Review, retry, improve."}</p>
                <div className="qz-score-metrics">
                  <div><FontAwesomeIcon icon={faClock} /><span>Time Taken</span><b>{formatTime(elapsedMs)}</b></div>
                  <div><FontAwesomeIcon icon={faBullseye} /><span>Accuracy</span><b>{accuracy}%</b></div>
                </div>
              </div>

              <div className="qz-breakdown">
                <h4>Total MCQs: {total}</h4>
                <div>
                  <span>Correct<b>{correctCount}</b><i>+{correctCount * 2} marks</i></span>
                  <span>Incorrect<b>{incorrectCount}</b><i>-{Number((incorrectCount * (2 / 3)).toFixed(2))} marks</i></span>
                  <span>Skipped<b>{skippedCount}</b><i>-</i></span>
                </div>
              </div>

              <div className="qz-subject-analysis">
                <div className="qz-analysis-head"><span>Performance by subject</span><b>{marksText}</b></div>
                {subjectAnalysis.map(row => (
                  <div className="qz-analysis-row" key={row.subject}>
                    <span><b>{row.subject}</b><i>{row.attempted}/{row.total} attempted</i></span>
                    <strong>{row.correct}/{row.total}</strong>
                  </div>
                ))}
              </div>

              <div className="qz-result-actions horizontal">
                <button className="pn-btn ghost" onClick={() => setReviewMode(true)}>Review Answers</button>
                <button className="pn-btn" onClick={onClose}>Continue</button>
              </div>
            </>
          ) : (
            <>
              <div className="qz-review-head">
                <button onClick={() => setReviewMode(false)}><FontAwesomeIcon icon={faArrowRight} /> Scorecard</button>
                <h3>Review Answers</h3>
              </div>
              <div className="qz-review-list">
                {questions.map((item, i) => {
                  const answer = answerList[i]
                  return (
                    <div key={item.id} className={`qz-review-item ${answer.correct ? 'ok' : answer.skipped ? 'skip' : 'no'}`}>
                      <span>Q{i + 1} · {item.subject}</span>
                      <b>{item.q}</b>
                      <p>Your answer: {answer.skipped || answer.picked === null ? 'Skipped' : item.options[answer.picked]}</p>
                      <p>Correct answer: {item.options[item.answer]}</p>
                      {item.pyq ? (
                        <PyqSolutionView
                          compact
                          solution={item.pyq.solution}
                          answerLabel={String.fromCharCode(65 + item.answer)}
                        />
                      ) : <em>{item.explanation}</em>}
                    </div>
                  )
                })}
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
    <div className="quiz-overlay">
      {/* Header */}
      <div className="quiz-header">
        <button className="qz-close" onClick={onClose} aria-label="Close test">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <span className="qz-title">{title}</span>
        <span className="qz-cnt">{idx + 1}<i>/{total}</i></span>
      </div>

      <div className="qz-timeline" aria-label={`Question ${idx + 1} of ${total}`}>
        {questions.map((item, i) => {
          const state = answers[i]
          const cls = [
            i === idx ? 'current' : '',
            testMode === 'exam' && state && !state.skipped ? 'answered' : '',
            testMode === 'learn' && state?.correct ? 'ok' : '',
            testMode === 'learn' && state && !state.correct && !state.skipped ? 'no' : '',
            state?.skipped ? 'skip' : '',
          ].filter(Boolean).join(' ')
          return <span key={item.id} className={cls} title={`Question ${i + 1}`} />
        })}
      </div>

      <div className={`qz-mode-indicator ${testMode}`}>
        <b>{testMode === 'exam' ? 'Exam mode' : 'Learn mode'}</b>
        <span>{testMode === 'exam' ? 'Select or change an option. Answers stay hidden until submission.' : 'Instant feedback and explanation after every answer.'}</span>
      </div>

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

        {currentRelatedPyqs.length > 0 && (
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
      <div className="qz-footer">
        {answered ? (
          <div className={`qz-answered-actions ${testMode}`}>
            {testMode === 'exam' && <button className="qz-clear" onClick={clearSelection}>Clear</button>}
            <button className="pn-btn qz-next" onClick={next}>
              {idx + 1 === total ? 'Submit test' : testMode === 'exam' ? 'Save & next' : 'Next question'}
              <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
            </button>
          </div>
        ) : (
          <div className="qz-foot-actions">
            <button onClick={skip}>Skip</button>
            <span>Tap an option to answer</span>
          </div>
        )}
      </div>
    </div>
  )
}
