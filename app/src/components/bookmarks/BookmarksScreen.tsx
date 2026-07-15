import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBookmark,
  faBookOpen,
  faBrain,
  faChevronDown,
  faMagnifyingGlass,
  faPlay,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faBookmark as faBookmarkRegular } from '@fortawesome/free-regular-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { articleQs, allQs } from '@/utils/practiceUtils'
import type { Article } from '@/types/article'
import type { Question } from '@/utils/practiceUtils'
import { QuizPlayer } from '@/components/practice/QuizPlayer'
import { useAllArticles } from '@/hooks/useAllArticles'
import { buildRecallCards } from '@/utils/recallCards'

type Tab = 'articles' | 'cards' | 'questions'
type ActiveQuiz = { title: string; questions: Question[]; description: string } | null

interface BookmarksScreenProps {
  onShowToast: (msg: string) => void
}

function loadRecallBookmarks(): string[] {
  try { return JSON.parse(localStorage.getItem('penni.ca-recall.bookmarks.v1') || '[]') as string[] } catch { return [] }
}

export function BookmarksScreen({ onShowToast }: BookmarksScreenProps) {
  const { setScreen, articlesByDate, setActiveArticle, setOverlay } = useAppStore()
  const { bookmarkedIds, toggle } = useBookmarkStore()
  const { questionBookmarks, toggleQbm, pyqData } = usePracticeStore()
  const [tab, setTab] = useState<Tab>('articles')
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('all')
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz>(null)
  const [recallBookmarks, setRecallBookmarks] = useState<string[]>(loadRecallBookmarks)
  useAllArticles()

  const allArticles = useMemo(() => Object.values(articlesByDate).flat(), [articlesByDate])
  const bookmarked = useMemo(() => allArticles.filter(article => bookmarkedIds.includes(article.id)).sort((a, b) => b.date.localeCompare(a.date)), [allArticles, bookmarkedIds])
  const bookmarkedRecallCards = useMemo(() => buildRecallCards(allArticles).filter(card => recallBookmarks.includes(card.id)).sort((a, b) => b.article.date.localeCompare(a.article.date)), [allArticles, recallBookmarks])
  const bookmarkedQuestions = useMemo(() => allQs(allArticles, pyqData).filter(question => questionBookmarks.includes(question.id)), [allArticles, pyqData, questionBookmarks])
  const subjects = useMemo(() => [...new Set((tab === 'articles'
    ? bookmarked.map(item => item.category)
    : tab === 'cards'
      ? bookmarkedRecallCards.map(item => item.article.category)
      : bookmarkedQuestions.map(item => item.subject)))].sort(), [bookmarked, bookmarkedQuestions, bookmarkedRecallCards, tab])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredArticles = bookmarked.filter(article => {
    if (subject !== 'all' && article.category !== subject) return false
    if (!normalizedQuery) return true
    return [article.headline, article.summary, article.category, ...(article.keyTerms ?? [])].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const filteredQuestions = bookmarkedQuestions.filter(question => {
    if (subject !== 'all' && question.subject !== subject) return false
    if (!normalizedQuery) return true
    return [question.q, question.subject, question.srcLabel].join(' ').toLowerCase().includes(normalizedQuery)
  })
  const filteredRecallCards = bookmarkedRecallCards.filter(card => {
    if (subject !== 'all' && card.article.category !== subject) return false
    if (!normalizedQuery) return true
    return [card.article.headline, card.article.summary, card.article.category, ...(card.article.keyTerms ?? [])].join(' ').toLowerCase().includes(normalizedQuery)
  })

  function switchTab(next: Tab) {
    setTab(next)
    setSubject('all')
    setQuery('')
  }

  function openArticle(article: Article) {
    setActiveArticle(article)
    setOverlay('deep-dive')
  }

  function startQuiz(title: string, questions: Question[], description: string) {
    if (!questions.length) { onShowToast('No MCQs are available in this selection'); return }
    setActiveQuiz({ title, questions, description })
  }

  function openRecall(scope: string, articleIds: string[] = []) {
    localStorage.setItem('penni.ca-recall.scope', scope)
    if (articleIds.length) localStorage.setItem('penni.ca-recall.selection.v1', JSON.stringify(articleIds))
    setScreen('revise')
  }

  function removeRecallBookmark(cardId: string) {
    const next = recallBookmarks.filter(id => id !== cardId)
    setRecallBookmarks(next)
    localStorage.setItem('penni.ca-recall.bookmarks.v1', JSON.stringify(next))
    onShowToast('Recall card removed')
  }

  if (activeQuiz) {
    return <QuizPlayer title={activeQuiz.title} eyebrow="Saved revision" description={activeQuiz.description} questions={activeQuiz.questions} onClose={() => setActiveQuiz(null)} onShowToast={onShowToast} />
  }

  return (
    <div className="bookmarks-shell">
      <header className="bookmarks-header">
        <button className="icon-btn" onClick={() => setScreen('feed')} aria-label="Back"><FontAwesomeIcon icon={faArrowLeft} /></button>
        <div><span>Personal revision library</span><h2>Bookmarks</h2></div>
      </header>

      <main className="bookmarks-main">
        <section className="bookmarks-overview">
          <div><span>Saved for later</span><h3>Read it. Recall it. Test it.</h3><p>Bookmarks are organised as a working revision list, not a passive collection.</p></div>
          <div className="bookmarks-counts"><div><b>{bookmarked.length}</b><span>articles</span></div><div><b>{bookmarkedRecallCards.length}</b><span>recall cards</span></div><div><b>{bookmarkedQuestions.length}</b><span>questions</span></div></div>
        </section>

        <div className="bookmarks-tabs" role="tablist">
          <button className={tab === 'articles' ? 'active' : ''} onClick={() => switchTab('articles')}>Saved articles <span>{bookmarked.length}</span></button>
          <button className={tab === 'cards' ? 'active' : ''} onClick={() => switchTab('cards')}>Recall cards <span>{bookmarkedRecallCards.length}</span></button>
          <button className={tab === 'questions' ? 'active' : ''} onClick={() => switchTab('questions')}>Saved questions <span>{bookmarkedQuestions.length}</span></button>
        </div>

        <section className="bookmarks-controls">
          <div className="bookmarks-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'articles' ? 'Search saved articles, topics or key terms' : tab === 'cards' ? 'Search saved recall cards or concepts' : 'Search saved question text or subject'} />{query && <button onClick={() => setQuery('')}><FontAwesomeIcon icon={faXmark} /></button>}</div>
          <label><select value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(item => <option key={item}>{item}</option>)}</select><FontAwesomeIcon icon={faChevronDown} /></label>
        </section>

        {tab === 'articles' && bookmarked.length > 0 && (
          <section className="bookmarks-batch">
            <div><span>Saved article set</span><b>{filteredArticles.length} articles in this view</b></div>
            <button disabled={!filteredArticles.length} onClick={() => openRecall('selection', filteredArticles.map(article => article.id))}><FontAwesomeIcon icon={faBrain} /> Recall this view</button>
            <button disabled={!filteredArticles.length} onClick={() => startQuiz('Saved Article MCQs', articleQs(filteredArticles), 'MCQs drawn only from the saved articles in this filtered view.')}><FontAwesomeIcon icon={faPlay} /> Review MCQs</button>
          </section>
        )}

        {tab === 'cards' && bookmarkedRecallCards.length > 0 && (
          <section className="bookmarks-batch">
            <div><span>Saved recall set</span><b>{filteredRecallCards.length} cards in this view</b></div>
            <button className="primary" disabled={!filteredRecallCards.length} onClick={() => openRecall('selection', filteredRecallCards.map(card => card.article.id))}><FontAwesomeIcon icon={faBrain} /> Recall this view</button>
          </section>
        )}

        {tab === 'questions' && bookmarkedQuestions.length > 0 && (
          <section className="bookmarks-batch">
            <div><span>Saved question set</span><b>{filteredQuestions.length} questions in this view</b></div>
            <button className="primary" disabled={!filteredQuestions.length} onClick={() => startQuiz('Saved Questions', filteredQuestions, 'A focused review of the questions in this filtered view.')}><FontAwesomeIcon icon={faPlay} /> Review selection</button>
          </section>
        )}

        {tab === 'articles' ? (
          filteredArticles.length ? <div className="bookmarks-list">{filteredArticles.map(article => {
            const questions = articleQs([article])
            const saved = bookmarkedIds.includes(article.id)
            return (
              <article className="bookmark-article-card" key={article.id}>
                <div className="bookmark-card-meta"><span>{new Date(`${article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{article.gsPaper}</span><span>{article.category}</span><button className={saved ? 'active' : ''} onClick={() => toggle(article.id)} aria-label="Remove bookmark"><FontAwesomeIcon icon={faBookmark} /></button></div>
                <h3>{article.headline}</h3><p>{article.summary}</p>
                <div className="bookmark-card-actions"><button onClick={() => openArticle(article)}><FontAwesomeIcon icon={faBookOpen} /> Read</button><button onClick={() => openRecall(`article:${article.id}`)}><FontAwesomeIcon icon={faBrain} /> Recall</button><button onClick={() => startQuiz(`${article.category} · Saved Article`, questions, 'MCQs connected only to this saved article.')} disabled={!questions.length}><FontAwesomeIcon icon={faPlay} /> {questions.length} MCQs</button><button className="remove" onClick={() => toggle(article.id)}><FontAwesomeIcon icon={faTrash} /></button></div>
              </article>
            )
          })}</div> : <BookmarkEmpty search={Boolean(query || subject !== 'all')} onClear={() => { setQuery(''); setSubject('all') }} />
        ) : tab === 'cards' ? (
          filteredRecallCards.length ? <div className="bookmarks-list">{filteredRecallCards.map(card => (
            <article className="bookmark-article-card recall" key={card.id}>
              <div className="bookmark-card-meta"><span>{new Date(`${card.article.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{card.article.gsPaper}</span><span>{card.article.category}</span><button className="active" onClick={() => removeRecallBookmark(card.id)} aria-label="Remove saved recall card"><FontAwesomeIcon icon={faBookmark} /></button></div>
              <h3>{card.article.headline}</h3><p>{card.prompts.length} active-recall checks covering the news fact, exam trap and static link.</p>
              <div className="bookmark-card-actions"><button onClick={() => openRecall(`article:${card.article.id}`)}><FontAwesomeIcon icon={faBrain} /> Recall card</button><button onClick={() => openArticle(card.article)}><FontAwesomeIcon icon={faBookOpen} /> Read article</button><button className="remove" onClick={() => removeRecallBookmark(card.id)}><FontAwesomeIcon icon={faTrash} /> Remove</button></div>
            </article>
          ))}</div> : <BookmarkEmpty search={Boolean(query || subject !== 'all')} onClear={() => { setQuery(''); setSubject('all') }} />
        ) : (
          filteredQuestions.length ? <div className="bookmarks-list">{filteredQuestions.map(question => (
            <article className="bookmark-question-card" key={question.id}><div><span>{question.subject}</span><button onClick={() => toggleQbm(question.id, onShowToast)}><FontAwesomeIcon icon={faBookmark} /></button></div><p>{question.q}</p><small>{question.srcLabel}</small><button onClick={() => startQuiz('Saved Question', [question], 'Review this saved question in a focused one-question session.')}><FontAwesomeIcon icon={faBookOpen} /> Review question</button></article>
          ))}</div> : <BookmarkEmpty search={Boolean(query || subject !== 'all')} onClear={() => { setQuery(''); setSubject('all') }} />
        )}
      </main>
    </div>
  )
}

function BookmarkEmpty({ search, onClear }: { search: boolean; onClear: () => void }) {
  return <div className="bookmarks-empty"><FontAwesomeIcon icon={faBookmarkRegular} /><b>{search ? 'No saved items match' : 'Nothing saved yet'}</b><p>{search ? 'Try a wider search or subject.' : 'Use the bookmark icon on an article, recall card or question to add it here.'}</p>{search && <button onClick={onClear}>Clear filters</button>}</div>
}
