import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faShareAlt, faPenFancy, faCircle, faDumbbell, faPlay, faCloudArrowUp, faChevronLeft, faChevronRight, faStop, faVolumeHigh, faGaugeHigh } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useHaptic } from '@/hooks/useHaptic'
import { useNarration } from '@/hooks/useNarration'
import { gsap, reducedMotion, DUR, EASE } from '@/anim/animations'
import { CATEGORY_COLORS } from '@/constants/categories'
import { articleQs } from '@/utils/practiceUtils'
import type { MainsQuestion, Question } from '@/utils/practiceUtils'
import { splitUPSCStem } from '@/utils/questionQuality'
import { articleNarration, articleNarrationHi } from '@/utils/narration'
import type { Article } from '@/types/article'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { MainsDetail } from '@/components/practice/MainsDetail'

interface DeepDiveProps {
  onShowToast: (msg: string) => void
}

type ActiveQuiz = { title: string; questions: Question[] } | null
const READ_SPEEDS = [1, 1.25, 1.5, 1.75]
const BASE_READ_RATE = 0.88

export function DeepDive({ onShowToast }: DeepDiveProps) {
  const { activeArticle, setActiveArticle, setDeepDiveReturnOverlay, setOverlay, overlayScreen, deepDiveReturnOverlay, articlesByDate, getArticlesForDate, setScreen } = useAppStore()
  const { settings } = usePracticeStore()
  const haptic = useHaptic()
  const narration = useNarration()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [mainsOpen, setMainsOpen] = useState(false)
  const [readSpeed, setReadSpeed] = useState(1)
  const [readLang, setReadLang] = useState<'en' | 'hi'>(() => {
    try { return localStorage.getItem('penni-read-lang') === 'hi' ? 'hi' : 'en' } catch { return 'en' }
  })
  const bodyRef = useRef<HTMLDivElement>(null)

  const visible = overlayScreen === 'deep-dive'
  const a = activeArticle

  // Sibling articles for prev/next navigation — follow the same list the feed
  // shows for this article's day (respects active filters); fall back to the
  // full day if the article was opened from a filtered/other context.
  const filteredSiblings = a ? getArticlesForDate(a.date) : []
  const siblings = a
    ? (filteredSiblings.some(s => s.id === a.id) ? filteredSiblings : (articlesByDate[a.date] ?? []))
    : []
  const idx = a ? siblings.findIndex(s => s.id === a.id) : -1
  const prevArticle = idx > 0 ? siblings[idx - 1] : null
  const nextArticle = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null

  // Reset scroll to top whenever the shown article changes
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
    setReadProgress(0)
    narration.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id])

  // Sections settle in softly when an article opens or changes
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !visible || !a || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.dd-reader-hero > *, .dd-meta-row > *',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: DUR.md, ease: EASE.expo, stagger: 0.055, clearProps: 'transform,opacity' })
    }, el)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, visible])

  const [readProgress, setReadProgress] = useState(0)
  function onBodyScroll() {
    const el = bodyRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setReadProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0)
  }

  async function goToArticle(article: Article) {
    await haptic()
    setMainsOpen(false)
    setActiveQuiz(null)
    setActiveArticle(article)
  }
  const prelimQuestions = a?.prelimsQs ?? []
  const previewPrelims = prelimQuestions[0]
  const previewStem = previewPrelims ? splitUPSCStem(previewPrelims.q) : null
  const articleMainsQuestion: MainsQuestion | null = a?.deepDive.possibleMainsQuestion ? {
    id: `ma-${a.id}`,
    q: a.deepDive.possibleMainsQuestion,
    subject: a.category,
    srcLabel: a.headline,
  } : null

  async function handleClose() {
    await haptic()
    narration.stop()
    setMainsOpen(false)
    if (deepDiveReturnOverlay) {
      setOverlay(deepDiveReturnOverlay)
      setDeepDiveReturnOverlay(null)
    } else {
      setOverlay(null)
    }
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

  function startArticleReading(article: Article, speed = readSpeed, lang = readLang) {
    const hiScript = lang === 'hi' ? articleNarrationHi(article) : null
    return narration.speak(hiScript ?? articleNarration(article), {
      lang: hiScript ? 'hi-IN' : 'en-IN',
      rate: BASE_READ_RATE * speed,
      pitch: speed > 1.25 ? 1.01 : 1.04,
      voiceURI: settings.voiceURI || undefined,
    })
  }

  async function toggleReadLang() {
    if (!a) return
    await haptic()
    const next = readLang === 'en' ? 'hi' : 'en'
    if (next === 'hi' && !articleNarrationHi(a)) {
      onShowToast('Hindi version not available for this article yet')
      return
    }
    setReadLang(next)
    try { localStorage.setItem('penni-read-lang', next) } catch { /* noop */ }
    if (narration.speaking) {
      narration.stop()
      startArticleReading(a, readSpeed, next)
    }
  }

  async function readArticle() {
    if (!a) return
    await haptic()
    if (narration.speaking) {
      narration.stop()
      return
    }
    const ok = startArticleReading(a)
    if (!ok) onShowToast('Voice reading is not supported on this device')
  }

  async function increaseReadSpeed() {
    if (!a) return
    await haptic()
    const currentIndex = READ_SPEEDS.indexOf(readSpeed)
    const nextSpeed = READ_SPEEDS[(currentIndex + 1) % READ_SPEEDS.length]
    setReadSpeed(nextSpeed)
    narration.setVoiceOptions({
      rate: BASE_READ_RATE * nextSpeed,
      pitch: nextSpeed > 1.25 ? 1.01 : 1.04,
    })
  }

  const col = a ? CATEGORY_COLORS[a.category] : '#9DBCE8'

  const fdf = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  async function startPrelimsPractice() {
    if (!a) return
    await haptic()
    const allArticles = Object.values(articlesByDate).flat()
    const qs = articleQs(allArticles).filter(q => q.aid === a.id)
    if (qs.length) setActiveQuiz({ title: 'Article Practice', questions: qs })
  }

  return (
    <div id="deep-dive" className={visible ? 'active' : ''} style={{ '--cat': col } as CSSProperties}>
      {/* Header */}
      <div className="dd-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>{a?.headline ?? ''}</h2>
        <button onClick={handleShare} aria-label="Share">
          <FontAwesomeIcon icon={faShareAlt} />
        </button>
        <div className="dd-progress" aria-hidden="true"><span style={{ width: `${readProgress}%` }} /></div>
      </div>

      {/* Body */}
      {a && (
        <div className="dd-body" ref={bodyRef} onScroll={onBodyScroll}>
          <section className="dd-reader-hero">
            <span>Reader briefing</span>
            <h1>{a.headline}</h1>
            <p>{a.summary}</p>
            <div className="dd-read-controls">
              <button
                className={`dd-read-btn ${narration.speaking ? 'on' : ''}`}
                onClick={readArticle}
                style={{ '--read-progress': `${narration.progress}%` } as CSSProperties}
                aria-label={narration.speaking ? `Stop reading, ${Math.round(narration.progress)} percent read` : 'Read article'}
              >
                <span className="dd-read-fill" aria-hidden="true" />
                <span className="dd-read-label">
                  <FontAwesomeIcon icon={narration.speaking ? faStop : faVolumeHigh} />
                  {narration.speaking ? `${Math.round(narration.progress)}% read` : 'Read article'}
                </span>
              </button>
              <button className="dd-speed-btn" onClick={increaseReadSpeed} aria-label={`Reading speed ${readSpeed}x`}>
                <FontAwesomeIcon icon={faGaugeHigh} />
                {readSpeed}x
              </button>
              <button
                className="dd-speed-btn"
                onClick={toggleReadLang}
                aria-label={readLang === 'hi' ? 'Switch narration to English' : 'Switch narration to Hindi'}
              >
                {readLang === 'hi' ? 'हिं' : 'EN'}
              </button>
            </div>
          </section>

          {/* Metadata tags */}
          <div className="dd-meta-row" style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
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

          <section className="dd-why-panel">
            <span>Why it matters for UPSC</span>
            <p>{a.whyItMatters}</p>
          </section>

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
                onClick={async () => {
                  await haptic()
                  setMainsOpen(true)
                }}
              >
                <FontAwesomeIcon icon={faCloudArrowUp} style={{ marginRight: 8 }} />
                Upload answer for evaluation
              </button>
            )}
          </div>

          {/* Prelims Practice */}
          {previewPrelims && previewStem && (
            <div className="dd-practice-gate" style={{ marginTop: 20 }}>
              <div className="dd-practice-unlock">
                <span>Practice unlocked</span>
                <b>{prelimQuestions.length} prelims questions</b>
              </div>
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

          {/* Up Next card */}
          {nextArticle && (
            <button className="dd-upnext" onClick={() => goToArticle(nextArticle)}>
              <div className="dd-upnext-head">
                <span>Up Next · {idx + 2} of {siblings.length}</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </div>
              <div className="dd-upnext-title">{nextArticle.headline}</div>
              <div className="dd-upnext-meta">
                <span
                  className="tag tag-cat"
                  style={{
                    color: CATEGORY_COLORS[nextArticle.category],
                    borderColor: CATEGORY_COLORS[nextArticle.category] + '30',
                    background: CATEGORY_COLORS[nextArticle.category] + '10',
                  }}
                >
                  {nextArticle.category}
                </span>
                <span className="tag tag-gs">{nextArticle.gsPaper}</span>
              </div>
            </button>
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

      {/* Prev / Next article navigation — compact arrows + position */}
      {a && siblings.length > 1 && (
        <div className="dd-navbar">
          <button
            className="dd-nav-arrow"
            disabled={!prevArticle}
            onClick={() => prevArticle && goToArticle(prevArticle)}
            aria-label="Previous article"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span className="dd-nav-count">{idx + 1} <i>of</i> {siblings.length}</span>
          <button
            className="dd-nav-arrow"
            disabled={!nextArticle}
            onClick={() => nextArticle && goToArticle(nextArticle)}
            aria-label="Next article"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}
    </div>
  )
}
