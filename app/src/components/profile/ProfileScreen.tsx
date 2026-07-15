import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGear,
  faChevronRight,
  faFilePen,
  faArrowLeft,
  faBookOpen,
  faBookmark,
  faBullseye,
  faFire,
  faDumbbell,
  faXmark,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { idbAll } from '@/hooks/useMainsDB'
import type { MainsRecord } from '@/hooks/useMainsDB'
import { useHaptic } from '@/hooks/useHaptic'
import { useAuthStore } from '@/stores/useAuthStore'
import { PROFILE_MASCOTS, ProfileMascot } from '@/components/auth/ProfileMascot'
import { TODAY } from '@/constants/categories'
import { completesDailyActivity } from '@/utils/streak'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { ProgressDashboard } from './ProgressDashboard'

interface ProfileScreenProps {
  onOpenSettings: () => void
  onOpenMainsRecord: (rec: MainsRecord) => void
}

export function ProfileScreen({ onOpenSettings, onOpenMainsRecord }: ProfileScreenProps) {
  const {
    setScreen,
  } = useAppStore()
  const { bookmarkedIds } = useBookmarkStore()
  const { stats, settings, saveSettings } = usePracticeStore()
  const { profile, isGuest, user, saveProfile } = useAuthStore()
  const haptic = useHaptic()
  const [mainsRecs, setMainsRecs] = useState<MainsRecord[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [draft, setDraft] = useState(() => profile)

  const totalBookmarks = bookmarkedIds.length
  const attempted = Object.keys(stats.a).length
  const streakCount = stats.streak.count
  const todayDone = stats.d[TODAY]?.n ?? 0
  const target = settings.target || profile?.dailyTarget || 10
  const todayStats = stats.d[TODAY] ?? { n: 0, c: 0 }
  const goalComplete = completesDailyActivity(todayStats, target)
  const targetPct = goalComplete ? 100 : Math.min(100, Math.round((todayDone / Math.max(1, target)) * 100))
  const displayName = isGuest ? 'Guest Aspirant' : profile?.name || settings.name || 'UPSC Aspirant'
  const profileLine = isGuest ? 'Guest mode - local only' : [profile?.targetExam, profile?.prepStage].filter(Boolean).join(' · ') || 'Civil Services Aspirant'

  // Load mains records
  useEffect(() => {
    idbAll().then(recs => setMainsRecs(recs.sort((a, b) => b.ts - a.ts)))
  }, [])

  useEffect(() => {
    setDraft(profile)
  }, [profile])

  useEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.account-hero,.account-panel,.account-action-row,.account-list-card',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.54, ease: EASE.expo, stagger: 0.06, clearProps: 'transform,opacity' })
      gsap.fromTo('.account-progress i',
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.8, ease: EASE.expo, delay: 0.14, clearProps: 'transform' })
    })
    return () => ctx.revert()
  }, [targetPct])

  async function handleBack() {
    await haptic(); setScreen('feed')
  }

  async function handleSaveAccount() {
    if (!draft) return
    await haptic()
    await saveProfile(draft)
    saveSettings({ name: draft.name || 'UPSC Aspirant' })
    setEditOpen(false)
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

      <div className="screen-body">
        <div className="account-hero">
          <div className="account-hero-top">
            <ProfileMascot id={profile?.mascotId} size="lg" />
            <button onClick={() => {
              if (isGuest || !profile) onOpenSettings()
              else setEditOpen(true)
            }}>
              {isGuest ? 'Sign in' : 'Edit account'}
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
          <span>{isGuest ? 'Preview account' : 'Penni account'}</span>
          <h3>{displayName}</h3>
          <p>{profileLine}</p>
        </div>

        <div className="account-panel">
          <div className="account-panel-head">
            <div>
              <span>Today’s mission</span>
              <b>{goalComplete ? 'Complete' : `${todayDone} / ${target} MCQs`}</b>
            </div>
            <strong>{targetPct}%</strong>
          </div>
          <div className="account-progress"><i style={{ width: `${targetPct}%` }} /></div>
          <p>{goalComplete ? 'Your daily rhythm is protected. Review or explore whenever you are ready.' : `${Math.max(0, target - todayDone)} MCQs, one Deep Dive, one Mains evaluation, or five Atlas answers completes today.`}</p>
          <button onClick={() => { void haptic(); setScreen('practice') }}>
            <FontAwesomeIcon icon={faDumbbell} />
              {todayDone ? 'Continue practice' : 'Start practice'}
          </button>
        </div>

        <div className="account-action-row">
          <button onClick={() => { void haptic(); setProgressOpen(true) }}>
            <FontAwesomeIcon icon={faFire} />
            <b>{streakCount}</b>
            <span>streak</span>
          </button>
          <button onClick={() => setScreen('bookmarks')}>
            <FontAwesomeIcon icon={faBookmark} />
            <b>{totalBookmarks}</b>
            <span>saved</span>
          </button>
          <button onClick={() => setScreen('practice')}>
            <FontAwesomeIcon icon={faBullseye} />
            <b>{attempted}</b>
            <span>attempted</span>
          </button>
        </div>

        <div className="account-list-card">
          <div className="account-list-head">
            <FontAwesomeIcon icon={faFilePen} />
            <span>Mains evaluations</span>
            <button onClick={() => setScreen('practice')}>Practice</button>
          </div>
          {mainsRecs.length === 0 ? (
            <p className="pn-empty">No evaluated answers yet. Try one short Mains answer after practice.</p>
          ) : (
            mainsRecs.slice(0, 3).map(r => (
              <button key={r.ts} onClick={() => onOpenMainsRecord(r)}>
                <span>{r.qtext}</span>
                <b>{r.eval ? `${r.eval.score}/${r.eval.max_score}` : 'Open'}</b>
              </button>
            ))
          )}
        </div>

        <div className="account-list-card compact">
          <button onClick={() => setScreen('revise')}>
            <span><FontAwesomeIcon icon={faBookOpen} /> Revision loop</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button onClick={onOpenSettings}>
            <span><FontAwesomeIcon icon={faGear} /> Settings</span>
            <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--ink3)', fontSize: 11 }} />
          </button>
        </div>
      </div>

      {editOpen && draft && (
        <div className="account-edit-overlay" role="dialog" aria-modal="true" aria-label="Edit account">
          <div className="account-edit-sheet">
            <div className="account-edit-head">
              <div>
                <span>Penni account</span>
                <b>Edit profile</b>
              </div>
              <button onClick={() => setEditOpen(false)} aria-label="Close edit account">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="account-edit-mascots">
              {PROFILE_MASCOTS.map(mascot => (
                <button
                  key={mascot.id}
                  className={draft.mascotId === mascot.id ? 'active' : ''}
                  onClick={() => setDraft(prev => prev ? { ...prev, mascotId: mascot.id } : prev)}
                  aria-label={`Choose ${mascot.name}`}
                >
                  <ProfileMascot id={mascot.id} size="sm" selected={draft.mascotId === mascot.id} />
                </button>
              ))}
            </div>

            <div className="account-edit-grid">
              <label>
                <span>Name</span>
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label>
                <span>Attempt</span>
                <input value={draft.attemptYear} inputMode="numeric" onChange={e => setDraft({ ...draft, attemptYear: e.target.value })} />
              </label>
              <label>
                <span>Exam</span>
                <select value={draft.targetExam} onChange={e => setDraft({ ...draft, targetExam: e.target.value })}>
                  {['CSE 2027', 'CSE 2028', 'CSE 2029', 'State PCS', 'Exploring UPSC'].map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Stage</span>
                <select value={draft.prepStage} onChange={e => setDraft({ ...draft, prepStage: e.target.value })}>
                  {['Foundation', 'Prelims focused', 'Mains focused', 'Interview stage'].map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Language</span>
                <select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value as typeof draft.language })}>
                  <option value="english">english</option>
                  <option value="hinglish">hinglish</option>
                  <option value="hindi">hindi</option>
                </select>
              </label>
              <label className="wide">
                <span>Optional subject</span>
                <input value={draft.optionalSubject} placeholder="Optional, if decided" onChange={e => setDraft({ ...draft, optionalSubject: e.target.value })} />
              </label>
            </div>

            <button className="account-edit-save" onClick={() => void handleSaveAccount()}>
              <FontAwesomeIcon icon={faCheck} />
              Save account
            </button>
          </div>
        </div>
      )}

      {progressOpen && (
        <ProgressDashboard
          stats={stats}
          target={target}
          mainsRecords={mainsRecs}
          onClose={() => setProgressOpen(false)}
          onPractice={() => {
            setProgressOpen(false)
            setScreen('practice')
          }}
        />
      )}
    </div>
  )
}
