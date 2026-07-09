import { useState } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faCheck, faArrowRight, faBookmark as faBookmarkSolid } from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkReg } from '@fortawesome/free-regular-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { pulseCorrect, shakeWrong } from '@/anim/animations'
import type { Question } from '@/utils/practiceUtils'
import { splitUPSCStem } from '@/utils/questionQuality'

interface QuizPlayerProps {
  title: string
  questions: Question[]
  onClose: () => void
  onShowToast: (msg: string) => void
}

type AnsweredState = { picked: number; correct: boolean } | null

export function QuizPlayer({ title, questions, onClose, onShowToast }: QuizPlayerProps) {
  const { settings, recordAnswer, toggleQbm, questionBookmarks } = usePracticeStore()
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState>(null)
  const [done, setDone] = useState(false)

  const q = questions[idx]
  const total = questions.length

  function pickAnswer(i: number) {
    if (answered) return
    const correct = i === q.answer
    if (correct) setScore(s => s + 1)
    setAnswered({ picked: i, correct })
    recordAnswer(q.id, correct, q.subject, settings.target, onShowToast)
    // Feedback motion after the correct/wrong classes render
    requestAnimationFrame(() => {
      pulseCorrect(document.querySelector('.pv-opt.correct'))
      if (!correct) shakeWrong(document.querySelector('.pv-opt.wrong'))
    })
  }

  function next() {
    if (idx + 1 >= total) { setDone(true); return }
    setIdx(i => i + 1)
    setAnswered(null)
  }

  function retry() {
    setIdx(0); setScore(0); setAnswered(null); setDone(false)
  }

  const pct = total > 0 ? Math.round(score / total * 100) : 0

  if (done) {
    return (
      <div className="quiz-overlay">
        <div className="quiz-header">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
          <span className="qz-title">{title}</span>
          <span style={{ width: 38 }} />
        </div>
        <div className="quiz-body qz-result">
          <div className="qz-ring" style={{ '--p': pct } as CSSProperties}>
            <div className="qz-ring-inner">
              <b>{pct}<i>%</i></b>
              <span>{score} / {total}</span>
            </div>
          </div>
          <h3 className="qz-result-title">
            {pct >= 80 ? 'Outstanding! 🏆' : pct >= 50 ? 'Solid effort 💪' : 'Keep at it 📚'}
          </h3>
          <p className="qz-result-sub">
            {pct >= 80 ? 'You have a strong grip on this set.' : pct >= 50 ? 'Review the ones you missed and go again.' : 'Revision wins — retry to lock it in.'}
          </p>
          <div className="qz-result-actions">
            <button className="pn-btn" onClick={retry}>Retry test</button>
            <button className="pn-btn ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  const bm = questionBookmarks.includes(q.id)
  const progress = Math.round(((idx + (answered ? 1 : 0)) / total) * 100)
  const structuredStem = splitUPSCStem(q.q)

  return (
    <div className="quiz-overlay">
      {/* Header */}
      <div className="quiz-header">
        <button className="icon-btn" onClick={onClose} aria-label="Close test">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <span className="qz-title">{title}</span>
        <span className="qz-cnt">{idx + 1}<i>/{total}</i></span>
      </div>

      {/* Progress bar */}
      <div className="qz-progress"><span style={{ width: `${progress}%` }} /></div>

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
          <div className={`qz-exp show ${answered.correct ? 'ok' : 'no'}`}>
            <b>{answered.correct ? 'Correct' : 'Not quite'}</b>
            <p>{q.explanation}{q.ref ? ` (${q.ref})` : ''}</p>
          </div>
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
          <div className="qz-hint">Tap an option to answer</div>
        )}
      </div>
    </div>
  )
}
