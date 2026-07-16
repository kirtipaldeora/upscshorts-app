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
  faCamera,
  faChartLine,
  faClipboardList,
  faEnvelope,
  faLifeRing,
  faScaleBalanced,
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
import { ProfileAvatar } from './ProfileAvatar'
import { StudyTargetsSheet } from './StudyTargetsSheet'
import { getProfileCompletion } from '@/utils/profile'

interface ProfileScreenProps {
  onOpenSettings: () => void
  onOpenMainsRecord: (rec: MainsRecord) => void
  onShowToast: (message: string) => void
}

async function prepareProfilePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('This image format is not supported'))
      element.src = url
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo')
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ProfileScreen({ onOpenSettings, onOpenMainsRecord, onShowToast }: ProfileScreenProps) {
  const {
    setScreen,
    goBack,
  } = useAppStore()
  const { bookmarkedIds } = useBookmarkStore()
  const { stats, settings, saveSettings } = usePracticeStore()
  const { profile, isGuest, user, saveProfile } = useAuthStore()
  const haptic = useHaptic()
  const [mainsRecs, setMainsRecs] = useState<MainsRecord[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [targetsOpen, setTargetsOpen] = useState(false)
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
  const completion = getProfileCompletion(profile, user)
  const enabledTargets = Object.values(settings.studyTargets).filter(Boolean).length
  const pyqAttempts = Object.keys(stats.a).filter(id => id.startsWith('pyq-')).length
  const pyqCorrect = Object.entries(stats.a).filter(([id, value]) => id.startsWith('pyq-') && value[0] === 1).length
  const pyqAccuracy = pyqAttempts ? Math.round(pyqCorrect / pyqAttempts * 100) : 0

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
    await haptic(); goBack('feed')
  }

  async function handleSaveAccount() {
    if (!draft) return
    await haptic()
    const saved = await saveProfile(draft)
    if (!saved) {
      onShowToast(useAuthStore.getState().error || 'Could not update profile')
      return
    }
    saveSettings({ name: draft.name || 'UPSC Aspirant' })
    setEditOpen(false)
    onShowToast('Profile updated')
  }

  async function handleProfilePhoto(file?: File) {
    if (!file || !draft) return
    try {
      const photoUrl = await prepareProfilePhoto(file)
      setDraft({ ...draft, photoUrl })
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not use this photo')
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
        <button onClick={onOpenSettings} aria-label="Settings" style={{ marginLeft: 'auto' }}>
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      <div className="screen-body">
        <div className="account-hero">
          <div className="account-hero-top">
            <ProfileAvatar profile={profile} user={user} size="lg" />
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
          {!isGuest && (
            <button className="account-completion" onClick={() => setEditOpen(true)}>
              <span><b>{completion.percent}% complete</b><small>{completion.missing.length ? `Add ${completion.missing.slice(0, 2).join(' and ')}` : 'Your profile is complete'}</small></span>
              <i><em style={{ width: `${completion.percent}%` }} /></i>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          )}
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
          <p>{goalComplete ? 'Your daily rhythm is protected. Review or explore whenever you are ready.' : `${enabledTargets} active target${enabledTargets === 1 ? '' : 's'} · ${Math.max(0, target - todayDone)} MCQs remaining.`}</p>
          <div className="account-panel-actions">
            <button onClick={() => { void haptic(); setScreen('practice') }}>
              <FontAwesomeIcon icon={faDumbbell} />
                {todayDone ? 'Continue practice' : 'Start practice'}
            </button>
            <button className="secondary" onClick={() => setTargetsOpen(true)}>
              <FontAwesomeIcon icon={faClipboardList} /> Targets
            </button>
          </div>
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

        <div className="account-list-card account-hub-list">
          <div className="account-list-head">
            <FontAwesomeIcon icon={faChartLine} />
            <span>Your preparation</span>
          </div>
          <button onClick={() => setProgressOpen(true)}><span><FontAwesomeIcon icon={faChartLine} /> My progress</span><b>{attempted} MCQs</b></button>
          <button onClick={() => setTargetsOpen(true)}><span><FontAwesomeIcon icon={faClipboardList} /> My targets</span><b>{enabledTargets} active</b></button>
          <button onClick={() => setScreen('bookmarks')}><span><FontAwesomeIcon icon={faBookmark} /> Bookmarks</span><b>{totalBookmarks} saved</b></button>
          <button onClick={() => setScreen('revise')}><span><FontAwesomeIcon icon={faBookOpen} /> Revision</span><FontAwesomeIcon icon={faChevronRight} /></button>
          <button onClick={onOpenSettings}><span><FontAwesomeIcon icon={faGear} /> Settings</span><FontAwesomeIcon icon={faChevronRight} /></button>
        </div>

        <div className="account-insight-grid">
          <button onClick={() => setProgressOpen(true)}><span>PYQ practice</span><b>{pyqAttempts || '—'}</b><small>{pyqAttempts ? `${pyqAccuracy}% accuracy` : 'Start in Practice'}</small></button>
          <button onClick={() => setProgressOpen(true)}><span>Mains writing</span><b>{mainsRecs.length || '—'}</b><small>{mainsRecs.length ? 'evaluated answers' : 'Build consistency'}</small></button>
        </div>

        {mainsRecs.length > 0 && (
          <div className="account-list-card">
            <div className="account-list-head">
              <FontAwesomeIcon icon={faFilePen} />
              <span>Recent Mains evaluations</span>
              <button onClick={() => setScreen('practice')}>Practice</button>
            </div>
            {mainsRecs.slice(0, 3).map(r => (
              <button key={r.ts} onClick={() => onOpenMainsRecord(r)}>
                <span>{r.qtext}</span>
                <b>{r.eval ? `${r.eval.score}/${r.eval.max_score}` : 'Open'}</b>
              </button>
            ))}
          </div>
        )}

        <div className="account-list-card account-support-list">
          <div className="account-list-head"><FontAwesomeIcon icon={faLifeRing} /><span>Help &amp; legal</span></div>
          <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni support'}><span><FontAwesomeIcon icon={faLifeRing} /> Help &amp; support</span><FontAwesomeIcon icon={faChevronRight} /></button>
          <button onClick={() => window.open('/privacy.html', '_blank')}><span><FontAwesomeIcon icon={faScaleBalanced} /> Privacy policy</span><FontAwesomeIcon icon={faChevronRight} /></button>
          <button onClick={() => window.open('/terms.html', '_blank')}><span><FontAwesomeIcon icon={faScaleBalanced} /> Terms of use</span><FontAwesomeIcon icon={faChevronRight} /></button>
          <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni feedback'}><span><FontAwesomeIcon icon={faEnvelope} /> Send feedback</span><FontAwesomeIcon icon={faChevronRight} /></button>
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

            <div className="account-photo-editor">
              <ProfileAvatar profile={draft} user={user} size="lg" />
              <div><b>Profile picture</b><span>Upload a square photo or choose a Penni icon.</span></div>
              <label>
                <FontAwesomeIcon icon={faCamera} /> Upload
                <input type="file" accept="image/*" onChange={event => void handleProfilePhoto(event.target.files?.[0])} />
              </label>
              {draft.photoUrl && <button onClick={() => setDraft({ ...draft, photoUrl: '' })}>Remove</button>}
            </div>

            <div className="account-edit-mascots" aria-label="Profile icons">
              {PROFILE_MASCOTS.map(mascot => (
                <button
                  key={mascot.id}
                  className={draft.mascotId === mascot.id ? 'active' : ''}
                  onClick={() => setDraft(prev => prev ? { ...prev, mascotId: mascot.id, photoUrl: '' } : prev)}
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
                <span>Email</span>
                <input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder={user?.email || 'you@example.com'} />
              </label>
              <label>
                <span>Phone</span>
                <input type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="+91" />
              </label>
              <label>
                <span>Gender</span>
                <select value={draft.gender} onChange={e => setDraft({ ...draft, gender: e.target.value as typeof draft.gender })}>
                  <option value="">Prefer not to add</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </label>
              <label>
                <span>Date of birth</span>
                <input type="date" value={draft.dateOfBirth} max={TODAY} onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} />
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
          attemptYear={profile?.attemptYear}
          mainsRecords={mainsRecs}
          onClose={() => setProgressOpen(false)}
          onPractice={() => {
            setProgressOpen(false)
            setScreen('practice')
          }}
        />
      )}

      {targetsOpen && (
        <StudyTargetsSheet
          initial={settings.studyTargets}
          dailyMcqs={target}
          onClose={() => setTargetsOpen(false)}
          onSave={studyTargets => {
            saveSettings({ studyTargets })
            setTargetsOpen(false)
            onShowToast('Study targets saved')
          }}
        />
      )}
    </div>
  )
}
