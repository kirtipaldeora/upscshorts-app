import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSun,
  faMoon,
  faFileImport,
  faClone,
  faDownload,
  faFileExport,
  faRotate,
  faTrash,
  faArrowRotateLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { useHaptic } from '@/hooks/useHaptic'

interface ProfileScreenProps {
  onOpenUpload: () => void
  onShowToast: (msg: string) => void
}

export function ProfileScreen({ onOpenUpload, onShowToast }: ProfileScreenProps) {
  const {
    setScreen,
    articlesByDate,
    setOverlay,
    setFlashcardQueue,
    setFlashcardIndex,
    setArticlesByDate,
    setActiveArticle,
  } = useAppStore()
  const { bookmarkedIds, clearAll } = useBookmarkStore()
  const { theme, toggle } = useThemeStore()
  const haptic = useHaptic()

  const allArticles = Object.values(articlesByDate).flat()
  const totalArticles = allArticles.length
  const totalDates = Object.keys(articlesByDate).length
  const totalBookmarks = bookmarkedIds.length

  async function handleBack() {
    await haptic()
    setScreen('feed')
  }

  async function handleToggleTheme() {
    await haptic()
    toggle()
  }

  async function handleImportJson() {
    await haptic()
    onOpenUpload()
  }

  async function handleAllFlashcards() {
    await haptic()
    const cards = allArticles.map((a) => a.deepDive.flashcard).filter(Boolean)
    if (cards.length > 0) {
      setActiveArticle(null)
      setFlashcardQueue(cards)
      setFlashcardIndex(0)
      setOverlay('flashcards')
    } else {
      onShowToast('No flashcards available')
    }
  }

  async function handleExportBookmarks() {
    await haptic()
    if (!totalBookmarks) {
      onShowToast('No bookmarks')
      return
    }
    let t = 'michi — Bookmarks\n' + '='.repeat(40) + '\n\n'
    const bookmarkedArticles = allArticles.filter((c) => bookmarkedIds.includes(c.id))

    const fdf = (d: string) => {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }

    bookmarkedArticles.forEach((c) => {
      t += `${c.headline}\n${fdf(c.date)} | ${c.category} | ${c.gsPaper} | ${c.source}\n\n${c.deepDive.explanation.replace(/<[^>]*>/g, '')}\n\nMains: ${c.deepDive.possibleMainsQuestion}\n\n${'-'.repeat(40)}\n\n`
    })

    const blob = new Blob([t], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'michi_bookmarks.txt'
    a.click()
    onShowToast('Exported')
  }

  async function handleBackupContent() {
    await haptic()
    const blob = new Blob([JSON.stringify(articlesByDate, null, 1)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'michi_backup.json'
    a.click()
    onShowToast('Backup exported')
  }

  async function handleResetContent() {
    await haptic()
    if (window.confirm('Reset all content?')) {
      localStorage.removeItem('u4ct')
      setArticlesByDate({})
      onShowToast('Reset')
      window.location.reload()
    }
  }

  async function handleClearBookmarks() {
    await haptic()
    if (window.confirm('Clear all bookmarks?')) {
      clearAll()
      onShowToast('Cleared')
    }
  }

  async function handleResetApp() {
    await haptic()
    if (window.confirm('Reset all app data?')) {
      localStorage.clear()
      window.location.reload()
    }
  }

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      {/* Header */}
      <div className="screen-header">
        <button onClick={handleBack} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Profile</h2>
      </div>

      {/* Body */}
      <div className="screen-body">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar">U</div>
          <h3>UPSC Aspirant</h3>
          <p>Civil Services 2025</p>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="ps-num">{totalArticles}</div>
              <div className="ps-label">Articles</div>
            </div>
            <div className="profile-stat">
              <div className="ps-num">{totalDates}</div>
              <div className="ps-label">Days</div>
            </div>
            <div className="profile-stat">
              <div className="ps-num">{totalBookmarks}</div>
              <div className="ps-label">Saved</div>
            </div>
          </div>
        </div>

        {/* Preferences group */}
        <div className="setting-group">
          <div className="setting-group-title">Preferences</div>
          <div className="setting-item" onClick={handleToggleTheme}>
            <div className="setting-left">
              <FontAwesomeIcon icon={theme === 'dark' ? faMoon : faSun} style={{ width: 14 }} />
              <span>Dark Mode</span>
            </div>
            <button
              className={`toggle ${theme === 'dark' ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleTheme()
              }}
              aria-label="Toggle Dark Mode"
            />
          </div>
        </div>

        {/* Content group */}
        <div className="setting-group">
          <div className="setting-group-title">Content</div>
          
          <div className="setting-item" onClick={handleImportJson}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faFileImport} style={{ width: 14 }} />
              <span>Import JSON</span>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>

          <div className="setting-item" onClick={handleAllFlashcards}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faClone} style={{ width: 14 }} />
              <span>All Flashcards</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
              {totalArticles}
            </span>
          </div>

          <div className="setting-item" onClick={handleExportBookmarks}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faDownload} style={{ width: 14 }} />
              <span>Export Bookmarks</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
              {totalBookmarks}
            </span>
          </div>

          <div className="setting-item" onClick={handleBackupContent}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faFileExport} style={{ width: 14 }} />
              <span>Backup All Content (JSON)</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>
              {totalArticles}
            </span>
          </div>

          <div className="setting-item" onClick={handleResetContent}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faRotate} style={{ width: 14, color: 'var(--acc)' }} />
              <span>Reset Content</span>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--text3)', fontSize: 11 }} />
          </div>
        </div>

        {/* Data group */}
        <div className="setting-group">
          <div className="setting-group-title">Data</div>

          <div className="setting-item" onClick={handleClearBookmarks}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faTrash} style={{ width: 14, color: '#E05252' }} />
              <span style={{ color: '#E05252' }}>Clear Bookmarks</span>
            </div>
          </div>

          <div className="setting-item" onClick={handleResetApp}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faArrowRotateLeft} style={{ width: 14, color: '#E05252' }} />
              <span style={{ color: '#E05252' }}>Reset App</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '16px 16px 24px', color: 'var(--text3)', fontSize: 11, fontWeight: 700 }}>
          Built for UPSC aspirants<br />
          <span style={{ color: 'var(--accent)' }}>michi</span>
        </div>
      </div>
    </div>
  )
}
