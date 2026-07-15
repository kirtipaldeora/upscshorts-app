import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark as faBookmarkSolid,
  faBookOpen,
  faCheck,
  faChevronDown,
  faChevronRight,
  faMagnifyingGlass,
  faPlay,
  faRotateLeft,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkRegular } from '@fortawesome/free-regular-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useAllArticles } from '@/hooks/useAllArticles'
import { articleQs, CURRENT_AFFAIRS_MCQ_START, seededPick } from '@/utils/practiceUtils'
import type { Question } from '@/utils/practiceUtils'
import type { Article } from '@/types/article'
import { splitUPSCStem } from '@/utils/questionQuality'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { relatedPyqs } from '@/utils/questionLinks'
import { buildRecallCards } from '@/utils/recallCards'
import type { RecallCard, RecallPrompt } from '@/utils/recallCards'
import { loadPyqManifest, loadPyqYears } from '@/utils/pyqData'
import type { PyqItem } from '@/stores/usePracticeStore'

type VaultMode = 'recall' | 'questions' | 'articles'
type PracticeCount = 10 | 20 | 50 | 'all'
type StatusFilter = 'all' | 'unattempted' | 'incorrect' | 'bookmarked'
type QuestionEntry = { question: Question; article: Article; number: number }
type RecallScope = 'due' | 'mistakes' | 'new' | 'bookmarked' | 'selection' | `article:${string}`
type RecallChoice = 'accurate' | 'inaccurate' | 'unsure'
type RecallPromptProgress = {
  attempts: number
  correct: number
  correctStreak: number
  lapses: number
  lastChoice: RecallChoice
}
type RecallProgress = {
  dueOn: string
  intervalDays: number
  repetitions: number
  lapses: number
  consecutivePerfect: number
  promptStats: Record<string, RecallPromptProgress>
  history: Array<{ reviewedAt: number; correct: number; total: number; missedPromptIds: string[] }>
}
type RecallProgressMap = Record<string, RecallProgress>

const RECALL_CHOICES: Array<{ value: RecallChoice; label: string }> = [
  { value: 'accurate', label: 'Accurate' },
  { value: 'inaccurate', label: 'Inaccurate' },
  { value: 'unsure', label: 'Not sure' },
]

const RECALL_KIND_LABEL: Record<RecallPrompt['kind'], string> = {
  news: 'News fact',
  trap: 'Exam trap',
  static: 'Static link',
}

function loadVaultMode(): VaultMode {
  const value = localStorage.getItem('penni.ca-vault.mode')
  localStorage.removeItem('penni.ca-vault.mode')
  return value === 'questions' || value === 'articles' ? value : 'recall'
}

function articleTopics(article: Article) {
  const topics = (article.keyTerms ?? []).map(term => term.trim()).filter(Boolean)
  return topics.length ? topics : [article.category]
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function indiaDateIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function addIndiaDays(days: number) {
  const [year, month, day] = indiaDateIso().split('-').map(Number)
  return indiaDateIso(new Date(Date.UTC(year, month - 1, day + days, 6)))
}

function loadRecallProgress(): RecallProgressMap {
  try { return JSON.parse(localStorage.getItem('penni.ca-recall.progress.v2') || '{}') as RecallProgressMap } catch { return {} }
}

function loadRecallBookmarks(): string[] {
  try { return JSON.parse(localStorage.getItem('penni.ca-recall.bookmarks.v1') || '[]') as string[] } catch { return [] }
}

function loadRecallSelection(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem('penni.ca-recall.selection.v1') || '[]') as string[]
    localStorage.removeItem('penni.ca-recall.selection.v1')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function loadRecallScope(): RecallScope {
  const value = localStorage.getItem('penni.ca-recall.scope') ?? 'new'
  localStorage.removeItem('penni.ca-recall.scope')
  if (value === 'due' || value === 'mistakes' || value === 'new' || value === 'bookmarked' || value === 'selection' || value.startsWith('article:')) return value as RecallScope
  return 'new'
}

function recallAnswerIsCorrect(prompt: RecallPrompt, choice: RecallChoice | undefined) {
  if (!choice || choice === 'unsure') return false
  return (choice === 'accurate') === prompt.verdict
}

function reviewDateLabel(date: string) {
  if (!date) return ''
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function cardNeedsReview(card: RecallCard, progress?: RecallProgress) {
  if (!progress) return false
  return card.prompts.some(prompt => {
    const promptProgress = progress.promptStats[prompt.id]
    const lapses = promptProgress?.lapses ?? Math.max(0, (promptProgress?.attempts ?? 0) - (promptProgress?.correct ?? 0))
    return lapses > 0 && promptProgress.correctStreak < 2
  })
}

function QuestionStem({ text, compact = false }: { text: string; compact?: boolean }) {
  const structured = splitUPSCStem(text)
  if (!structured.statements.length) return <p className="pyqv-question-text">{text}</p>
  return (
    <div className={`pyqv-question-text structured ${compact ? 'compact' : ''}`}>
      {structured.lead && <p>{structured.lead}</p>}
      <ol className="upsc-statement-list">
        {structured.statements.map((statement, index) => (
          <li key={index}>
            <span className="upsc-statement-label">{structured.statementLabels[index] ?? index + 1}</span>
            <span className="upsc-statement-text">{statement}</span>
          </li>
        ))}
      </ol>
      {structured.ask && <p className="qz-ask">{structured.ask}</p>}
    </div>
  )
}

export function ReviseScreen() {
  const { setScreen, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const { toggle, isBookmarked } = useBookmarkStore()
  const { stats, questionBookmarks, toggleQbm, pyqData, pyqReady, setPyqData } = usePracticeStore()
  const [mode, setMode] = useState<VaultMode>(loadVaultMode)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [subject, setSubject] = useState('all')
  const [gsPaper, setGsPaper] = useState('all')
  const [subtopic, setSubtopic] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [practiceCount, setPracticeCount] = useState<PracticeCount>(10)
  const [visibleCount, setVisibleCount] = useState(24)
  const [quizQuestions, setQuizQuestions] = useState<Question[] | null>(null)
  const [selected, setSelected] = useState<QuestionEntry | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [toast, setToast] = useState('')
  const [recallProgress, setRecallProgress] = useState<RecallProgressMap>(loadRecallProgress)
  const [recallAnswers, setRecallAnswers] = useState<Record<string, RecallChoice>>({})
  const [recallFlipped, setRecallFlipped] = useState(false)
  const [recallBookmarks, setRecallBookmarks] = useState<string[]>(loadRecallBookmarks)
  const [recallSelection] = useState<string[]>(loadRecallSelection)
  const [sessionReviewed, setSessionReviewed] = useState<string[]>([])
  const [recallScope, setRecallScope] = useState<RecallScope>(loadRecallScope)
  const [activeRecallId, setActiveRecallId] = useState<string | null>(null)
  const recallCommittedRef = useRef(false)
  const recallAnswersRef = useRef<Record<string, RecallChoice>>({})
  const recallBackRef = useRef<HTMLElement>(null)
  useAllArticles()

  useEffect(() => {
    if (pyqReady && pyqData.length > 1000) return
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
  }, [pyqData.length, pyqReady, setPyqData])

  const allArticles = useMemo(
    () => Object.values(articlesByDate).flat().sort((a, b) => b.date.localeCompare(a.date)),
    [articlesByDate],
  )

  const archiveArticles = useMemo(() => allArticles.filter(article => article.date >= CURRENT_AFFAIRS_MCQ_START), [allArticles])
  const entries = useMemo(() => archiveArticles.flatMap(article =>
    articleQs([article]).map((question, number) => ({ question, article, number: number + 1 }))), [archiveArticles])

  const years = useMemo(() => [...new Set(archiveArticles.map(article => article.date.slice(0, 4)))].sort().reverse(), [archiveArticles])
  const months = useMemo(() => [...new Set(archiveArticles
    .filter(article => year === 'all' || article.date.startsWith(year))
    .map(article => article.date.slice(0, 7)))].sort().reverse(), [archiveArticles, year])
  const subjects = useMemo(() => [...new Set(archiveArticles
    .filter(article => year === 'all' || article.date.startsWith(year))
    .filter(article => month === 'all' || article.date.startsWith(month))
    .map(article => article.category))].sort(), [archiveArticles, month, year])
  const subtopics = useMemo(() => {
    const counts = new Map<string, number>()
    archiveArticles
      .filter(article => year === 'all' || article.date.startsWith(year))
      .filter(article => month === 'all' || article.date.startsWith(month))
      .filter(article => subject === 'all' || article.category === subject)
      .forEach(article => articleTopics(article).forEach(topic => counts.set(topic, (counts.get(topic) ?? 0) + 1)))
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label))
  }, [archiveArticles, month, subject, year])

  const normalizedQuery = query.trim().toLowerCase()
  const recallCards = useMemo(() => buildRecallCards(archiveArticles), [archiveArticles])
  const recallFilteredCards = recallCards.filter(card => {
    if (!articleMatches(card.article)) return false
    if (!normalizedQuery) return true
    return [card.article.headline, card.article.summary, card.article.category, card.article.gsPaper, ...articleTopics(card.article)]
      .join(' ').toLowerCase().includes(normalizedQuery)
  })
  const today = indiaDateIso()
  const recallSetCards = recallFilteredCards.filter(card => {
    const progress = recallProgress[card.id]
    if (recallScope.startsWith('article:')) return card.article.id === recallScope.slice(8)
    if (recallScope === 'selection') return recallSelection.includes(card.article.id)
    if (recallScope === 'due') return Boolean(progress && progress.dueOn <= today)
    if (recallScope === 'mistakes') return cardNeedsReview(card, progress)
    if (recallScope === 'bookmarked') return recallBookmarks.includes(card.id)
    return !progress
  }).sort((left, right) => {
    const leftProgress = recallProgress[left.id]
    const rightProgress = recallProgress[right.id]
    const gapDifference = Number(cardNeedsReview(right, rightProgress)) - Number(cardNeedsReview(left, leftProgress))
    if (gapDifference) return gapDifference
    const lapseDifference = (rightProgress?.lapses ?? 0) - (leftProgress?.lapses ?? 0)
    if (lapseDifference) return lapseDifference
    const dueDifference = (leftProgress?.dueOn ?? '').localeCompare(rightProgress?.dueOn ?? '')
    return dueDifference || right.article.date.localeCompare(left.article.date)
  })
  const recallQueue = sessionReviewed.length >= 20
    ? []
    : recallSetCards.filter(card => !sessionReviewed.includes(card.id)).slice(0, Math.max(20 - sessionReviewed.length, 0))
  const recallCard = recallCards.find(card => card.id === activeRecallId) ?? recallQueue[0]
  const learnedRecallCount = recallCards.filter(card => recallProgress[card.id]?.repetitions > 0 && !cardNeedsReview(card, recallProgress[card.id])).length
  const recallDueCount = recallCards.filter(card => recallProgress[card.id]?.dueOn <= today).length
  const recallNewCount = recallCards.filter(card => !recallProgress[card.id]).length
  const recallMistakeCount = recallCards.filter(card => cardNeedsReview(card, recallProgress[card.id])).length
  const recallBookmarkCount = recallCards.filter(card => recallBookmarks.includes(card.id)).length

  function articleMatches(article: Article) {
    if (year !== 'all' && !article.date.startsWith(year)) return false
    if (month !== 'all' && !article.date.startsWith(month)) return false
    if (subject !== 'all' && article.category !== subject) return false
    if (gsPaper !== 'all' && article.gsPaper !== gsPaper) return false
    if (subtopic !== 'all' && !articleTopics(article).includes(subtopic)) return false
    return true
  }

  const questionResults = useMemo(() => entries.filter(entry => {
    if (!articleMatches(entry.article)) return false
    const answer = stats.a[entry.question.id]
    const bookmarked = questionBookmarks.includes(entry.question.id) || isBookmarked(entry.article.id)
    if (status === 'unattempted' && answer) return false
    if (status === 'incorrect' && answer?.[0] !== 0) return false
    if (status === 'bookmarked' && !bookmarked) return false
    if (!normalizedQuery) return true
    return [entry.question.q, entry.article.headline, entry.article.category, entry.article.gsPaper, ...articleTopics(entry.article)]
      .join(' ').toLowerCase().includes(normalizedQuery)
  }), [entries, gsPaper, month, normalizedQuery, questionBookmarks, stats.a, status, subject, subtopic, year])

  const articleResults = useMemo(() => archiveArticles.filter(article => {
    if (!articleMatches(article)) return false
    const articleQuestionIds = articleQs([article]).map(question => question.id)
    if (status === 'unattempted' && articleQuestionIds.some(id => stats.a[id])) return false
    if (status === 'incorrect' && !articleQuestionIds.some(id => stats.a[id]?.[0] === 0)) return false
    if (status === 'bookmarked' && !isBookmarked(article.id) && !articleQuestionIds.some(id => questionBookmarks.includes(id))) return false
    if (!normalizedQuery) return true
    return [article.headline, article.summary, article.category, article.gsPaper, ...articleTopics(article)]
      .join(' ').toLowerCase().includes(normalizedQuery)
  }), [archiveArticles, gsPaper, month, normalizedQuery, questionBookmarks, stats.a, status, subject, subtopic, year])

  const attempted = questionResults.filter(entry => stats.a[entry.question.id]).length
  const incorrect = questionResults.filter(entry => stats.a[entry.question.id]?.[0] === 0).length
  const resultCount = mode === 'recall' ? recallQueue.length : mode === 'questions' ? questionResults.length : articleResults.length
  const relatedPyqsByArticle = useMemo(() => {
    const links = new Map<string, ReturnType<typeof relatedPyqs>>()
    if (pyqData.length < 1000) return links
    archiveArticles.forEach(article => {
      const representative = articleQs([article])[0]
      if (!representative) return
      const related = relatedPyqs(article, representative, pyqData, 2)
      if (related.length) links.set(article.id, related)
    })
    return links
  }, [archiveArticles, pyqData])
  const selectedRelatedPyqs = selected ? relatedPyqsByArticle.get(selected.article.id) ?? [] : []
  const recallSourceQuestion = recallCard ? articleQs([recallCard.article])[0] : undefined
  const recallRelatedPyqs = recallCard && recallSourceQuestion
    ? relatedPyqsByArticle.get(recallCard.article.id) ?? []
    : []
  const recallAnsweredCount = Object.keys(recallAnswers).length
  const recallCorrectCount = recallCard
    ? recallCard.prompts.filter(prompt => recallAnswerIsCorrect(prompt, recallAnswers[prompt.id])).length
    : 0
  const recallGapCount = recallCard ? recallCard.prompts.length - recallCorrectCount : 0
  const recallNextReview = recallCard ? recallProgress[recallCard.id]?.dueOn : undefined

  useEffect(() => { setSubtopic('all') }, [year, month, subject])
  useEffect(() => { setVisibleCount(24) }, [year, month, subject, gsPaper, subtopic, status, query, mode])
  useEffect(() => {
    if (!recallFlipped) return
    const frame = window.requestAnimationFrame(() => recallBackRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [recallFlipped])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  function clearFilters() {
    setYear('all')
    setMonth('all')
    setSubject('all')
    setGsPaper('all')
    setSubtopic('all')
    setStatus('all')
    setQuery('')
  }

  function startPractice(pool = questionResults.map(entry => entry.question), count: PracticeCount = practiceCount) {
    if (!pool.length) { showToast('No questions match this selection'); return }
    const requested = count === 'all' ? pool.length : count
    setQuizQuestions(seededPick(pool, Math.min(requested, pool.length), `ca-vault-${Date.now()}`))
    setSelected(null)
  }

  function openArticle(article: Article) {
    setActiveArticle(article)
    setOverlay('deep-dive')
  }

  function switchMode(next: VaultMode) {
    setMode(next)
    setRecallAnswers({})
    recallAnswersRef.current = {}
    setRecallFlipped(false)
    setActiveRecallId(null)
    recallCommittedRef.current = false
  }

  function switchRecallSet(next: RecallScope) {
    setRecallScope(next)
    setSessionReviewed([])
    setRecallAnswers({})
    recallAnswersRef.current = {}
    setRecallFlipped(false)
    setActiveRecallId(null)
    recallCommittedRef.current = false
  }

  function saveRecallOutcome(card: RecallCard, answers: Record<string, RecallChoice>) {
    setRecallProgress(current => {
      const previous = current[card.id]
      const missedPromptIds = card.prompts
        .filter(prompt => !recallAnswerIsCorrect(prompt, answers[prompt.id]))
        .map(prompt => prompt.id)
      const correct = card.prompts.length - missedPromptIds.length
      const perfect = missedPromptIds.length === 0
      const consecutivePerfect = perfect ? (previous?.consecutivePerfect ?? 0) + 1 : 0
      const previousInterval = previous?.intervalDays ?? 0
      const intervalDays = !perfect
        ? 1
        : consecutivePerfect === 1
          ? 3
          : consecutivePerfect === 2
            ? 7
            : Math.min(60, Math.max(14, previousInterval * 2))
      const promptStats = { ...(previous?.promptStats ?? {}) }

      card.prompts.forEach(prompt => {
        const before = promptStats[prompt.id]
        const remembered = recallAnswerIsCorrect(prompt, answers[prompt.id])
        promptStats[prompt.id] = {
          attempts: (before?.attempts ?? 0) + 1,
          correct: (before?.correct ?? 0) + Number(remembered),
          correctStreak: remembered ? (before?.correctStreak ?? 0) + 1 : 0,
          lapses: (before?.lapses ?? Math.max(0, (before?.attempts ?? 0) - (before?.correct ?? 0))) + Number(!remembered),
          lastChoice: answers[prompt.id] ?? 'unsure',
        }
      })

      const next: RecallProgressMap = {
        ...current,
        [card.id]: {
          dueOn: addIndiaDays(intervalDays),
          intervalDays,
          repetitions: (previous?.repetitions ?? 0) + 1,
          lapses: (previous?.lapses ?? 0) + Number(!perfect),
          consecutivePerfect,
          promptStats,
          history: [...(previous?.history ?? []), {
            reviewedAt: Date.now(),
            correct,
            total: card.prompts.length,
            missedPromptIds,
          }].slice(-50),
        },
      }
      localStorage.setItem('penni.ca-recall.progress.v2', JSON.stringify(next))
      return next
    })
  }

  function selectRecallAnswer(promptId: string, choice: RecallChoice) {
    if (!recallCard || recallFlipped || recallCommittedRef.current) return
    setActiveRecallId(recallCard.id)
    const next = { ...recallAnswersRef.current, [promptId]: choice }
    recallAnswersRef.current = next
    setRecallAnswers(next)
    if (Object.keys(next).length === recallCard.prompts.length) {
      recallCommittedRef.current = true
      saveRecallOutcome(recallCard, next)
      window.setTimeout(() => setRecallFlipped(true), 320)
    }
  }

  function toggleRecallBookmark(cardId: string) {
    const next = recallBookmarks.includes(cardId)
      ? recallBookmarks.filter(id => id !== cardId)
      : [...recallBookmarks, cardId]
    setRecallBookmarks(next)
    localStorage.setItem('penni.ca-recall.bookmarks.v1', JSON.stringify(next))
    showToast(next.includes(cardId) ? 'Recall card saved' : 'Recall card removed')
  }

  function nextRecallCard() {
    if (!recallCard) return
    setSessionReviewed(items => [...items, recallCard.id])
    setRecallAnswers({})
    recallAnswersRef.current = {}
    setRecallFlipped(false)
    setActiveRecallId(null)
    recallCommittedRef.current = false
  }

  if (quizQuestions) {
    return (
      <QuizPlayer
        title="Current Affairs Practice"
        eyebrow="Current Affairs Vault"
        description="A topic-filtered UPSC-style test built from your current-affairs archive."
        questions={quizQuestions}
        onClose={() => setQuizQuestions(null)}
        onShowToast={showToast}
      />
    )
  }

  return (
    <div className="pyqv-shell ca-vault-shell">
      <header className="pyqv-header">
        <button className="pyqv-icon-btn" onClick={() => setScreen('feed')} aria-label="Close Current Affairs Vault">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <span>Year-round revision library</span>
          <h2><span className="ca-vault-title-full">Current Affairs Vault</span><span className="ca-vault-title-short">CA Vault</span></h2>
        </div>
        <div className="pyqv-mode-switch" role="tablist" aria-label="Library view">
          <button className={mode === 'recall' ? 'active' : ''} onClick={() => switchMode('recall')}>Recall</button>
          <button className={mode === 'questions' ? 'active' : ''} onClick={() => switchMode('questions')}>Questions</button>
          <button className={mode === 'articles' ? 'active' : ''} onClick={() => switchMode('articles')}>Articles</button>
        </div>
      </header>

      <main className="pyqv-main">
        <section className="pyqv-overview">
          <div className="pyqv-overview-copy">
            <span>Current Affairs Vault</span>
            <h3>{mode === 'recall' ? 'Remember it when the exam asks.' : mode === 'questions' ? 'Build a precise topic set.' : 'Read the archive without the clutter.'}</h3>
            <p>{mode === 'recall'
              ? 'Each story becomes one flippable memory card: judge three short statements, then turn it over for the facts, traps and static link.'
              : mode === 'questions'
                ? 'Filter by year, month, GS paper, subject or sub-topic. Mistakes and saved questions become focused revision sets.'
                : 'A clean dated reading archive from 15 July 2026 onward, organised by subject and linked to each deep dive.'}</p>
          </div>
          <div className="pyqv-metrics">
            {mode === 'recall' ? <>
              <div><b>{recallSetCards.length}</b><span>{recallScope === 'due' ? 'cards due' : 'in this set'}</span></div>
              <div><b>{sessionReviewed.length}</b><span>reviewed now</span></div>
              <div><b>{learnedRecallCount}</b><span>retained</span></div>
            </> : mode === 'questions' ? <>
              <div><b>{resultCount}</b><span>in selection</span></div>
              <div><b>{attempted}</b><span>attempted</span></div>
              <div><b>{incorrect}</b><span>to revise</span></div>
            </> : <>
              <div><b>{articleResults.length}</b><span>articles</span></div>
              <div><b>{new Set(articleResults.map(article => article.category)).size}</b><span>subjects</span></div>
              <div><b>{articleResults.filter(article => isBookmarked(article.id)).length}</b><span>saved</span></div>
            </>}
          </div>
        </section>

        {mode === 'recall' && (
          <>
            <section className="ca-recall-setbar" aria-label="Recall sets">
              <div>
                <button className={recallScope === 'due' ? 'active' : ''} onClick={() => switchRecallSet('due')}><b>Due</b><span>{recallDueCount} today</span></button>
                <button className={recallScope === 'mistakes' ? 'active' : ''} onClick={() => switchRecallSet('mistakes')}><b>Needs review</b><span>{recallMistakeCount} cards</span></button>
                <button className={recallScope === 'new' ? 'active' : ''} onClick={() => switchRecallSet('new')}><b>New</b><span>{recallNewCount} cards</span></button>
                <button className={recallScope === 'bookmarked' ? 'active' : ''} onClick={() => switchRecallSet('bookmarked')}><b>Saved</b><span>{recallBookmarkCount} cards</span></button>
              </div>
              <p><b>How Recall works:</b> judge all three statements. Your responses lock, the card flips, and missed facts automatically return in Needs review.</p>
            </section>

            <section className="ca-recall-filterbar" aria-label="Filter recall cards">
              <div className="pyqv-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a story or concept" />{query && <button onClick={() => setQuery('')} aria-label="Clear recall search"><FontAwesomeIcon icon={faXmark} /></button>}</div>
              <label><span>Subject</span><div><select value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Topic</span><div><select value={subtopic} onChange={event => setSubtopic(event.target.value)}><option value="all">All topics</option>{subtopics.map(item => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              {(query || subject !== 'all' || subtopic !== 'all') && <button className="pyqv-reset" onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset</button>}
            </section>
          </>
        )}

        {mode === 'questions' && <section className="pyqv-controls" aria-label="Current affairs filters">
          <div className="pyqv-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions, issues, concepts or sub-topics" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><FontAwesomeIcon icon={faXmark} /></button>}
          </div>

          <div className="pyqv-filter-grid ca-vault-filters">
            <label><span>Year</span><div><select value={year} onChange={event => { setYear(event.target.value); setMonth('all') }}><option value="all">All years</option>{years.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Month</span><div><select value={month} onChange={event => setMonth(event.target.value)}><option value="all">All months</option>{months.map(item => <option key={item} value={item}>{monthLabel(item)}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>GS paper</span><div><select value={gsPaper} onChange={event => setGsPaper(event.target.value)}><option value="all">All GS papers</option>{['GS 1', 'GS 2', 'GS 3', 'GS 4'].map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Subject</span><div><select value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Sub-topic</span><div><select value={subtopic} onChange={event => setSubtopic(event.target.value)}><option value="all">All sub-topics</option>{subtopics.map(item => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            <label><span>Revision status</span><div><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">All content</option><option value="unattempted">Not attempted</option><option value="incorrect">Incorrect answers</option><option value="bookmarked">Bookmarked</option></select><FontAwesomeIcon icon={faChevronDown} /></div></label>
          </div>

          <div className="pyqv-control-footer">
            <div className="ca-vault-active-filter">{subtopic !== 'all' ? subtopic : subject !== 'all' ? subject : 'All current affairs'}</div>
            <button className="pyqv-reset" onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset filters</button>
          </div>
        </section>}

        {mode === 'articles' && (
          <section className="ca-article-toolbar">
            <div className="pyqv-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the article archive" />{query && <button onClick={() => setQuery('')}><FontAwesomeIcon icon={faXmark} /></button>}</div>
            <div className="ca-article-filter-grid">
              <label><span>Year</span><div><select value={year} onChange={event => { setYear(event.target.value); setMonth('all') }}><option value="all">All years</option>{years.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Month</span><div><select value={month} onChange={event => setMonth(event.target.value)}><option value="all">All months</option>{months.map(item => <option key={item} value={item}>{monthLabel(item)}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>GS paper</span><div><select value={gsPaper} onChange={event => setGsPaper(event.target.value)}><option value="all">All GS papers</option>{['GS 1', 'GS 2', 'GS 3', 'GS 4'].map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Topic</span><div><select value={subtopic} onChange={event => setSubtopic(event.target.value)}><option value="all">All topics</option>{subtopics.map(item => <option key={item.label} value={item.label}>{item.label} ({item.count})</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></div></label>
              <label><span>Saved</span><div><select value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">All articles</option><option value="bookmarked">Bookmarked only</option></select><FontAwesomeIcon icon={faChevronDown} /></div></label>
            </div>
            <div className="ca-article-subjects"><button className={subject === 'all' ? 'active' : ''} onClick={() => setSubject('all')}>All</button>{subjects.map(item => <button key={item} className={subject === item ? 'active' : ''} onClick={() => setSubject(item)}>{item}</button>)}</div>
            <div className="ca-article-filter-footer"><span>{articleResults.length} articles match</span><button onClick={clearFilters}><FontAwesomeIcon icon={faRotateLeft} /> Reset</button></div>
          </section>
        )}

        {mode === 'questions' && (
          <section className="pyqv-practice-bar">
            <div><span>Build a topic test</span><b>{questionResults.length ? `${practiceCount === 'all' ? questionResults.length : Math.min(practiceCount, questionResults.length)} questions from this selection` : 'Adjust filters to find questions'}</b></div>
            <div className="pyqv-count-picker" aria-label="Question count">
              {[10, 20, 50].map(count => <button key={count} className={practiceCount === count ? 'active' : ''} onClick={() => setPracticeCount(count as PracticeCount)}>{count}</button>)}
            </div>
            <button className="pyqv-start" onClick={() => startPractice()} disabled={!questionResults.length}><FontAwesomeIcon icon={faPlay} /> Start test</button>
          </section>
        )}

        {mode === 'recall' ? (
          <section className="ca-recall-workspace">
            {recallCard ? (
              <article className="ca-recall-card newspaper-card">
                <div className="ca-recall-meta">
                  <span>Newspaper card · {recallCard.article.date} · {recallCard.article.category}</span>
                  <div><small>{recallAnsweredCount}/{recallCard.prompts.length} judged</small><button className={recallBookmarks.includes(recallCard.id) ? 'active' : ''} onClick={() => toggleRecallBookmark(recallCard.id)} aria-label={recallBookmarks.includes(recallCard.id) ? 'Remove saved recall card' : 'Save recall card'}><FontAwesomeIcon icon={recallBookmarks.includes(recallCard.id) ? faBookmarkSolid : faBookmarkRegular} /></button></div>
                </div>
                <div className={`ca-recall-flip ${recallFlipped ? 'is-flipped' : ''}`}>
                  <div className="ca-recall-flip-inner">
                    <section className="ca-recall-face ca-recall-front">
                      <div className="ca-recall-news"><span>Story you read</span><h3>{recallCard.article.headline}</h3><p>What do you still remember? Judge each statement without reopening the article.</p></div>
                      <div className="ca-recall-prompts">
                        {recallCard.prompts.map((prompt, promptIndex) => (
                          <fieldset className={`ca-recall-mini kind-${prompt.kind}`} key={prompt.id}>
                            <legend><span>{RECALL_KIND_LABEL[prompt.kind]}</span><b>{promptIndex + 1} of {recallCard.prompts.length}</b></legend>
                            <p>{prompt.statement}</p>
                            <div className="ca-recall-mini-options">
                              {RECALL_CHOICES.map(choice => (
                                <button
                                  className={recallAnswers[prompt.id] === choice.value ? 'selected' : ''}
                                  key={choice.value}
                                  onClick={() => selectRecallAnswer(prompt.id, choice.value)}
                                  aria-pressed={recallAnswers[prompt.id] === choice.value}
                                  disabled={recallCommittedRef.current}
                                >
                                  {choice.label}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                      {recallRelatedPyqs.length > 0 && (
                        <details className="ca-recall-pyq-signal">
                          <summary><span>PYQ precedent</span><b>{recallRelatedPyqs.length === 1 ? `Related PYQ · UPSC ${recallRelatedPyqs[0].item.year}` : `${recallRelatedPyqs.length} closely related UPSC PYQs`}</b><FontAwesomeIcon icon={faChevronDown} /></summary>
                          <div>{recallRelatedPyqs.map(({ item, reason }) => <p key={item.id}><span>UPSC {item.year}</span><b>{item.question}</b><i>{reason}</i></p>)}</div>
                        </details>
                      )}
                      <div className="ca-recall-front-note">
                        {recallAnsweredCount === recallCard.prompts.length
                          ? <button onClick={() => setRecallFlipped(true)}>Flip to review</button>
                          : <span>Judge {recallCard.prompts.length - recallAnsweredCount} more statement{recallCard.prompts.length - recallAnsweredCount === 1 ? '' : 's'} to flip</span>}
                      </div>
                    </section>

                    <section className="ca-recall-face ca-recall-back" ref={recallBackRef} tabIndex={-1} aria-label="Recall card review">
                      <div className="ca-recall-back-head">
                        <span>Card revealed</span>
                        <h3>{recallCorrectCount} of {recallCard.prompts.length} retained · {recallGapCount} gap{recallGapCount === 1 ? '' : 's'}</h3>
                        <p>{recallGapCount ? 'Missed and unsure facts have been added to Needs review.' : 'Clean recall. The interval has increased automatically.'}</p>
                        <button onClick={() => setRecallFlipped(false)}>See the prompts</button>
                      </div>
                      <div className="ca-recall-review-grid">
                        {recallCard.prompts.map(prompt => {
                          const correct = recallAnswerIsCorrect(prompt, recallAnswers[prompt.id])
                          const choiceLabel = RECALL_CHOICES.find(choice => choice.value === recallAnswers[prompt.id])?.label ?? 'Not answered'
                          return <article className={correct ? 'correct' : 'wrong'} key={prompt.id}><span>{RECALL_KIND_LABEL[prompt.kind]} · {correct ? 'Retained' : 'Review this'}</span><h4>{prompt.statement}</h4><div><p><b>You chose</b>{choiceLabel}</p><p><b>Verdict</b>{prompt.verdict ? 'Accurate' : 'Inaccurate'}</p></div><em>{prompt.rationale}</em></article>
                        })}
                      </div>
                      <div className="ca-recall-takeaway">
                        <div><span>What happened</span><p>{recallCard.article.deepDive.context ?? recallCard.article.summary}</p></div>
                        <div><span>Static anchor</span><ul>{(recallCard.article.deepDive.keyConcepts ?? []).slice(0, 2).map(concept => <li key={concept.term}><b>{concept.term}</b> — {concept.definition}</li>)}</ul></div>
                        <div><span>Why UPSC cares</span><p>{recallCard.article.whyItMatters}</p><i>{recallCard.article.deepDive.syllabusLinkage ?? `${recallCard.article.gsPaper}: ${recallCard.article.category}`}</i></div>
                        {recallNextReview && <div className="ca-recall-next"><span>Scheduled automatically</span><p>Next review · {reviewDateLabel(recallNextReview)}</p></div>}
                      </div>
                      <div className="ca-recall-actions"><button className="ca-recall-read" onClick={() => openArticle(recallCard.article)}><FontAwesomeIcon icon={faBookOpen} /> Read deep dive</button><button className="ca-recall-next-card" onClick={nextRecallCard}>Next card <FontAwesomeIcon icon={faChevronRight} /></button></div>
                    </section>
                  </div>
                </div>
              </article>
            ) : (
              <div className="ca-recall-complete"><FontAwesomeIcon icon={faCheck} /><span>Recall set clear</span><h3>No cards are waiting here.</h3><p>Your next reviews are scheduled automatically. New cards, saved cards and recall gaps stay in their own queues.</p>{sessionReviewed.length > 0 && <button onClick={() => { setSessionReviewed([]); setActiveRecallId(null); recallCommittedRef.current = false }}>Review this set again</button>}{recallScope !== 'due' && <button onClick={() => switchRecallSet('due')}>Go to cards due</button>}{recallScope !== 'new' && recallNewCount > 0 && <button onClick={() => switchRecallSet('new')}>Learn new cards</button>}</div>
            )}
          </section>
        ) : <>
        <div className="pyqv-result-head">
          <div><span>{mode === 'questions' ? 'Question bank' : 'Article archive'}</span><b>{resultCount} {mode}</b></div>
        </div>

        {!resultCount ? (
          <div className="pyqv-empty"><FontAwesomeIcon icon={faMagnifyingGlass} /><b>No results match</b><p>Try a wider date, subject, sub-topic or revision status.</p><button onClick={clearFilters}>Clear filters</button></div>
        ) : mode === 'questions' ? (
          <div className="pyqv-list">
            {questionResults.slice(0, visibleCount).map(entry => {
              const answered = stats.a[entry.question.id]
              const bookmarked = questionBookmarks.includes(entry.question.id)
              const related = relatedPyqsByArticle.get(entry.article.id) ?? []
              return (
                <article className="pyqv-card" key={entry.question.id} role="button" tabIndex={0} onClick={() => { setSelected(entry); setShowAnswer(false) }}>
                  <div className="pyqv-card-meta">
                    <span>{new Date(`${entry.article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>{entry.article.gsPaper}</span><span>{entry.article.category}</span><span>{articleTopics(entry.article)[0]}</span>
                    {answered && <i className="attempted"><FontAwesomeIcon icon={faCheck} /> {answered[0] ? 'correct' : 'revise'}</i>}
                    <button className={bookmarked ? 'active' : ''} onClick={event => { event.stopPropagation(); toggleQbm(entry.question.id, showToast) }} aria-label="Bookmark question"><FontAwesomeIcon icon={bookmarked ? faBookmarkSolid : faBookmarkRegular} /></button>
                  </div>
                  <QuestionStem text={entry.question.q} compact />
                  <div className="ca-vault-source">From: {entry.article.headline}</div>
                  {related.length > 0 && (
                    <details className="question-link-signal" onClick={event => event.stopPropagation()}>
                      <summary><span>Related PYQ available</span><b>{related.length === 1 ? `UPSC ${related[0].item.year}` : `${related.length} close matches`}</b><FontAwesomeIcon icon={faChevronDown} /></summary>
                      <div>{related.map(({ item, reason }) => <p key={item.id}><span>UPSC {item.year} · {item.subject}</span><b>{item.question}</b><i>{reason}</i></p>)}</div>
                    </details>
                  )}
                  <div className="pyqv-card-actions">
                    <button onClick={event => { event.stopPropagation(); setSelected(entry); setShowAnswer(false) }}><FontAwesomeIcon icon={faBookOpen} /> View question</button>
                    <button onClick={event => { event.stopPropagation(); setSelected(entry); setShowAnswer(true) }}>See answer <FontAwesomeIcon icon={faChevronRight} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="pyqv-list ca-vault-article-list">
            {articleResults.slice(0, visibleCount).map(article => {
              const bookmarked = isBookmarked(article.id)
              const questionCount = article.prelimsQs?.length ?? 0
              return (
                <article className="pyqv-card ca-vault-article" key={article.id} role="button" tabIndex={0} onClick={() => openArticle(article)}>
                  <div className="pyqv-card-meta"><span>{new Date(`${article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{article.gsPaper}</span><span>{article.category}</span><span>{articleTopics(article)[0]}</span><button className={bookmarked ? 'active' : ''} onClick={event => { event.stopPropagation(); toggle(article.id) }}><FontAwesomeIcon icon={bookmarked ? faBookmarkSolid : faBookmarkRegular} /></button></div>
                  <h3>{article.headline}</h3><p>{article.summary}</p>
                  <div className="pyqv-card-actions"><button onClick={event => { event.stopPropagation(); openArticle(article) }}><FontAwesomeIcon icon={faBookOpen} /> Open deep dive</button><button onClick={event => { event.stopPropagation(); startPractice(articleQs([article]), 'all') }}>{questionCount} MCQs <FontAwesomeIcon icon={faChevronRight} /></button></div>
                </article>
              )
            })}
          </div>
        )}

        {visibleCount < resultCount && <button className="pyqv-load-more" onClick={() => setVisibleCount(count => count + 24)}>Show 24 more <span>{resultCount - visibleCount} remaining</span></button>}
        </>}
      </main>

      {selected && (
        <div className="pyqv-detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="pyqv-detail" onClick={event => event.stopPropagation()}>
            <div className="pyqv-detail-head"><div><span>{selected.article.date} · Question {selected.number}</span><b>{selected.article.category} · {articleTopics(selected.article)[0]}</b></div><button onClick={() => setSelected(null)}><FontAwesomeIcon icon={faXmark} /></button></div>
            <div className="pyqv-detail-scroll">
              <QuestionStem text={selected.question.q} />
              <div className="pyqv-detail-options">{selected.question.options.map((option, index) => <div key={index} className={showAnswer && index === selected.question.answer ? 'correct' : ''}><span>{String.fromCharCode(65 + index)}</span><p>{option}</p>{showAnswer && index === selected.question.answer && <FontAwesomeIcon icon={faCheck} />}</div>)}</div>
              {showAnswer && <div className="ca-vault-explanation"><b>Explanation</b><p>{selected.question.explanation}</p>{selected.question.ref && <span>Reference: {selected.question.ref}</span>}</div>}
              {selectedRelatedPyqs.length > 0 && (
                <section className="question-connection">
                  <div className="question-connection-head"><span>Related PYQ available</span><p>Open the precedent now; you do not need to reveal this question first.</p></div>
                  {selectedRelatedPyqs.map(({ item, reason }) => (
                    <details key={item.id}>
                      <summary><span>UPSC {item.year} · {item.subject}</span><b>{item.question}</b><i>{reason}</i></summary>
                      <div><p>{item.options?.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('  ·  ')}</p>{item.answer !== undefined && <b>Answer: {String.fromCharCode(65 + item.answer)}</b>}{item.explanation && <em>{item.explanation}</em>}</div>
                    </details>
                  ))}
                </section>
              )}
            </div>
            <div className="pyqv-detail-actions">
              {!showAnswer && <button onClick={() => setShowAnswer(true)}><FontAwesomeIcon icon={faBookOpen} /> See solution</button>}
              <button onClick={() => startPractice([selected.question], 'all')}><FontAwesomeIcon icon={faPlay} /> Practise question</button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="pyqv-toast">{toast}</div>}
    </div>
  )
}
