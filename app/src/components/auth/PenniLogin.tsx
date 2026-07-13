import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faApple,
  faGoogle,
} from '@fortawesome/free-brands-svg-icons'
import {
  faArrowRight,
  faBookOpen,
  faChevronDown,
  faDumbbell,
  faEarthAsia,
  faLayerGroup,
  faNewspaper,
  faPhone,
  faShieldHalved,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useAuthStore } from '@/stores/useAuthStore'
import { useHaptic } from '@/hooks/useHaptic'

interface PenniLoginProps {
  onAuthenticated: () => void
}

const FEATURE_TRACK = [
  { label: 'Read', title: 'Daily Briefing', icon: faNewspaper, color: '#4aa8ff', body: 'Current affairs organised by date, GS area and exam relevance.' },
  { label: 'Learn', title: 'Deep Dive', icon: faBookOpen, color: '#8b7cf6', body: 'Every article becomes a structured UPSC explanation.' },
  { label: 'Practice', title: 'Daily Mission', icon: faDumbbell, color: '#ff8b8b', body: 'Question journeys that build habit without clutter.' },
  { label: 'Map', title: 'Atlas Arcade', icon: faEarthAsia, color: '#55c99b', body: 'Geography practice with clean motion and memory cues.' },
  { label: 'Revise', title: 'Recall Loop', icon: faLayerGroup, color: '#ffb23f', body: 'Mistakes, bookmarks and weak areas come back at the right time.' },
]

export function PenniLogin({ onAuthenticated }: PenniLoginProps) {
  const { user, isGuest, loading, error, supabaseConfigured, signInOAuth, sendOtp, verifyOtp, continueAsGuest, clearError } = useAuthStore()
  const [feature, setFeature] = useState(0)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const featureRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()

  const active = FEATURE_TRACK[feature]

  useEffect(() => {
    if (user || isGuest) onAuthenticated()
  }, [user, isGuest, onAuthenticated])

  useEffect(() => {
    if (reducedMotion()) return
    const interval = window.setInterval(() => {
      setFeature((value) => (value + 1) % FEATURE_TRACK.length)
    }, 2100)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.login-brand', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE.expo })
      gsap.fromTo('.login-feature-focus', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.58, ease: EASE.expo })
      gsap.fromTo('.login-sheet', { y: 70, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.72, ease: EASE.expo, delay: 0.1 })
      gsap.to('.login-glow', { scale: 1.08, opacity: 0.95, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const featureEl = featureRef.current
    if (!featureEl || reducedMotion()) return
    gsap.fromTo(featureEl.querySelector('.login-word-loop'), { opacity: 0.9, y: 8 }, { opacity: 1, y: 0, duration: 0.34, ease: EASE.expo })
  }, [feature])

  async function runOAuth(provider: 'google' | 'apple') {
    await haptic(8)
    clearError()
    await signInOAuth(provider)
  }

  async function runPhone() {
    await haptic(8)
    clearError()
    if (!otpSent) {
      if (phone.replace(/\D/g, '').length < 10) return
      await sendOtp(phone.trim())
      setOtpSent(true)
    } else {
      if (otp.trim().length < 4) return
      await verifyOtp(phone.trim(), otp.trim())
    }
  }

  async function runGuest() {
    await haptic(8)
    clearError()
    await continueAsGuest()
  }

  return (
    <div ref={rootRef} className="login-screen" style={{ '--feature-color': active.color } as CSSProperties}>
      <div className="login-glow" aria-hidden="true" />
      <div className="login-brand">
        <b>Penni<span>.</span></b>
        <i>{supabaseConfigured ? 'Secure cloud sync' : 'Preview login mode'}</i>
      </div>

      <div ref={featureRef} className="login-feature-focus">
        <div className="login-word-loop" aria-label="Penni features">
          {FEATURE_TRACK.map((item, index) => {
            const raw = index - feature
            const offset = Math.abs(raw) > 2 ? raw - Math.sign(raw) * FEATURE_TRACK.length : raw
            const distance = Math.abs(offset)
            return (
              <button
                key={item.label}
                className={`login-loop-word ${index === feature ? 'active' : ''}`}
                style={{
                  '--offset': offset,
                  '--distance': distance,
                  '--feature-color': item.color,
                } as CSSProperties}
                onClick={() => {
                  void haptic(5)
                  setFeature(index)
                }}
              >
                <span><FontAwesomeIcon icon={item.icon} /></span>
                <b>{item.label}</b>
              </button>
            )
          })}
        </div>
        <div className="login-value-copy">
          <span className="login-app-mark">P</span>
          <h1>Learn with Penni</h1>
          <p>Daily news, maps and practice.</p>
        </div>
      </div>

      <div className="login-sheet">
        <div className="login-sheet-head">
          <h2>Start with Penni</h2>
          <p>Save your progress across devices.</p>
        </div>

        <div className="login-actions">
          <button className="login-oauth" onClick={() => void runOAuth('apple')} disabled={loading}>
            <FontAwesomeIcon icon={faApple} />
            Continue with Apple
          </button>
          <button className="login-oauth" onClick={() => void runOAuth('google')} disabled={loading}>
            <FontAwesomeIcon icon={faGoogle} />
            Continue with Google
          </button>
          <button className={`login-phone-toggle ${phoneOpen ? 'open' : ''}`} onClick={() => { void haptic(6); setPhoneOpen(v => !v) }} disabled={loading}>
            <FontAwesomeIcon icon={faPhone} />
            Phone number
            <FontAwesomeIcon icon={phoneOpen ? faXmark : faChevronDown} />
          </button>
        </div>

        {phoneOpen && (
          <div className="login-phone-panel">
            <label>
              <span>Phone</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
            </label>
            {otpSent && (
              <label>
                <span>OTP</span>
                <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder={supabaseConfigured ? 'Enter code' : 'Any 4 digits'} inputMode="numeric" />
              </label>
            )}
            <button onClick={() => void runPhone()} disabled={loading}>
              {otpSent ? 'Verify and continue' : 'Send OTP'}
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
        <button className="login-skip" onClick={() => void runGuest()} disabled={loading}>
          Skip login for now
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
        <div className="login-trust">
          <FontAwesomeIcon icon={faShieldHalved} />
          <span>{supabaseConfigured ? 'Protected with Supabase Auth' : 'Add Supabase keys to enable real OAuth and OTP'}</span>
        </div>
      </div>

      {loading && (
        <div className="login-signing-layer" aria-live="polite">
          <span />
          <b>Signing you in</b>
          <i>Preparing Penni</i>
        </div>
      )}
    </div>
  )
}
