import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faApple, faGoogle } from '@fortawesome/free-brands-svg-icons'
import {
  faArrowRight,
  faBookOpen,
  faDumbbell,
  faEarthAsia,
  faLayerGroup,
  faNewspaper,
} from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import { useAuthStore } from '@/stores/useAuthStore'
import { useHaptic } from '@/hooks/useHaptic'
import './AuthExperience.css'

interface PenniLoginProps {
  onAuthenticated: () => void
}

const FEATURE_TRACK = [
  { label: 'Read', icon: faNewspaper, color: '#278cff' },
  { label: 'Understand', icon: faBookOpen, color: '#7c67ff' },
  { label: 'Practice', icon: faDumbbell, color: '#ff667d' },
  { label: 'Explore', icon: faEarthAsia, color: '#20b98c' },
  { label: 'Revise', icon: faLayerGroup, color: '#f4a52e' },
] as const

function circularOffset(index: number, active: number) {
  let offset = index - active
  const midpoint = FEATURE_TRACK.length / 2
  if (offset > midpoint) offset -= FEATURE_TRACK.length
  if (offset < -midpoint) offset += FEATURE_TRACK.length
  return offset
}

export function PenniLogin({ onAuthenticated }: PenniLoginProps) {
  const {
    user,
    isGuest,
    loading,
    error,
    supabaseConfigured,
    signInOAuth,
    continueAsGuest,
    clearError,
  } = useAuthStore()
  const [feature, setFeature] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeWordRef = useRef<HTMLSpanElement>(null)
  const haptic = useHaptic()
  const active = FEATURE_TRACK[feature]

  useEffect(() => {
    if (user || isGuest) onAuthenticated()
  }, [user, isGuest, onAuthenticated])

  useEffect(() => {
    if (reducedMotion()) return
    const interval = window.setInterval(() => {
      setFeature(value => (value + 1) % FEATURE_TRACK.length)
    }, 2200)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: EASE.expo } })
      timeline
        .fromTo('.entry-topline', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.55 })
        .fromTo('.entry-feature-rail', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7 }, '-=.3')
        .fromTo('.entry-promise > *', { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.055, duration: 0.55 }, '-=.42')
        .fromTo('.entry-actions > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: 0.055, duration: 0.5 }, '-=.3')
      gsap.to('.entry-aurora', { scale: 1.08, xPercent: 3, duration: 4.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const word = activeWordRef.current
    if (!word || reducedMotion()) return
    gsap.fromTo(word, { opacity: 0.25, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: EASE.expo })
  }, [feature])

  async function runProvider(provider: 'google' | 'apple') {
    await haptic(8)
    clearError()
    await signInOAuth(provider)
  }

  async function runGuest() {
    await haptic(8)
    clearError()
    await continueAsGuest()
  }

  return (
    <main
      ref={rootRef}
      className="penni-entry"
      style={{ '--entry-color': active.color } as CSSProperties}
      aria-label="Sign in to Penni"
    >
      <div className="entry-aurora" aria-hidden="true" />

      <header className="entry-topline">
        <span className="entry-wordmark">Penni<i>.</i></span>
        <span>{supabaseConfigured ? 'Your progress, safely synced' : 'Preview mode'}</span>
      </header>

      <section className="entry-feature-rail" aria-label="What you can do with Penni">
        {FEATURE_TRACK.map((item, index) => {
          const offset = circularOffset(index, feature)
          const distance = Math.abs(offset)
          return (
            <button
              key={item.label}
              type="button"
              className={index === feature ? 'active' : ''}
              style={{
                '--rail-offset': offset,
                '--rail-distance': distance,
                '--rail-color': item.color,
              } as CSSProperties}
              onClick={() => {
                void haptic(5)
                setFeature(index)
              }}
              aria-current={index === feature ? 'true' : undefined}
            >
              <span><FontAwesomeIcon icon={item.icon} /></span>
              <b ref={index === feature ? activeWordRef : undefined}>{item.label}</b>
            </button>
          )
        })}
      </section>

      <section className="entry-promise" aria-live="polite">
        <span className="entry-mark" aria-hidden="true">P</span>
        <h1>Your UPSC prep,<br />upgraded.</h1>
        <p>News, concepts, maps and practice—connected around what you need next.</p>
      </section>

      <section className="entry-actions" aria-label="Sign-in options">
        <button type="button" className="entry-provider primary" onClick={() => void runProvider('google')} disabled={loading}>
          <FontAwesomeIcon icon={faGoogle} />
          Continue with Google
        </button>
        <button type="button" className="entry-provider secondary" onClick={() => void runProvider('apple')} disabled={loading}>
          <FontAwesomeIcon icon={faApple} />
          Continue with Apple
        </button>
        {error && <p className="entry-error" role="alert">{error}</p>}
        <button type="button" className="entry-skip" onClick={() => void runGuest()} disabled={loading}>
          Skip all · explore as guest <FontAwesomeIcon icon={faArrowRight} />
        </button>
        <small>
          {supabaseConfigured
            ? 'Sign in once to keep your progress across devices.'
            : 'Google and Apple use a local preview until Supabase keys are added.'}
        </small>
      </section>

      {loading && (
        <div className="entry-loading" role="status" aria-live="polite">
          <span className="entry-loading-mark">P<i /></span>
          <b>Opening Penni</b>
          <small>Connecting your account…</small>
        </div>
      )}
    </main>
  )
}
