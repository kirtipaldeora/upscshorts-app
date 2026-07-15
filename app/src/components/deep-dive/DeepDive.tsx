import { useState, useRef, useEffect, useMemo } from 'react'
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
import { hasVerifiedHindiDeepDive, splitUPSCStem } from '@/utils/questionQuality'
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

interface StudyNote {
  syllabusLinkage: string
  context: string
  keyHighlights: string[]
  keyConcepts: Array<{ term: string; definition: string }>
  wayForward: string[]
}

const CATEGORY_SYLLABUS: Record<Article['category'], string> = {
  Polity: 'Constitution and Political System',
  Economy: 'Indian Economy',
  'International Relations': 'Bilateral and International Relations',
  Environment: 'Environment and Disaster Management',
  'Science and Tech': 'Science and Technology',
  Governance: 'Governance and Public Policy',
  'Social Issues': 'Indian Society and Social Justice',
  Security: 'Internal and External Security',
  Ethics: 'Ethics, Integrity and Aptitude',
  Schemes: 'Government Policies and Welfare Schemes',
  'Reports and Indices': 'Reports, Data and Development Indicators',
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(value: string) {
  return plainText(value).split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(item => item.length > 24)
}

function unique(items: string[], limit: number) {
  return items.filter((item, index) => items.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index).slice(0, limit)
}

function clip(value: string, length = 240) {
  return value.length <= length ? value : `${value.slice(0, length).replace(/\s+\S*$/, '')}…`
}

function buildStudyNote(article: Article, lang: 'en' | 'hi'): StudyNote | null {
  const dive = article.deepDive
  if (lang === 'hi') {
    if (!hasVerifiedHindiDeepDive(article) || !dive.hindi) return null
    return {
      syllabusLinkage: dive.hindi.syllabusLinkage,
      context: dive.hindi.context,
      keyHighlights: dive.hindi.keyHighlights,
      keyConcepts: dive.hindi.keyConcepts,
      wayForward: dive.hindi.wayForward,
    }
  }
  const explanation = dive.explanation || ''
  const listItems = [...explanation.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => plainText(match[1])).filter(Boolean)
  const sourceSentences = sentences(explanation)
  const keyHighlights = dive.keyHighlights?.filter(Boolean) ?? unique([
    ...sentences(article.summary),
    ...sentences(article.whyItMatters),
    ...listItems,
  ], 5)

  const keyConcepts = dive.keyConcepts?.filter(concept => concept.term && concept.definition) ?? (article.keyTerms ?? []).flatMap(term => {
    const definition = sourceSentences.find(sentence => sentence.toLowerCase().includes(term.toLowerCase()))
    return definition ? [{ term, definition: clip(definition) }] : []
  }).slice(0, 6)

  const callout = explanation.match(/<div\b[^>]*class=['"][^'"]*dd-callout[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''
  const recommended = sourceSentences.filter(sentence => /\b(should|must|need(?:s|ed)?|way forward|recommend|ensure|strengthen|improve|expand|build|reform)\b/i.test(sentence))
  const wayForward = dive.wayForward?.filter(Boolean) ?? unique([
    ...sentences(callout.replace(/way forward\s*:?/i, '')),
    ...recommended,
  ], 6)

  return {
    syllabusLinkage: dive.syllabusLinkage?.trim() || `${article.gsPaper.replace('GS 1', 'GS I').replace('GS 2', 'GS II').replace('GS 3', 'GS III').replace('GS 4', 'GS IV')}: ${CATEGORY_SYLLABUS[article.category]}`,
    context: dive.context?.trim() || article.summary,
    keyHighlights: keyHighlights.length ? keyHighlights : [article.whyItMatters],
    keyConcepts,
    wayForward: wayForward.length ? wayForward : ['No specific recommendation was provided in the source material.'],
  }
}

export function DeepDive({ onShowToast }: DeepDiveProps) {
  const { activeArticle, setActiveArticle, setDeepDiveReturnOverlay, setOverlay, overlayScreen, deepDiveReturnOverlay, articlesByDate, getArticlesForDate, setScreen } = useAppStore()
  const { settings, recordLearningActivity } = usePracticeStore()
  const haptic = useHaptic()
  const narration = useNarration()
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [mainsOpen, setMainsOpen] = useState(false)
  const [readSpeed, setReadSpeed] = useState(1)
  const [readLang, setReadLang] = useState<'en' | 'hi'>(() => {
    try { return localStorage.getItem('penni-read-lang') === 'hi' ? 'hi' : 'en' } catch { return 'en' }
  })
  const bodyRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLSpanElement>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const readThresholdRef = useRef(false)
  const [readThresholdReached, setReadThresholdReached] = useState(false)

  const visible = overlayScreen === 'deep-dive'
  const a = activeArticle
  const hindiAvailable = a ? hasVerifiedHindiDeepDive(a) : false

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
    readThresholdRef.current = false
    setReadThresholdReached(false)
    if (progressBarRef.current) progressBarRef.current.style.width = '0%'
    narration.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id])

  useEffect(() => {
    if (!a || readLang !== 'hi' || hindiAvailable) return
    setReadLang('en')
    try { localStorage.setItem('penni-read-lang', 'en') } catch { /* noop */ }
  }, [a, readLang, hindiAvailable])

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

  function onBodyScroll() {
    if (scrollFrameRef.current !== null) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      const el = bodyRef.current
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      const progress = max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0
      if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`
      if (progress >= 70 && !readThresholdRef.current) {
        readThresholdRef.current = true
        setReadThresholdReached(true)
      }
    })
  }

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  useEffect(() => {
    if (!a || (!readThresholdReached && narration.progress < 85)) return
    if (recordLearningActivity(a.id)) {
      onShowToast('Deep Dive complete. Today’s learning streak is protected.')
    }
  }, [a, readThresholdReached, narration.progress, recordLearningActivity, onShowToast])

  async function goToArticle(article: Article) {
    await haptic()
    setMainsOpen(false)
    setActiveQuiz(null)
    setActiveArticle(article)
  }
  const prelimQuestions = a?.prelimsQs ?? []
  const previewPrelims = prelimQuestions[0]
  const previewStem = previewPrelims ? splitUPSCStem(previewPrelims.q) : null
  const displayedMainsQuestion = readLang === 'hi'
    ? a?.deepDive.hindi?.possibleMainsQuestion ?? ''
    : a?.deepDive.possibleMainsQuestion ?? ''
  const articleMainsQuestion: MainsQuestion | null = displayedMainsQuestion && a ? {
    id: `ma-${a.id}`,
    q: displayedMainsQuestion,
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
    const script = lang === 'hi' ? articleNarrationHi(article) : articleNarration(article)
    if (!script) return false
    return narration.speak(script, {
      lang: lang === 'hi' ? 'hi-IN' : 'en-IN',
      rate: BASE_READ_RATE * speed,
      pitch: speed > 1.25 ? 1.01 : 1.04,
      voiceURI: settings.voiceURI || undefined,
    })
  }

  async function toggleReadLang() {
    if (!a) return
    await haptic()
    const next = readLang === 'en' ? 'hi' : 'en'
    if (next === 'hi' && !hasVerifiedHindiDeepDive(a)) {
      onShowToast('Reviewed Hindi Deep Dive is not available for this article yet')
      return
    }
    setReadLang(next)
    try { localStorage.setItem('penni-read-lang', next) } catch { /* noop */ }
    if (narration.speaking) {
      narration.stop()
      const restarted = startArticleReading(a, readSpeed, next)
      if (!restarted && next === 'hi') onShowToast('Hindi text is ready, but Hindi audio is not available yet')
    }
  }

  async function readArticle() {
    if (!a) return
    await haptic()
    if (narration.speaking) {
      narration.stop()
      return
    }
    if (readLang === 'hi' && !articleNarrationHi(a)) {
      onShowToast('Hindi audio is not available for this article yet')
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
  const studyNote = useMemo(() => a ? buildStudyNote(a, readLang) : null, [a, readLang])
  const noteLabels = readLang === 'hi'
    ? {
        syllabus: 'पाठ्यक्रम संबंध',
        context: 'संदर्भ',
        highlights: 'मुख्य बिंदु',
        concepts: 'प्रमुख अवधारणाएँ',
        wayForward: 'आगे की राह',
        mains: 'संभावित मुख्य परीक्षा प्रश्न',
        upload: 'उत्तर मूल्यांकन के लिए अपलोड करें',
        noConcepts: 'इस लेख में किसी अलग तकनीकी अवधारणा की परिभाषा आवश्यक नहीं है।',
      }
    : {
        syllabus: 'Syllabus Linkage',
        context: 'Context',
        highlights: 'Key Highlights',
        concepts: 'Key Concepts',
        wayForward: 'Way Forward',
        mains: 'Expected Mains Question',
        upload: 'Upload answer for evaluation',
        noConcepts: 'No separate technical concept needs definition for this article.',
      }

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
    const qs = articleQs([a])
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
        <div className="dd-progress" aria-hidden="true"><span ref={progressBarRef} /></div>
      </div>

      {/* Body */}
      {a && (
        <div className="dd-body" ref={bodyRef} onScroll={onBodyScroll}>
          <section className="dd-reader-hero">
            <h1>{a.headline}</h1>
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
                className={`dd-lang-toggle ${readLang === 'hi' ? 'hi' : ''} ${!hindiAvailable ? 'unavailable' : ''}`}
                onClick={toggleReadLang}
                role="switch"
                aria-checked={readLang === 'hi'}
                aria-label={readLang === 'hi' ? 'Switch the Deep Dive to English' : 'Switch the Deep Dive to Hindi'}
                title={hindiAvailable ? 'Change Deep Dive language' : 'Reviewed Hindi translation not available yet'}
              >
                <span>EN</span>
                <span>हिं</span>
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

          {studyNote && (
            <div className="dd-study-note">
              <section className="dd-study-row">
                <h3>{noteLabels.syllabus}</h3>
                <div><p>{studyNote.syllabusLinkage}</p></div>
              </section>
              <section className="dd-study-row">
                <h3>{noteLabels.context}</h3>
                <div><p>{studyNote.context}</p></div>
              </section>
              <section className="dd-study-row">
                <h3>{noteLabels.highlights}</h3>
                <div><ul>{studyNote.keyHighlights.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              </section>
              <section className="dd-study-row">
                <h3>{noteLabels.concepts}</h3>
                <div>
                  {studyNote.keyConcepts.length > 0
                    ? <ul>{studyNote.keyConcepts.map(concept => <li key={concept.term}><strong>{concept.term}:</strong> {concept.definition}</li>)}</ul>
                    : <p>{noteLabels.noConcepts}</p>}
                </div>
              </section>
              <section className="dd-study-row">
                <h3>{noteLabels.wayForward}</h3>
                <div><ul>{studyNote.wayForward.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              </section>
            </div>
          )}

          <div className="dd-divider"></div>

          {/* Expected Mains Question */}
          <div>
            <div className="dd-section-title">
              <FontAwesomeIcon icon={faPenFancy} style={{ marginRight: 6 }} />
              {noteLabels.mains}
            </div>
            <div className="dd-question">{displayedMainsQuestion}</div>
            {articleMainsQuestion && (
              <button
                className="pn-btn dd-mains-eval-btn"
                onClick={async () => {
                  await haptic()
                  setMainsOpen(true)
                }}
              >
                <FontAwesomeIcon icon={faCloudArrowUp} style={{ marginRight: 8 }} />
                {noteLabels.upload}
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
                    <ol className="upsc-statement-list">
                      {previewStem.statements.map((statement, i) => (
                        <li key={i}>
                          <span className="upsc-statement-label">{previewStem.statementLabels[i] ?? i + 1}</span>
                          <span className="upsc-statement-text">{statement}</span>
                        </li>
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
