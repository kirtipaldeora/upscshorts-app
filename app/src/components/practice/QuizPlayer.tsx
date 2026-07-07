import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBookmark as faBookmarkSolid } from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkReg } from '@fortawesome/free-regular-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import type { Question } from '@/utils/practiceUtils'

interface QuizPlayerProps {
  title: string
  questions: Question[]
  onClose: () => void
  onShowToast: (msg: string) => void
}

type AnsweredState = { picked: number; correct: boolean } | null

export function QuizPlayer({ title, questions, onClose, onShowToast }: QuizPlayerProps) {
  const { stats, settings, recordAnswer, toggleQbm, questionBookmarks } = usePracticeStore()
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
          <span className="qz-title">{title}</span>
          <button className="icon-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="quiz-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div className="qz-end">
            <div className="qz-score">{score}<span>/{total}</span></div>
            <p>{pct >= 80 ? 'Outstanding! 🏆' : pct >= 50 ? 'Solid effort — review the misses. 💪' : 'Keep at it — revision wins. 📚'}</p>
            <button className="pn-btn" onClick={retry}>Retry</button>
            <button className="pn-btn ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  const bm = questionBookmarks.includes(q.id)

  return (
    <div className="quiz-overlay">
      {/* Header */}
      <div className="quiz-header">
        <span className="qz-title">{title}</span>
        <span className="qz-cnt">{idx + 1} / {total}</span>
        <button className="icon-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
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
        <div className="qz-q">{q.q}</div>

        {/* Options */}
        <div className="qz-opts">
          {q.options.map((opt, i) => {
            let cls = 'pv-opt'
            if (answered) {
              if (i === q.answer) cls += ' correct'
              else if (i === answered.picked) cls += ' wrong'
            }
            return (
              <div
                key={i}
                className={cls}
                onClick={() => pickAnswer(i)}
                style={{ cursor: answered ? 'default' : 'pointer' }}
              >
                <div className="ol">{String.fromCharCode(65 + i)}</div>
                <div>{opt}</div>
              </div>
            )
          })}
        </div>

        {/* Explanation */}
        {answered && (
          <div className="qz-exp show">
            <b>Explanation:</b> {q.explanation}{q.ref ? ` (${q.ref})` : ''}
          </div>
        )}

        {/* Next button */}
        {answered && (
          <button className="pn-btn" onClick={next} style={{ marginTop: 8 }}>
            {idx + 1 === total ? 'Finish' : 'Next question'}
          </button>
        )}
      </div>
    </div>
  )
}
