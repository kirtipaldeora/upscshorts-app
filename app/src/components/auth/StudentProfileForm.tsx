import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBullseye, faLanguage, faUser } from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useAuthStore, type StudentProfile } from '@/stores/useAuthStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { PROFILE_MASCOTS, ProfileMascot } from './ProfileMascot'

interface StudentProfileFormProps {
  onComplete: () => void
}

const LANGUAGES: StudentProfile['language'][] = ['english', 'hinglish', 'hindi']
const DAILY_TARGETS = [5, 10, 15, 20]

const DEFAULT_PROFILE: StudentProfile = {
  name: '',
  phone: '',
  email: '',
  gender: '',
  dateOfBirth: '',
  photoUrl: '',
  emailUpdates: false,
  whatsappUpdates: false,
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
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...DEFAULT_PROFILE,
    ...profile,
    name: profile?.name || user?.name || '',
    phone: profile?.phone || user?.phone || '',
    email: profile?.email || user?.email || '',
  }))
  const rootRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()
  const whatsappDigits = form.phone.replace(/\D/g, '')
  const hasValidWhatsappPhone = whatsappDigits.length >= 8 && whatsappDigits.length <= 15 && whatsappDigits[0] !== '0'

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.student-profile-shell', { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: EASE.expo })
      gsap.fromTo('.student-setup-field', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.055, delay: 0.16, ease: EASE.expo, clearProps: 'transform,opacity' })
    }, root)
    return () => ctx.revert()
  }, [])

  function patch(next: Partial<StudentProfile>) {
    setForm(previous => ({ ...previous, ...next }))
  }

  async function finish() {
    await haptic(8)
    const saved = await saveProfile(form)
    if (!saved) return
    saveSettings({ name: form.name || 'UPSC Aspirant', target: form.dailyTarget })
    setGsFilter({ 'GS 1': true, 'GS 2': true, 'GS 3': true, 'GS 4': false })
    onComplete()
  }

  return (
    <div ref={rootRef} className="student-profile-screen">
      <div className="student-profile-shell simple">
        <div className="student-profile-hero simple">
          <span>Penni setup</span>
          <h1>Make Penni yours</h1>
          <p>Choose an icon and a comfortable daily pace.</p>
        </div>

        <div className="student-profile-card simple">
          <label className="student-setup-field">
            <span><FontAwesomeIcon icon={faUser} /> Name</span>
            <input value={form.name} onChange={event => patch({ name: event.target.value })} placeholder="Your name" autoComplete="name" />
          </label>

          <div className="student-mascot-select student-setup-field">
            <span>Profile icon</span>
            <div className="student-mascot-grid">
              {PROFILE_MASCOTS.map(mascot => (
                <button key={mascot.id} className={form.mascotId === mascot.id ? 'active' : ''} onClick={() => { void haptic(5); patch({ mascotId: mascot.id }) }} aria-label={`Choose ${mascot.name}`}>
                  <ProfileMascot id={mascot.id} size="sm" selected={form.mascotId === mascot.id} />
                </button>
              ))}
            </div>
          </div>

          <div className="student-setup-field">
            <div className="student-inline-label"><FontAwesomeIcon icon={faBullseye} /><span>Daily MCQ pace</span><b>{form.dailyTarget}</b></div>
            <div className="student-choice-row">
              {DAILY_TARGETS.map(value => <button key={value} className={form.dailyTarget === value ? 'active' : ''} onClick={() => patch({ dailyTarget: value })}>{value}</button>)}
            </div>
          </div>

          <div className="student-setup-field">
            <div className="student-inline-label"><FontAwesomeIcon icon={faLanguage} /><span>Reading language</span></div>
            <div className="student-choice-row language">
              {LANGUAGES.map(language => <button key={language} className={form.language === language ? 'active' : ''} onClick={() => patch({ language })}>{language}</button>)}
            </div>
          </div>

          {form.email && (
            <label className="student-email-consent student-setup-field">
              <input type="checkbox" checked={form.emailUpdates} onChange={event => patch({ emailUpdates: event.target.checked })} />
              <span><b>Send me Penni updates</b><small>Daily briefing alerts and important Penni feature news. Unsubscribe anytime in Settings.</small></span>
            </label>
          )}

          <label className="student-setup-field">
            <span><FontAwesomeIcon icon={faUser} /> WhatsApp number</span>
            <input type="tel" value={form.phone} onChange={event => patch({ phone: event.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
          </label>

          <label className={`student-email-consent student-setup-field ${hasValidWhatsappPhone ? '' : 'disabled'}`}>
            <input type="checkbox" checked={form.whatsappUpdates} disabled={!hasValidWhatsappPhone} onChange={event => patch({ whatsappUpdates: event.target.checked })} />
            <span><b>Send WhatsApp briefings</b><small>{hasValidWhatsappPhone ? 'Daily briefing alerts and important Penni feature updates. Standard WhatsApp terms apply.' : 'Enter a valid number with country code to enable WhatsApp updates.'}</small></span>
          </label>
        </div>

        {error && <p className="student-error">{error}</p>}
        <div className="student-profile-actions simple">
          <button className="primary" onClick={() => void finish()} disabled={loading || !form.name.trim()}>
            Start learning <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    </div>
  )
}
