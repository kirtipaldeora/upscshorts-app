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
import './ProfileScreen.css'

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
  const profileLine = isGuest ? 'Explore locally. Sign in when you want to sync.' : profile?.targetExam || 'Civil Services Aspirant'
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
      gsap.fromTo('.account-identity-card,.account-today-card,.account-section',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.54, ease: EASE.expo, stagger: 0.06, clearProps: 'transform,opacity' })
      gsap.fromTo('.account-hub-progress i',
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
    try { localStorage.setItem('penni-read-lang', draft.language === 'hindi' ? 'hi' : 'en') } catch { /* noop */ }
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
    <div className="screen active account-screen">
      <div className="screen-header account-header">
        <button onClick={handleBack} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <span>Personal workspace</span>
          <h2>Account</h2>
        </div>
        <button onClick={onOpenSettings} aria-label="Open settings">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      <div className="screen-body account-screen-body">
        <section className="account-identity-card" aria-label="Account identity">
          <div className="account-identity-main">
            <div className="account-identity-avatar"><ProfileAvatar profile={profile} user={user} size="lg" /></div>
            <div className="account-identity-copy">
              <span>{isGuest ? 'Local preview' : 'Penni account'}</span>
              <h3>{displayName}</h3>
              <p>{profileLine}</p>
            </div>
            <button className="account-identity-action" onClick={() => {
              if (isGuest || !profile) onOpenSettings()
              else setEditOpen(true)
            }} aria-label={isGuest ? 'Sign in to Penni' : 'Edit account'}>
              <span>{isGuest ? 'Sign in' : 'Edit'}</span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>

          {!isGuest ? (
            <button className="account-profile-progress" onClick={() => setEditOpen(true)}>
              <span><small>Profile setup</small><b>{completion.percent}% complete</b></span>
              <i role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.percent}><em style={{ width: `${completion.percent}%` }} /></i>
              <small>{completion.missing.length ? `Add ${completion.missing.slice(0, 2).join(' and ')}` : 'All details added'}</small>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          ) : (
            <div className="account-local-note"><span>Guest mode</span><p>Your study data stays on this device until you sign in.</p></div>
          )}
        </section>

        <section className="account-today-card" aria-labelledby="account-today-title">
          <div className="account-today-head">
            <div>
              <span>Today’s preparation</span>
              <h3 id="account-today-title">{goalComplete ? 'Daily target complete' : `${todayDone} of ${target} MCQs`}</h3>
            </div>
            <strong>{targetPct}<small>%</small></strong>
          </div>
          <div className="account-hub-progress" role="progressbar" aria-label="Daily MCQ target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={targetPct}><i style={{ width: `${targetPct}%` }} /></div>
          <p>{goalComplete ? 'Target secured. Use the rest of today for revision or focused practice.' : `${Math.max(0, target - todayDone)} questions left · ${enabledTargets || 'No'} active study target${enabledTargets === 1 ? '' : 's'}.`}</p>
          <div className="account-daily-actions">
            <button onClick={() => { void haptic(); setScreen('practice') }}>
              <FontAwesomeIcon icon={faDumbbell} />
              {todayDone ? 'Continue practice' : 'Start practice'}
            </button>
            <button className="secondary" onClick={() => setTargetsOpen(true)}>
              <FontAwesomeIcon icon={faClipboardList} /> Targets
            </button>
          </div>

          <div className="account-stat-strip" aria-label="Preparation snapshot">
            <button onClick={() => { void haptic(); setProgressOpen(true) }}>
            <FontAwesomeIcon icon={faFire} />
            <b>{streakCount}</b>
              <span>day streak</span>
            </button>
            <button onClick={() => setProgressOpen(true)}>
            <FontAwesomeIcon icon={faBullseye} />
              <b>{pyqAttempts ? `${pyqAccuracy}%` : '—'}</b>
              <span>PYQ accuracy</span>
            </button>
            <button onClick={() => setProgressOpen(true)}>
              <FontAwesomeIcon icon={faFilePen} />
              <b>{mainsRecs.length || '—'}</b>
              <span>Mains answers</span>
            </button>
          </div>
        </section>

        <section className="account-section">
          <div className="account-section-heading">
            <span>Study &amp; review</span>
            <p>Your preparation tools, kept in one place.</p>
          </div>
          <div className="account-menu-card">
            <button onClick={() => setProgressOpen(true)}>
              <i><FontAwesomeIcon icon={faChartLine} /></i>
              <span><b>Progress &amp; analytics</b><small>{attempted ? `${attempted} questions attempted` : 'See accuracy, streaks and activity'}</small></span>
              <em>{attempted || 'New'}</em>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => setScreen('bookmarks')}>
              <i><FontAwesomeIcon icon={faBookmark} /></i>
              <span><b>Bookmarks</b><small>{totalBookmarks ? `${totalBookmarks} saved for later` : 'Save articles and questions for later'}</small></span>
              <em>{totalBookmarks || '—'}</em>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => setScreen('revise')}>
              <i><FontAwesomeIcon icon={faBookOpen} /></i>
              <span><b>Revision</b><small>Articles, question banks and your mistakes</small></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            {mainsRecs[0] && (
              <button onClick={() => onOpenMainsRecord(mainsRecs[0])}>
                <i><FontAwesomeIcon icon={faFilePen} /></i>
                <span><b>Latest Mains evaluation</b><small>{mainsRecs[0].qtext}</small></span>
                <em>{mainsRecs[0].eval ? `${mainsRecs[0].eval.score}/${mainsRecs[0].eval.max_score}` : 'Open'}</em>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            )}
          </div>
        </section>

        <section className="account-section">
          <div className="account-section-heading"><span>Account &amp; app</span></div>
          <div className="account-menu-card">
            <button onClick={onOpenSettings}>
              <i><FontAwesomeIcon icon={faGear} /></i>
              <span><b>Settings</b><small>Account, appearance, alerts and data</small></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </section>

        <section className="account-section account-support-section">
          <div className="account-section-heading"><span>Support &amp; legal</span></div>
          <div className="account-menu-card account-support-card">
            <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni support'}>
              <i><FontAwesomeIcon icon={faLifeRing} /></i>
              <span><b>Help &amp; support</b><small>Get help with your Penni account</small></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => window.location.href = 'mailto:support@penni.app?subject=Penni feedback'}>
              <i><FontAwesomeIcon icon={faEnvelope} /></i>
              <span><b>Send feedback</b><small>Tell us what would improve your preparation</small></span>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <div className="account-legal-links" aria-label="Legal links">
              <FontAwesomeIcon icon={faScaleBalanced} aria-hidden="true" />
              <button onClick={() => window.open('/privacy.html', '_blank', 'noopener,noreferrer')}>Privacy policy</button>
              <span aria-hidden="true">·</span>
              <button onClick={() => window.open('/terms.html', '_blank', 'noopener,noreferrer')}>Terms of use</button>
            </div>
          </div>
          <p className="account-footer-note">Penni · Built for focused preparation</p>
        </section>
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
                <span>Language</span>
                <select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value as typeof draft.language })}>
                  <option value="english">English</option>
                  <option value="hindi">हिन्दी</option>
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
