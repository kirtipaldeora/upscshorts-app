import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faBell,
  faBookOpen,
  faBullseye,
  faCheck,
  faClock,
  faDumbbell,
  faEarthAsia,
  faLayerGroup,
  faLanguage,
  faMobileScreenButton,
  faNewspaper,
} from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useAuthStore, type StudentProfile } from '@/stores/useAuthStore'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useAppStore } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import {
  isFocusUsernameAvailable,
  normalizeFocusUsername,
  setMyFocusUsername,
  type FocusUnavailableReason,
} from '@/lib/focusSocialClient'
import { PROFILE_MASCOTS, ProfileMascot } from './ProfileMascot'
import './AuthExperience.css'

interface StudentProfileFormProps {
  onComplete: () => void
}

const NEXT_ATTEMPT_YEAR = String(new Date().getFullYear() + 1)
const ATTEMPT_YEARS = Array.from({ length: 4 }, (_, index) => String(new Date().getFullYear() + index))
const LANGUAGES: Array<{ value: StudentProfile['language']; label: string }> = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'हिन्दी' },
]
const DAILY_TARGETS = [5, 10, 15, 20]
const GS_OPTIONS = ['GS 1', 'GS 2', 'GS 3', 'GS 4'] as const

const TOUR_FEATURES = [
  {
    id: 'briefing',
    nav: 'Today',
    eyebrow: 'Daily briefing',
    title: 'Know what matters today.',
    body: 'Exam-relevant news is sorted by date, GS paper and subject—ready when you are.',
    color: '#278cff',
    icon: faNewspaper,
  },
  {
    id: 'deep-dive',
    nav: 'Learn',
    eyebrow: 'Deep Dive',
    title: 'Turn headlines into understanding.',
    body: 'Penni connects background, syllabus context and likely exam angles in one reading flow.',
    color: '#7968f5',
    icon: faBookOpen,
  },
  {
    id: 'practice',
    nav: 'Practice',
    eyebrow: 'Daily mission',
    title: 'Practice with a purpose.',
    body: 'Short MCQ sessions show why an answer works and bring weak areas back at the right time.',
    color: '#f45f77',
    icon: faDumbbell,
  },
  {
    id: 'atlas',
    nav: 'Atlas',
    eyebrow: 'Atlas Arcade',
    title: 'Make geography stick.',
    body: 'Explore locations, map current affairs and build spatial recall through quick challenges.',
    color: '#1db68a',
    icon: faEarthAsia,
  },
  {
    id: 'revise',
    nav: 'Revise',
    eyebrow: 'Revision vault',
    title: 'Come back before you forget.',
    body: 'Mistakes, bookmarks and important reads return as a focused revision queue.',
    color: '#ed9e26',
    icon: faLayerGroup,
  },
] as const

type TourFeature = typeof TOUR_FEATURES[number]
type UsernameFeedback = {
  kind: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  message: string
  canonical?: string
}

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
  attemptYear: NEXT_ATTEMPT_YEAR,
  prepStage: 'Foundation',
  targetExam: `CSE ${NEXT_ATTEMPT_YEAR}`,
  language: 'english',
  dailyTarget: 10,
  gsFocus: ['GS 1', 'GS 2', 'GS 3'],
  optionalSubject: '',
}

function usernameServiceMessage(reason?: FocusUnavailableReason) {
  if (reason === 'offline') return 'Connect to the internet to check and claim this username.'
  if (reason === 'unconfigured') return 'Username setup needs a connected Penni account.'
  return 'Sign in to a synced Penni account to claim a username.'
}

function ChoiceGroup({
  label,
  icon,
  children,
}: {
  label: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="onboarding-choice-group" aria-label={label}>
      <div className="onboarding-group-label">{icon}<span>{label}</span></div>
      <div className="onboarding-choices">{children}</div>
    </section>
  )
}

function FeaturePreview({ feature }: { feature: TourFeature }) {
  if (feature.id === 'briefing') {
    return (
      <div className="feature-preview preview-briefing" aria-hidden="true">
        <header><span>Today</span><b>Thursday, 16 July</b><i>8 stories</i></header>
        <article className="lead-story">
          <span>GS 3 · Environment</span>
          <h3>India sharpens its clean-energy transition</h3>
          <p>Policy context, exam relevance and the facts worth remembering.</p>
        </article>
        <article><i /><span><b>Monsoon outlook</b><small>Geography · GS 1</small></span><em>4 min</em></article>
        <article><i /><span><b>New federal debate</b><small>Polity · GS 2</small></span><em>6 min</em></article>
      </div>
    )
  }

  if (feature.id === 'deep-dive') {
    return (
      <div className="feature-preview preview-deep-dive" aria-hidden="true">
        <header><span>Penni Deep Dive</span><i>GS 2</i></header>
        <h3>Why does fiscal federalism matter?</h3>
        <div className="deep-dive-lens"><i>01</i><span><b>Start with the idea</b><small>Who raises revenue, and who spends it?</small></span></div>
        <div className="deep-dive-links">
          <span>Constitution</span><i />
          <span>Finance Commission</span><i />
          <span>Current debate</span>
        </div>
        <footer><FontAwesomeIcon icon={faCheck} /> Syllabus connection found</footer>
      </div>
    )
  }

  if (feature.id === 'practice') {
    return (
      <div className="feature-preview preview-practice" aria-hidden="true">
        <header><span>Question 4 of 10</span><b>Daily mission</b><i>04:18</i></header>
        <div className="practice-progress"><i /></div>
        <h3>Which body recommends the distribution of tax revenue between the Union and States?</h3>
        <div className="practice-option"><b>A</b><span>NITI Aayog</span></div>
        <div className="practice-option selected"><b>B</b><span>Finance Commission</span><FontAwesomeIcon icon={faCheck} /></div>
        <footer><span>Polity</span><b>Clear reasoning after every answer</b></footer>
      </div>
    )
  }

  if (feature.id === 'atlas') {
    return (
      <div className="feature-preview preview-atlas" aria-hidden="true">
        <header><span>Atlas Arcade</span><b>Indian Ocean</b><i>3 / 5</i></header>
        <div className="atlas-scene">
          <div className="atlas-orbit" />
          <div className="atlas-globe"><i /><i /><span className="pin one" /><span className="pin two" /><span className="pin three" /></div>
          <span className="atlas-label one">Malacca Strait</span>
          <span className="atlas-label two">Horn of Africa</span>
        </div>
        <footer><FontAwesomeIcon icon={faEarthAsia} /><span><b>Tap the right location</b><small>Build spatial memory in seconds</small></span></footer>
      </div>
    )
  }

  return (
    <div className="feature-preview preview-revise" aria-hidden="true">
      <header><span>Revision vault</span><b>Due today</b><i>8</i></header>
      <div className="revision-score"><span><b>72%</b><small>Recall strength</small></span><i><em /></i></div>
      <div className="revision-lane">
        <article><i className="mistake" /><span><b>Mistake notebook</b><small>3 questions to revisit</small></span><em>Now</em></article>
        <article><i className="saved" /><span><b>Saved Deep Dives</b><small>Federalism · Environment</small></span><em>4</em></article>
        <article><i className="ready" /><span><b>Quick recall</b><small>A focused five-minute round</small></span><em>Start</em></article>
      </div>
    </div>
  )
}

export function StudentProfileForm({ onComplete }: StudentProfileFormProps) {
  const { user, profile, loading, error, saveProfile } = useAuthStore()
  const { settings, saveSettings } = usePracticeStore()
  const { setGsFilter } = useAppStore()
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...DEFAULT_PROFILE,
    ...profile,
    name: profile?.name || user?.name || '',
    phone: profile?.phone || user?.phone || '',
    email: profile?.email || user?.email || '',
  }))
  const [setupStep, setSetupStep] = useState(0)
  const [mode, setMode] = useState<'setup' | 'tour'>('setup')
  const [tourIndex, setTourIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const [remind, setRemind] = useState(settings.remind)
  const [reminderTime, setReminderTime] = useState(settings.reminderTime || '19:00')
  const [hapticsEnabled, setHapticsEnabled] = useState(settings.hapticsEnabled)
  const [username, setUsername] = useState('')
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({ kind: 'idle', message: 'Required · friends can find you by this exact handle.' })
  const [submitting, setSubmitting] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const usernameCheckRef = useRef(0)
  const finishInFlightRef = useRef(false)
  const haptic = useHaptic()

  const activeTour = TOUR_FEATURES[tourIndex]
  const accent = mode === 'tour'
    ? activeTour.color
    : ['#278cff', '#7968f5', '#ed9e26'][setupStep]
  const attemptYears = useMemo(() => {
    if (!form.attemptYear || ATTEMPT_YEARS.includes(form.attemptYear)) return ATTEMPT_YEARS
    return [form.attemptYear, ...ATTEMPT_YEARS.slice(0, 3)]
  }, [form.attemptYear])
  const canonicalUsername = useMemo(() => {
    try { return normalizeFocusUsername(username) } catch { return '' }
  }, [username])
  const usernameReady = usernameFeedback.kind === 'available'
    && Boolean(canonicalUsername)
    && usernameFeedback.canonical === canonicalUsername

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.onboarding-topbar', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.55, ease: EASE.expo })
      gsap.fromTo('.onboarding-footer', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.16, ease: EASE.expo })
      gsap.to('.onboarding-aurora', { scale: 1.08, xPercent: 4, duration: 5.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || reducedMotion()) return
    gsap.fromTo(
      scene,
      { opacity: 0, y: 20 * direction, filter: 'blur(7px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.52, ease: EASE.expo, clearProps: 'transform,filter,opacity' },
    )
  }, [mode, setupStep, tourIndex, direction])

  useEffect(() => {
    const generation = ++usernameCheckRef.current
    const value = username.trim()
    if (!value) {
      setUsernameFeedback({ kind: 'idle', message: 'Required · friends can find you by this exact handle.' })
      return
    }

    let canonical: string
    try {
      canonical = normalizeFocusUsername(value)
    } catch (error) {
      setUsernameFeedback({
        kind: 'invalid',
        message: error instanceof Error ? error.message : 'Choose a valid username.',
      })
      return
    }

    setUsernameFeedback({ kind: 'checking', message: `Checking @${canonical}…` })
    const timer = window.setTimeout(() => {
      void isFocusUsernameAvailable(canonical)
        .then(result => {
          if (generation !== usernameCheckRef.current) return
          if (!result.available) {
            setUsernameFeedback({ kind: 'unavailable', message: usernameServiceMessage(result.reason) })
            return
          }
          setUsernameFeedback(result.data
            ? { kind: 'available', canonical, message: `@${canonical} is available. It will be confirmed when you save.` }
            : { kind: 'unavailable', message: `@${canonical} is already taken.` })
        })
        .catch(error => {
          if (generation !== usernameCheckRef.current) return
          setUsernameFeedback({
            kind: 'unavailable',
            message: error instanceof Error ? error.message : 'Could not check this username right now.',
          })
        })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [username])

  function patch(next: Partial<StudentProfile>) {
    setForm(previous => ({ ...previous, ...next }))
  }

  function toggleGs(subject: typeof GS_OPTIONS[number]) {
    const selected = form.gsFocus.includes(subject)
    if (selected && form.gsFocus.length === 1) return
    patch({ gsFocus: selected ? form.gsFocus.filter(item => item !== subject) : [...form.gsFocus, subject] })
  }

  function move(update: () => void, nextDirection: 1 | -1) {
    if (transitioning || loading) return
    void haptic(5)
    const scene = sceneRef.current
    const commit = () => {
      setDirection(nextDirection)
      update()
      setTransitioning(false)
    }
    if (!scene || reducedMotion()) {
      commit()
      return
    }
    setTransitioning(true)
    gsap.to(scene, {
      opacity: 0,
      y: -16 * nextDirection,
      filter: 'blur(6px)',
      duration: 0.2,
      ease: 'power2.in',
      onComplete: commit,
    })
  }

  function next() {
    if (mode === 'setup') {
      if (setupStep === 0 && !usernameReady) return
      if (setupStep < 2) move(() => setSetupStep(value => value + 1), 1)
      else move(() => { setMode('tour'); setTourIndex(0) }, 1)
      return
    }
    if (tourIndex < TOUR_FEATURES.length - 1) move(() => setTourIndex(value => value + 1), 1)
    else void finish()
  }

  function back() {
    if (mode === 'tour') {
      if (tourIndex > 0) move(() => setTourIndex(value => value - 1), -1)
      else move(() => { setMode('setup'); setSetupStep(2) }, -1)
      return
    }
    if (setupStep > 0) move(() => setSetupStep(value => value - 1), -1)
  }

  async function claimUsername() {
    const value = username.trim()
    if (!value) {
      setUsernameFeedback({ kind: 'invalid', message: 'Choose a unique username to continue.' })
      return false
    }
    let canonical: string
    try {
      canonical = normalizeFocusUsername(value)
    } catch (error) {
      setUsernameFeedback({ kind: 'invalid', message: error instanceof Error ? error.message : 'Choose a valid username.' })
      return false
    }

    setUsernameFeedback({ kind: 'checking', message: `Confirming @${canonical}…` })
    try {
      // Availability feedback is helpful, but this atomic RPC and the unique
      // database index remain authoritative if two people save at once.
      const result = await setMyFocusUsername(canonical)
      if (!result.available) {
        setUsernameFeedback({ kind: 'unavailable', message: usernameServiceMessage(result.reason) })
        return false
      }
      if (!result.data) {
        setUsernameFeedback({ kind: 'unavailable', message: 'This username could not be claimed. Try another one.' })
        return false
      }
      setUsername(result.data)
      setUsernameFeedback({ kind: 'available', canonical: result.data, message: `@${result.data} is yours.` })
      return true
    } catch (error) {
      setUsernameFeedback({
        kind: 'unavailable',
        message: error instanceof Error ? error.message : 'This username could not be claimed. Try another one.',
      })
      return false
    }
  }

  async function finish() {
    if (loading || transitioning || finishInFlightRef.current) return
    finishInFlightRef.current = true
    setSubmitting(true)
    try {
      await haptic(8)
      if (!await claimUsername()) {
        setDirection(-1)
        setMode('setup')
        setSetupStep(0)
        return
      }
      const attemptYear = form.attemptYear || NEXT_ATTEMPT_YEAR
      const name = form.name.trim() || user?.name?.trim() || 'UPSC Aspirant'
      const nextProfile: StudentProfile = {
        ...form,
        name,
        attemptYear,
        targetExam: `CSE ${attemptYear}`,
        dailyTarget: form.dailyTarget || 10,
        gsFocus: form.gsFocus.length ? form.gsFocus : ['GS 1', 'GS 2', 'GS 3'],
      }
      const saved = await saveProfile(nextProfile)
      if (!saved) return
      saveSettings({
        name,
        target: nextProfile.dailyTarget,
        remind,
        reminderTime,
        hapticsEnabled,
      })
      setGsFilter({
        'GS 1': nextProfile.gsFocus.includes('GS 1'),
        'GS 2': nextProfile.gsFocus.includes('GS 2'),
        'GS 3': nextProfile.gsFocus.includes('GS 3'),
        'GS 4': nextProfile.gsFocus.includes('GS 4'),
      })
      try { localStorage.setItem('penni-read-lang', nextProfile.language === 'hindi' ? 'hi' : 'en') } catch { /* noop */ }
      onComplete()
    } finally {
      finishInFlightRef.current = false
      setSubmitting(false)
    }
  }

  function renderSetupStep() {
    if (setupStep === 0) {
      return (
        <>
          <div className="onboarding-heading">
            <span>Welcome to Penni</span>
            <h1>Choose how people find you.</h1>
            <p>{user?.name ? `${user.name}, pick a unique username and profile icon.` : 'Pick a unique username and profile icon for your Penni account.'}</p>
          </div>

          <label className="onboarding-username-field">
            <span>Choose a unique username <small>Required</small></span>
            <div className="username-input-wrap">
              <i aria-hidden="true">@</i>
              <input
                value={username}
                onChange={event => setUsername(event.target.value.toLowerCase().replace(/^@/, ''))}
                placeholder="your.username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={24}
                aria-describedby="onboarding-username-feedback"
                autoFocus
              />
            </div>
            <small
              id="onboarding-username-feedback"
              className={`username-status ${usernameFeedback.kind}`}
              aria-live="polite"
            >
              {usernameFeedback.kind === 'available' && <FontAwesomeIcon icon={faCheck} />}
              {usernameFeedback.message}
            </small>
          </label>

          <section className="student-mascot-select onboarding-avatar-select" aria-label="Choose a profile icon">
            <div className="onboarding-group-label"><span>Choose a profile icon</span><small>Change it anytime</small></div>
            <div className="student-mascot-grid onboarding-avatar-strip">
              {PROFILE_MASCOTS.map(mascot => (
                <button
                  key={mascot.id}
                  type="button"
                  className={form.mascotId === mascot.id ? 'active' : ''}
                  onClick={() => { void haptic(5); patch({ mascotId: mascot.id }) }}
                  aria-label={`Choose ${mascot.name}`}
                  aria-pressed={form.mascotId === mascot.id}
                >
                  <ProfileMascot id={mascot.id} size="sm" selected={form.mascotId === mascot.id} />
                  <small>{mascot.name}</small>
                </button>
              ))}
            </div>
          </section>
        </>
      )
    }

    if (setupStep === 1) {
      return (
        <>
          <div className="onboarding-heading">
            <span>Your preparation</span>
            <h1>Meet you where you are.</h1>
            <p>These choices tune the daily briefing and practice suggestions.</p>
          </div>

          <ChoiceGroup label="Target attempt" icon={<FontAwesomeIcon icon={faBullseye} />}>
            {attemptYears.map(year => (
              <button key={year} type="button" className={form.attemptYear === year ? 'active' : ''} onClick={() => patch({ attemptYear: year, targetExam: `CSE ${year}` })} aria-pressed={form.attemptYear === year}>
                {year}
              </button>
            ))}
          </ChoiceGroup>

          <ChoiceGroup label="Reading language" icon={<FontAwesomeIcon icon={faLanguage} />}>
            {LANGUAGES.map(language => (
              <button key={language.value} type="button" className={form.language === language.value ? 'active' : ''} onClick={() => patch({ language: language.value })} aria-pressed={form.language === language.value}>
                {language.label}
              </button>
            ))}
          </ChoiceGroup>
        </>
      )
    }

    return (
      <>
        <div className="onboarding-heading">
          <span>Your daily rhythm</span>
          <h1>Keep it useful, not noisy.</h1>
          <p>Set a realistic pace. Every preference remains editable in Settings.</p>
        </div>

        <ChoiceGroup label="Daily MCQ target" icon={<FontAwesomeIcon icon={faBullseye} />}>
          {DAILY_TARGETS.map(target => (
            <button key={target} type="button" className={form.dailyTarget === target ? 'active' : ''} onClick={() => patch({ dailyTarget: target })} aria-pressed={form.dailyTarget === target}>
              <b>{target}</b><small>questions</small>
            </button>
          ))}
        </ChoiceGroup>

        <ChoiceGroup label="Focus papers" icon={<FontAwesomeIcon icon={faLayerGroup} />}>
          {GS_OPTIONS.map(subject => (
            <button key={subject} type="button" className={form.gsFocus.includes(subject) ? 'active' : ''} onClick={() => toggleGs(subject)} aria-pressed={form.gsFocus.includes(subject)}>
              {form.gsFocus.includes(subject) && <FontAwesomeIcon icon={faCheck} />} {subject}
            </button>
          ))}
        </ChoiceGroup>

        <section className="onboarding-preferences" aria-label="App preferences">
          <div className="onboarding-preference-row">
            <span className="preference-icon"><FontAwesomeIcon icon={faBell} /></span>
            <span><b>Daily revision nudge</b><small>One quiet reminder at a time you choose.</small></span>
            <button type="button" className={`onboarding-switch ${remind ? 'on' : ''}`} onClick={() => setRemind(value => !value)} aria-label="Toggle daily revision reminder" aria-pressed={remind}><i /></button>
          </div>
          {remind && (
            <label className="onboarding-time-choice">
              <FontAwesomeIcon icon={faClock} /><span>Remind me at</span>
              <input type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)} aria-label="Reminder time" />
            </label>
          )}
          <div className="onboarding-preference-row">
            <span className="preference-icon"><FontAwesomeIcon icon={faMobileScreenButton} /></span>
            <span><b>Subtle haptics</b><small>Gentle feedback for study actions.</small></span>
            <button type="button" className={`onboarding-switch ${hapticsEnabled ? 'on' : ''}`} onClick={() => setHapticsEnabled(value => !value)} aria-label="Toggle haptic feedback" aria-pressed={hapticsEnabled}><i /></button>
          </div>
        </section>
      </>
    )
  }

  return (
    <main
      ref={rootRef}
      className="penni-onboarding"
      style={{ '--onboarding-accent': accent } as CSSProperties}
      aria-label={mode === 'setup' ? 'Set up your Penni profile' : 'Preview Penni features'}
    >
      <div className="onboarding-aurora" aria-hidden="true" />

      <header className="onboarding-topbar">
        <span className="onboarding-wordmark">Penni<i>.</i></span>
        {(mode === 'tour' || setupStep > 0) && (
          <button type="button" onClick={() => void finish()} disabled={loading || submitting || transitioning}>
            {mode === 'tour' ? 'Skip tour' : 'Skip preferences'}
          </button>
        )}
      </header>

      <div className="onboarding-progress" role="progressbar" aria-label={mode === 'setup' ? 'Profile setup progress' : 'Feature tour progress'} aria-valuemin={1} aria-valuemax={mode === 'setup' ? 3 : TOUR_FEATURES.length} aria-valuenow={mode === 'setup' ? setupStep + 1 : tourIndex + 1}>
        <span>{mode === 'setup' ? `Setup ${setupStep + 1} of 3` : `Feature ${tourIndex + 1} of ${TOUR_FEATURES.length}`}</span>
        <i><b style={{ width: `${((mode === 'setup' ? setupStep + 1 : tourIndex + 1) / (mode === 'setup' ? 3 : TOUR_FEATURES.length)) * 100}%` }} /></i>
      </div>

      {mode === 'tour' && (
        <nav className="onboarding-feature-nav" aria-label="Penni feature previews">
          {TOUR_FEATURES.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              className={index === tourIndex ? 'active' : ''}
              onClick={() => index !== tourIndex && move(() => setTourIndex(index), index > tourIndex ? 1 : -1)}
              aria-current={index === tourIndex ? 'step' : undefined}
            >
              <FontAwesomeIcon icon={feature.icon} /><span>{feature.nav}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="onboarding-main">
        <div ref={sceneRef} className={`onboarding-scene ${mode}`} aria-live="polite">
          {mode === 'setup' ? renderSetupStep() : (
            <>
              <div className="onboarding-heading feature-heading">
                <span>{activeTour.eyebrow}</span>
                <h1>{activeTour.title}</h1>
                <p>{activeTour.body}</p>
              </div>
              <FeaturePreview feature={activeTour} />
            </>
          )}
        </div>
      </div>

      {error && <p className="onboarding-error" role="alert">{error}</p>}

      <footer className="onboarding-footer">
        {(setupStep > 0 || mode === 'tour') ? (
          <button type="button" className="onboarding-back" onClick={back} disabled={loading || submitting || transitioning} aria-label="Go back">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        ) : <span className="onboarding-back-spacer" />}
        <button type="button" className="onboarding-next" onClick={next} disabled={loading || submitting || transitioning || (mode === 'setup' && setupStep === 0 && !usernameReady)}>
          {mode === 'setup'
            ? setupStep === 2 ? 'Preview Penni' : 'Continue'
            : tourIndex === TOUR_FEATURES.length - 1 ? 'Start learning' : 'Next feature'}
          <FontAwesomeIcon icon={mode === 'tour' && tourIndex === TOUR_FEATURES.length - 1 ? faCheck : faArrowRight} />
        </button>
        {mode === 'setup' && setupStep === 2 && (
          <button type="button" className="onboarding-skip-tour" onClick={() => void finish()} disabled={loading || submitting || transitioning}>Save &amp; skip tour</button>
        )}
      </footer>

      {(loading || submitting) && (
        <div className="onboarding-saving" role="status" aria-live="polite">
          <span>P<i /></span><b>Saving your Penni</b><small>Just a moment…</small>
        </div>
      )}
    </main>
  )
}
