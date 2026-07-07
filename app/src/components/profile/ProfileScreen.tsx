import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGear,
  faChevronRight,
  faFilePen,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { idbAll } from '@/hooks/useMainsDB'
import type { MainsRecord } from '@/hooks/useMainsDB'
import { useHaptic } from '@/hooks/useHaptic'

interface ProfileScreenProps {
  onOpenSettings: () => void
  onOpenMainsRecord: (rec: MainsRecord) => void
}

export function ProfileScreen({ onOpenSettings, onOpenMainsRecord }: ProfileScreenProps) {
  const {
    setScreen,
  } = useAppStore()
  const { bookmarkedIds } = useBookmarkStore()
  const { stats, settings } = usePracticeStore()
  const haptic = useHaptic()
  const [mainsRecs, setMainsRecs] = useState<MainsRecord[]>([])

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
