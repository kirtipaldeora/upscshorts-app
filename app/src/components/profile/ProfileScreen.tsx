import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGear,
  faChevronRight,
  faFileImport,
  faClone,
  faDownload,
  faFilePen,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore, BADGES } from '@/stores/usePracticeStore'
import { idbAll } from '@/hooks/useMainsDB'
import type { MainsRecord } from '@/hooks/useMainsDB'
import { useHaptic } from '@/hooks/useHaptic'

interface ProfileScreenProps {
  onOpenUpload: () => void
  onShowToast: (msg: string) => void
  onOpenSettings: () => void
  onOpenMainsRecord: (rec: MainsRecord) => void
}

export function ProfileScreen({ onOpenUpload, onShowToast, onOpenSettings, onOpenMainsRecord }: ProfileScreenProps) {
  const {
    setScreen,
    articlesByDate,
    setOverlay,
    setFlashcardQueue,
    setFlashcardIndex,
    setActiveArticle,
  } = useAppStore()
  const { bookmarkedIds } = useBookmarkStore()
  const { stats, settings } = usePracticeStore()
  const haptic = useHaptic()
  const [mainsRecs, setMainsRecs] = useState<MainsRecord[]>([])

  const allArticles = Object.values(articlesByDate).flat()
  const totalArticles = allArticles.length
  const totalBookmarks = bookmarkedIds.length

  // Practice stats
  const attempted = Object.keys(stats.a).length
  const correct = Object.values(stats.a).filter(x => x[0] === 1).length
  const accuracy = attempted ? Math.round(correct / attempted * 100) : 0
  const streakCount = stats.streak.count
  const displayName = settings.name || 'UPSC Aspirant'

  // Subject-wise accuracy
  const subs: Record<string, { n: number; c: number }> = {}
  Object.values(stats.a).forEach(x => {
    if (x[2]) {
      const s = subs[x[2]] ?? { n: 0, c: 0 }
      s.n++; if (x[0]) s.c++
      subs[x[2]] = s
    }
  })
  const subRows = Object.keys(subs).sort((a, b) => subs[b].n - subs[a].n).slice(0, 8)

  // Load mains records
  useEffect(() => {
    idbAll().then(recs => setMainsRecs(recs.sort((a, b) => b.ts - a.ts)))
  }, [])

  async function handleBack() {
    await haptic(); setScreen('feed')
  }

  async function handleAllFlashcards() {
    await haptic()
    const cards = allArticles.map(a => a.deepDive.flashcard).filter(Boolean)
    if (cards.length) {
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
    const bookmarkedArticles = allArticles.filter(a => bookmarkedIds.includes(a.id))
    if (!bookmarkedArticles.length) { onShowToast('No bookmarks'); return }
    let t = 'Penni — Bookmarks\n' + '='.repeat(40) + '\n\n'
    bookmarkedArticles.forEach(c => {
      const date = new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      t += `${c.headline}\n${date} | ${c.category} | ${c.gsPaper} | ${c.source}\n\n${c.deepDive.explanation.replace(/<[^>]*>/g, '')}\n\nMains: ${c.deepDive.possibleMainsQuestion}\n\n${'-'.repeat(40)}\n\n`
    })
    const blob = new Blob([t], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'penni_bookmarks.txt'
    a.click()
    onShowToast('Exported')
  }

  return (
    <div className="screen active" style={{ animation: 'scrIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
      {/* Header */}
      <div className="screen-header">
        <button onClick={handleBack} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h2>Profile</h2>
        <button onClick={onOpenSettings} aria-label="Settings" style={{ marginLeft: 'auto' }}>
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* Body */}
      <div className="screen-body">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar">{displayName[0].toUpperCase()}</div>
          <h3>{displayName}</h3>
          <p>Civil Services Aspirant</p>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="ps-num">{attempted}</div>
              <div className="ps-label">Attempted</div>
            </div>
            <div className="profile-stat">
              <div className="ps-num">{accuracy}%</div>
              <div className="ps-label">Accuracy</div>
            </div>
            <div className="profile-stat">
              <div className="ps-num">{streakCount}🔥</div>
              <div className="ps-label">Streak</div>
            </div>
            <div className="profile-stat">
              <div className="ps-num">{totalBookmarks}</div>
              <div className="ps-label">Saved</div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="setting-group">
          <div className="setting-group-title">Badges</div>
          <div className="pn-badges">
            {BADGES.map(bd => (
              <div
                key={bd.id}
                className={`pn-badge ${stats.badges.includes(bd.id) ? '' : 'locked'}`}
                title={bd.desc}
              >
                <span>{bd.icon}</span>
                <b>{bd.name}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Subject-wise accuracy */}
        {subRows.length > 0 && (
          <div className="setting-group">
            <div className="setting-group-title">Subject-wise accuracy</div>
            <div className="pn-subwrap">
              {subRows.map(s => {
                const p = Math.round(subs[s].c / subs[s].n * 100)
                return (
                  <div key={s} className="pn-subrow">
                    <span>{s}</span>
                    <div className="pn-bar small"><i style={{ width: `${p}%` }} /></div>
                    <b>{p}%</b>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Mains evaluations */}
        <div className="setting-group">
          <div className="setting-group-title">Mains Evaluations</div>
          {mainsRecs.length === 0 ? (
            <p className="pn-empty">No evaluated answers yet — try Mains practice.</p>
          ) : (
            mainsRecs.map(r => (
              <div key={r.ts} className="setting-item" onClick={() => onOpenMainsRecord(r)} style={{ cursor: 'pointer' }}>
                <div className="setting-left">
                  <FontAwesomeIcon icon={faFilePen} style={{ width: 14 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                    {r.qtext}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--acc)' }}>
                  {r.eval ? `${r.eval.score}/${r.eval.max_score}` : '…'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Content group */}
        <div className="setting-group">
          <div className="setting-group-title">Content</div>
          <div className="setting-item" onClick={() => { haptic(); onOpenUpload() }}>
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
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 700 }}>{totalArticles}</span>
          </div>
          <div className="setting-item" onClick={handleExportBookmarks}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faDownload} style={{ width: 14 }} />
              <span>Export Bookmarks</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 700 }}>{totalBookmarks}</span>
          </div>
        </div>

        {/* App settings link */}
        <div className="setting-group">
          <div className="setting-group-title">App</div>
          <div className="setting-item" onClick={onOpenSettings} style={{ cursor: 'pointer' }}>
            <div className="setting-left">
              <FontAwesomeIcon icon={faGear} style={{ width: 14 }} />
              <span>Settings</span>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '16px 16px 24px', color: 'var(--on2)', fontSize: 11, fontWeight: 700 }}>
          Built for UPSC aspirants<br />
          <span style={{ color: 'var(--yellow)' }}>Penni</span>
        </div>
      </div>
    </div>
  )
}
