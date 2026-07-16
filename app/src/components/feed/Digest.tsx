import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { CATEGORY_COLORS } from '@/constants/categories'
import { useReadingLanguage } from '@/hooks/useReadingLanguage'
import { categoryLabel, getArticleCopy } from '@/utils/articleLocalization'

export function Digest() {
  const { 
    overlayScreen, 
    setOverlay, 
    selectedDate, 
    getArticlesForDate, 
    setActiveArticle 
  } = useAppStore()
  
  const haptic = useHaptic()
  const [readLang] = useReadingLanguage()

  const visible = overlayScreen === 'digest'
  const articles = getArticlesForDate(selectedDate)

  async function handleClose() {
    await haptic()
    setOverlay(null)
  }

  async function handleItemClick(article: typeof articles[0]) {
    await haptic()
    setOverlay(null) // close digest
    setTimeout(() => {
      setActiveArticle(article)
      setOverlay('deep-dive') // open deep dive after small transition delay
    }, 250)
  }

  const fdf = (d: string) => {
    return new Date(d).toLocaleDateString(readLang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
    }).toUpperCase()
  }

  return (
    <div id="digest" className={visible ? 'active' : ''}>
      {/* Header */}
      <div className="dd-header">
        <button onClick={handleClose} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2 id="digest-title">{selectedDate ? `${fdf(selectedDate)} — ${readLang === 'hi' ? 'प्रमुख समाचार' : 'TOP STORIES'}` : readLang === 'hi' ? 'आज — प्रमुख समाचार' : 'TODAY — TOP STORIES'}</h2>
      </div>

      {/* Body */}
      <div className="dd-body">
        {articles.length === 0 ? (
          <div className="empty-state">
            <p>{readLang === 'hi' ? 'इस तारीख के लिए कोई समाचार नहीं है।' : 'No stories for this date.'}</p>
          </div>
        ) : (
          articles.map((a, i) => {
            const catColor = CATEGORY_COLORS[a.category]
            const copy = getArticleCopy(a, readLang)
            return (
              <div 
                key={a.id} 
                className="digest-item" 
                onClick={() => handleItemClick(a)}
              >
                <div className="digest-num">{i + 1}</div>
                <div className="digest-content">
                  <h4>{copy.headline}</h4>
                  <p>{copy.summary}</p>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                    <span 
                      style={{ 
                        fontSize: 9, 
                        padding: '2px 6px', 
                        borderRadius: 3, 
                        background: catColor + '12', 
                        color: catColor, 
                        fontWeight: 600 
                      }}
                    >
                      {categoryLabel(a.category, readLang)}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 600 }}>
                      {a.source}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
