import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faXmark,
  faCheck,
  faArrowRight,
  faBookmark as faBookmarkSolid,
  faClock,
  faBullseye,
  faDownload,
  faShareNodes,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkReg } from '@fortawesome/free-regular-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { pulseCorrect, shakeWrong } from '@/anim/animations'
import type { Question } from '@/utils/practiceUtils'
import { splitUPSCStem } from '@/utils/questionQuality'
import { PyqSolutionView } from '@/components/pyq-vault/PyqSolutionView'

interface QuizPlayerProps {
  title: string
  questions: Question[]
  onClose: () => void
  onShowToast: (msg: string) => void
}

type AnsweredState = { picked: number; correct: boolean } | null
type TestAnswer = { picked: number | null; correct: boolean; skipped: boolean }
type RewardBurst = { id: number; text: string; combo: number; xp: number } | null

export function QuizPlayer({ title, questions, onClose, onShowToast }: QuizPlayerProps) {
  const { settings, recordAnswer, toggleQbm, questionBookmarks } = usePracticeStore()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, TestAnswer>>({})
  const [answered, setAnswered] = useState<AnsweredState>(null)
  const [done, setDone] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [combo, setCombo] = useState(0)
  const [earnedXp, setEarnedXp] = useState(0)
  const [earnedCredits, setEarnedCredits] = useState(0)
  const [rewardBurst, setRewardBurst] = useState<RewardBurst>(null)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  const q = questions[idx]
  const total = questions.length

  function pickAnswer(i: number) {
    if (answered) return
    const correct = i === q.answer
    setAnswered({ picked: i, correct })
    setExplanationOpen(false)
    setAnswers(prev => ({ ...prev, [idx]: { picked: i, correct, skipped: false } }))
    if (correct) {
      const nextCombo = combo + 1
      const bonus = nextCombo >= 3 ? 5 : 0
      const xpGain = 15 + bonus
      setCombo(nextCombo)
      setEarnedXp(value => value + xpGain)
      setEarnedCredits(value => value + 3 + (nextCombo >= 3 ? 1 : 0))
      if (nextCombo >= 2) {
        setRewardBurst({
          id: Date.now(),
          combo: nextCombo,
          xp: xpGain,
          text: nextCombo >= 5 ? 'Brilliant streak' : nextCombo >= 3 ? 'Combo bonus' : 'Nice chain',
        })
        window.setTimeout(() => setRewardBurst(null), 1250)
      }
    } else {
      setCombo(0)
    }
    recordAnswer(q.id, correct, q.subject, settings.target, onShowToast)
    // Feedback motion after the correct/wrong classes render
    requestAnimationFrame(() => {
      pulseCorrect(document.querySelector('.pv-opt.correct'))
      if (!correct) shakeWrong(document.querySelector('.pv-opt.wrong'))
    })
  }

  function next() {
    if (idx + 1 >= total) { finish(); return }
    setIdx(i => i + 1)
    setAnswered(null)
    setExplanationOpen(false)
  }

  function retry() {
    setIdx(0); setAnswers({}); setAnswered(null); setDone(false); setReviewMode(false); setExplanationOpen(false); setCombo(0); setEarnedXp(0); setEarnedCredits(0); setRewardBurst(null); setStartedAt(Date.now()); setElapsedMs(0)
  }

  function finish() {
    setElapsedMs(Date.now() - startedAt)
    setDone(true)
  }

  function skip() {
    if (answered) return
    setAnswers(prev => ({ ...prev, [idx]: { picked: null, correct: false, skipped: true } }))
    setCombo(0)
    if (idx + 1 >= total) { finish(); return }
    setIdx(i => i + 1)
    setExplanationOpen(false)
  }

  function formatTime(ms: number) {
    const seconds = Math.max(0, Math.round(ms / 1000))
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  function downloadAnswers() {
    const lines = questions.map((item, i) => {
      const answer = answers[i]
      const picked = answer?.picked === null || answer?.picked === undefined ? 'Skipped' : item.options[answer.picked]
      return [
        `Q${i + 1}. ${item.q}`,
        `Your answer: ${picked}`,
        `Correct answer: ${item.options[item.answer]}`,
        `Explanation: ${item.pyq?.solution.detail ?? item.explanation}`,
      ].join('\n')
    })
    const blob = new Blob([lines.join('\n\n---\n\n')], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-answers.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function shareMarks() {
    const text = `I scored ${marksText} in ${title} on Penni with ${accuracy}% accuracy.`
    if (navigator.share) {
      await navigator.share({ title: 'Penni scorecard', text }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(text).catch(() => {})
      onShowToast('Score copied')
    }
  }

  const answerList = questions.map((item, i) => answers[i] ?? { picked: null, correct: false, skipped: false })
  const correctCount = answerList.filter(a => a.correct).length
  const incorrectCount = answerList.filter(a => !a.correct && !a.skipped).length
  const skippedCount = answerList.filter(a => a.skipped).length
  const attemptedCount = correctCount + incorrectCount
  const accuracy = attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0
  const pct = total > 0 ? Math.round(correctCount / total * 100) : 0
  const marks = correctCount * 2 - incorrectCount * (2 / 3)
  const maxMarks = total * 2
  const marksText = `${Number(marks.toFixed(2))} / ${maxMarks}`

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
                <div className="qz-reward-summary">
                  <span>+{earnedXp} XP</span>
                  <span>+{earnedCredits} credits</span>
                </div>
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

              <div className="qz-export-card">
                <button onClick={downloadAnswers}><FontAwesomeIcon icon={faDownload} /><span><b>Download answers</b><i>Get a clean answer file</i></span></button>
                <button onClick={() => void shareMarks()}><FontAwesomeIcon icon={faShareNodes} /><span><b>Share your marks</b><i>Copy or share scorecard</i></span></button>
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

      {rewardBurst && (
        <div key={rewardBurst.id} className="qz-reward-burst">
          <b>{rewardBurst.text}</b>
          <span>{rewardBurst.combo} correct in a row · +{rewardBurst.xp} XP</span>
        </div>
      )}

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

      {/* Body */}
      <div className="quiz-body">
        {/* Meta */}
        <div className="qz-meta">
          {q.subject && <span className="pv-tag subject">{q.subject}</span>}
          {q.srcLabel && <span className="qz-src">{q.srcLabel}</span>}
          {earnedXp > 0 && <span className={`qz-live-xp ${combo >= 2 ? 'hot' : ''}`}>+{earnedXp} XP</span>}
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
              <ol>
                {structuredStem.statements.map((statement, i) => <li key={i}>{statement}</li>)}
              </ol>
              {structuredStem.ask && <p className="qz-ask">{structuredStem.ask}</p>}
            </>
          ) : q.q}
        </div>

        {/* Options */}
        <div className="qz-opts">
          {q.options.map((opt, i) => {
            let cls = 'pv-opt'
            let mark: 'ok' | 'no' | null = null
            if (answered) {
              if (i === q.answer) { cls += ' correct'; mark = 'ok' }
              else if (i === answered.picked) { cls += ' wrong'; mark = 'no' }
              else cls += ' dim'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => pickAnswer(i)}
                disabled={!!answered}
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
        {answered && (
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
          <button className="pn-btn qz-next" onClick={next}>
            {idx + 1 === total ? 'Finish test' : 'Next question'}
            <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
          </button>
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
