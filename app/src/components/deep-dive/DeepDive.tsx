import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faShareAlt, faBullseye, faPenFancy, faCircle, faDumbbell, faPlay, faCloudArrowUp } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { CATEGORY_COLORS } from '@/constants/categories'
import { articleQs } from '@/utils/practiceUtils'
import type { MainsQuestion, Question } from '@/utils/practiceUtils'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { MainsDetail } from '@/components/practice/MainsDetail'

interface DeepDiveProps {
  onShowToast: (msg: string) => void
}

type ActiveQuiz = { title: string; questions: Question[] } | null

function splitPrelimsStem(stem: string) {
  const whichMatch = stem.match(/\bWhich of\b/i)
  const questionStart = whichMatch?.index ?? -1
  const setup = questionStart >= 0 ? stem.slice(0, questionStart).trim() : stem.trim()
  const ask = questionStart >= 0 ? stem.slice(questionStart).trim() : ''
  const firstStatement = setup.search(/\b1\.\s+/)

  if (firstStatement < 0) {
    return { lead: setup, statements: [] as string[], ask }
  }

  const lead = setup.slice(0, firstStatement).trim()
  const statementText = setup.slice(firstStatement).trim()
  const statements = Array.from(statementText.matchAll(/\d+\.\s+(.+?)(?=\s+\d+\.\s+|$)/g), m => m[1].trim())

  return { lead, statements, ask }
}

export function DeepDive({ onShowToast }: DeepDiveProps) {
  const { activeArticle, setOverlay, overlayScreen, articlesByDate, setScreen } = useAppStore()
  const haptic = useHaptic()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [mainsOpen, setMainsOpen] = useState(false)

  const visible = overlayScreen === 'deep-dive'
  const a = activeArticle
  const prelimQuestions = a?.prelimsQs ?? []
  const previewPrelims = prelimQuestions[0]
  const previewStem = previewPrelims ? splitPrelimsStem(previewPrelims.q) : null
  const articleMainsQuestion: MainsQuestion | null = a?.deepDive.possibleMainsQuestion ? {
    id: `ma-${a.id}`,
    q: a.deepDive.possibleMainsQuestion,
    subject: a.category,
    srcLabel: a.headline,
  } : null

  async function handleClose() {
    await haptic()
    setMainsOpen(false)
    setOverlay(null)
  }

  async function handleShare() {
    if (!a) return
    await haptic()
    try {
      if (navigator.share) {
        await navigator.share({ title: a.headline, text: a.summary })
      } else {
        throw new Error('Share API not supported')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(a.headline)
        onShowToast('Copied to clipboard')
      } catch { /* noop */ }
    }
  }

  const col = a ? CATEGORY_COLORS[a.category] : '#9DBCE8'

  const fdf = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function startPrelimsPractice() {
    if (!a) return
    const allArticles = Object.values(articlesByDate).flat()
    const qs = articleQs(allArticles).filter(q => q.aid === a.id)
    if (qs.length) setActiveQuiz({ title: 'Article Practice', questions: qs })
  }

  return (
    <div id="deep-dive" className={visible ? 'active' : ''}>
      {/* Header */}
      <div className="dd-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>{a?.headline ?? ''}</h2>
        <button onClick={handleShare} aria-label="Share">
          <FontAwesomeIcon icon={faShareAlt} />
        </button>
      </div>

      {/* Body */}
      {a && (
        <div className="dd-body">
          {/* Metadata tags */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              className="tag tag-cat"
              style={{
                color: col,
                borderColor: col + '30',
                background: col + '10',
              }}
            >
              {a.category}
            </span>
            <span className="tag tag-gs">{a.gsPaper}</span>
            <span className="tag tag-src">
              <FontAwesomeIcon
                icon={faCircle}
                style={{ fontSize: 4, verticalAlign: 'middle', marginRight: 4, opacity: 0.6 }}
              />
              {a.source}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', fontWeight: 700 }}>
              {fdf(a.date)}
            </span>
          </div>

          {/* Explanation */}
          <div
            className="dd-explain"
            dangerouslySetInnerHTML={{ __html: a.deepDive.explanation.replace(/\n/g, '<br>') }}
          />

          <div className="dd-divider"></div>

          {/* Prelims Facts */}
          <div style={{ marginBottom: 18 }}>
            <div className="dd-section-title">
              <FontAwesomeIcon icon={faBullseye} style={{ marginRight: 6 }} />
              Prelims Facts
            </div>
            <div className="dd-fact-box">
              <ul style={{ paddingLeft: 14, margin: 0 }}>
                {a.deepDive.prelimsFacts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Expected Mains Question */}
          <div>
            <div className="dd-section-title">
              <FontAwesomeIcon icon={faPenFancy} style={{ marginRight: 6 }} />
              Expected Mains Question
            </div>
            <div className="dd-question">{a.deepDive.possibleMainsQuestion}</div>
            {articleMainsQuestion && (
              <button
                className="pn-btn dd-mains-eval-btn"
                onClick={() => setMainsOpen(true)}
              >
                <FontAwesomeIcon icon={faCloudArrowUp} style={{ marginRight: 8 }} />
                Upload answer for evaluation
              </button>
            )}
          </div>

          {/* Prelims Practice */}
          {previewPrelims && previewStem && (
            <div style={{ marginTop: 20 }}>
              <div className="dd-section-title">
                <FontAwesomeIcon icon={faDumbbell} style={{ marginRight: 6 }} />
                Prelims Practice
              </div>
              <div className="dd-prelims-card">
                <div className="dd-prelims-top">
                  <span>Question 1</span>
                  <b>{prelimQuestions.length} total</b>
                </div>
                <div className="dd-prelims-stem">
                  {previewStem.lead && <p>{previewStem.lead}</p>}
                  {previewStem.statements.length > 0 && (
                    <ol>
                      {previewStem.statements.map((statement, i) => (
                        <li key={i}>{statement}</li>
                      ))}
                    </ol>
                  )}
                  {previewStem.ask && <p className="dd-prelims-ask">{previewStem.ask}</p>}
                </div>
                <div className="dd-prelims-options">
                  {previewPrelims.options.map((option, i) => (
                    <div key={`${i}-${option}`} className="dd-prelims-option">
                      <span>{String.fromCharCode(65 + i)}</span>
                      <b>{option}</b>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="pn-btn"
                style={{ marginTop: 12 }}
                onClick={startPrelimsPractice}
              >
                <FontAwesomeIcon icon={faPlay} style={{ marginRight: 8 }} />
                Start all {prelimQuestions.length}
              </button>
            </div>
          )}

          <div style={{ height: 20 }}></div>

          {/* Quiz Player inline overlay */}
          {activeQuiz && (
            <QuizPlayer
              title={activeQuiz.title}
              questions={activeQuiz.questions}
              onClose={() => setActiveQuiz(null)}
              onShowToast={onShowToast}
            />
          )}
          {mainsOpen && articleMainsQuestion && (
            <MainsDetail
              question={articleMainsQuestion}
              onClose={() => setMainsOpen(false)}
              onShowToast={onShowToast}
              onOpenSettings={() => {
                setMainsOpen(false)
                setOverlay(null)
                setScreen('settings')
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
