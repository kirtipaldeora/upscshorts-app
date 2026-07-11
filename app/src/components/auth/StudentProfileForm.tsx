import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faBookOpen,
  faBullseye,
  faCheck,
  faGraduationCap,
  faLanguage,
  faLayerGroup,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useAuthStore, type StudentProfile } from '@/stores/useAuthStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { PROFILE_MASCOTS, ProfileMascot } from './ProfileMascot'

interface StudentProfileFormProps {
  onComplete: () => void
}

const STAGES = ['Foundation', 'Prelims focused', 'Mains focused', 'Interview stage']
const EXAMS = ['CSE 2027', 'CSE 2028', 'CSE 2029', 'State PCS', 'Exploring UPSC']
const LANGUAGES: StudentProfile['language'][] = ['english', 'hinglish', 'hindi']
const GS_OPTIONS = ['GS 1', 'GS 2', 'GS 3', 'GS 4']

const DEFAULT_PROFILE: StudentProfile = {
  name: '',
  phone: '',
  mascotId: 'penni-red',
  attemptYear: '2027',
  prepStage: 'Foundation',
  targetExam: 'CSE 2027',
  language: 'english',
  dailyTarget: 10,
  gsFocus: ['GS 1', 'GS 2', 'GS 3'],
  optionalSubject: '',
}

export function StudentProfileForm({ onComplete }: StudentProfileFormProps) {
  const { user, profile, loading, error, saveProfile } = useAuthStore()
  const { saveSettings } = usePracticeStore()
  const { setGsFilter } = useAppStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...DEFAULT_PROFILE,
    ...profile,
    name: profile?.name || user?.name || '',
    phone: profile?.phone || user?.phone || '',
  }))
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.student-profile-shell', { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: EASE.expo })
      gsap.to('.profile-orbit-dot', { rotate: 360, duration: 9, repeat: -1, ease: 'none' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const card = cardRef.current
    if (!card || reducedMotion()) return
    gsap.fromTo(card, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.32, ease: EASE.expo, clearProps: 'transform,opacity' })
  }, [step])

  function patch(next: Partial<StudentProfile>) {
    setForm(prev => ({ ...prev, ...next }))
  }

  async function next() {
    await haptic(8)
    if (step < 2) {
      setStep(step + 1)
      return
    }
    await saveProfile(form)
    saveSettings({ name: form.name || 'UPSC Aspirant', target: form.dailyTarget })
    setGsFilter({
      'GS 1': form.gsFocus.includes('GS 1'),
      'GS 2': form.gsFocus.includes('GS 2'),
      'GS 3': form.gsFocus.includes('GS 3'),
      'GS 4': form.gsFocus.includes('GS 4'),
    })
    onComplete()
  }

  function toggleGs(gs: string) {
    const next = form.gsFocus.includes(gs) ? form.gsFocus.filter(item => item !== gs) : [...form.gsFocus, gs]
    patch({ gsFocus: next.length ? next : [gs] })
  }

  const progress = Math.round(((step + 1) / 3) * 100)

  return (
    <div ref={rootRef} className="student-profile-screen">
      <div className="student-profile-shell">
        <div className="student-profile-hero">
          <div className="profile-orbit" aria-hidden="true">
            <span className="profile-orbit-dot" />
            <FontAwesomeIcon icon={step === 0 ? faUser : step === 1 ? faGraduationCap : faBullseye} />
          </div>
          <span>Penni setup</span>
          <h1>Shape your UPSC journey</h1>
          <p>Penni will use this to tune your practice load, explanations and revision loop.</p>
        </div>

        <div className="student-progress">
          <i style={{ width: `${progress}%` }} />
        </div>

        <div ref={cardRef} className="student-profile-card">
          {step === 0 && (
            <>
              <div className="student-step-title">
                <FontAwesomeIcon icon={faUser} />
                <span>Basic details</span>
              </div>
              <label>
                <span>Name</span>
                <input value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Your name" />
              </label>
              <label>
                <span>Phone</span>
                <input value={form.phone} onChange={(event) => patch({ phone: event.target.value })} placeholder="+91 98765 43210" inputMode="tel" />
              </label>
              <label>
                <span>Target attempt</span>
                <input value={form.attemptYear} onChange={(event) => patch({ attemptYear: event.target.value })} placeholder="2027" inputMode="numeric" />
              </label>
              <div className="student-mascot-select">
                <span>Choose profile icon</span>
                <div className="student-mascot-grid">
                  {PROFILE_MASCOTS.map(mascot => (
                    <button
                      key={mascot.id}
                      className={form.mascotId === mascot.id ? 'active' : ''}
                      onClick={() => {
                        void haptic(5)
                        patch({ mascotId: mascot.id })
                      }}
                      aria-label={`Choose ${mascot.name}`}
                    >
                      <ProfileMascot id={mascot.id} size="sm" selected={form.mascotId === mascot.id} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="student-step-title">
                <FontAwesomeIcon icon={faBookOpen} />
                <span>Preparation profile</span>
              </div>
              <div className="student-chip-grid">
                {STAGES.map(stage => (
                  <button key={stage} className={form.prepStage === stage ? 'active' : ''} onClick={() => patch({ prepStage: stage })}>
                    {stage}
                  </button>
                ))}
              </div>
              <div className="student-chip-grid compact">
                {EXAMS.map(exam => (
                  <button key={exam} className={form.targetExam === exam ? 'active' : ''} onClick={() => patch({ targetExam: exam })}>
                    {exam}
                  </button>
                ))}
              </div>
              <label>
                <span>Optional subject</span>
                <input value={form.optionalSubject} onChange={(event) => patch({ optionalSubject: event.target.value })} placeholder="Optional, if decided" />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div className="student-step-title">
                <FontAwesomeIcon icon={faLayerGroup} />
                <span>Daily learning</span>
              </div>
              <div className="student-target">
                <FontAwesomeIcon icon={faBullseye} />
                <button onClick={() => patch({ dailyTarget: Math.max(5, form.dailyTarget - 5) })}>-</button>
                <b>{form.dailyTarget}</b>
                <button onClick={() => patch({ dailyTarget: Math.min(50, form.dailyTarget + 5) })}>+</button>
                <span>questions/day</span>
              </div>
              <div className="student-chip-grid compact">
                {GS_OPTIONS.map(gs => (
                  <button key={gs} className={form.gsFocus.includes(gs) ? 'active' : ''} onClick={() => toggleGs(gs)}>
                    {form.gsFocus.includes(gs) && <FontAwesomeIcon icon={faCheck} />}
                    {gs}
                  </button>
                ))}
              </div>
              <div className="student-chip-grid compact">
                {LANGUAGES.map(language => (
                  <button key={language} className={form.language === language ? 'active' : ''} onClick={() => patch({ language })}>
                    <FontAwesomeIcon icon={faLanguage} />
                    {language}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {error && <p className="student-error">{error}</p>}

        <div className="student-profile-actions">
          <button onClick={() => { void haptic(6); setStep(Math.max(0, step - 1)) }} disabled={step === 0 || loading}>Back</button>
          <button className="primary" onClick={() => void next()} disabled={loading || !form.name.trim()}>
            {step === 2 ? 'Enter Penni' : 'Continue'}
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    </div>
  )
}
