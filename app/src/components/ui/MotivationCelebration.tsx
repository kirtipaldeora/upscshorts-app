import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { EASE, gsap, reducedMotion } from '@/anim/animations'

interface MotivationCelebrationProps {
  variant: 'article' | 'streak'
  icon: string
  eyebrow: string
  title: string
  message: string
  stat?: string
  statLabel?: string
  actionLabel?: string
  onDismiss: () => void
  durationMs?: number
}

export function MotivationCelebration({
  variant,
  icon,
  eyebrow,
  title,
  message,
  stat,
  statLabel,
  actionLabel,
  onDismiss,
  durationMs = 4300,
}: MotivationCelebrationProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef(onDismiss)
  const closeRef = useRef<() => void>(() => onDismiss())

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let closing = false
    let delayed: ReturnType<typeof gsap.delayedCall> | null = null

    const finish = () => {
      if (closing) return
      closing = true
      if (delayed) delayed.kill()
      if (reducedMotion()) {
        dismissRef.current()
        return
      }
      gsap.to(root, {
        autoAlpha: 0,
        y: -10,
        duration: 0.45,
        ease: 'power2.inOut',
        onComplete: () => dismissRef.current(),
      })
    }
    closeRef.current = finish

    if (reducedMotion()) {
      gsap.set(root, { autoAlpha: 1 })
    } else {
      const ctx = gsap.context(() => {
        const timeline = gsap.timeline()
        timeline
          .fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28, ease: 'power2.out' })
          .fromTo('.motivation-ambient', { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.8, ease: EASE.out }, 0)
          .fromTo('.motivation-symbol', { opacity: 0, scale: 0.45, rotate: -9 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.72, ease: 'back.out(1.8)' }, 0.08)
          .fromTo('.motivation-copy > *', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.065, ease: EASE.out }, 0.18)
          .fromTo('.motivation-spark', { opacity: 0, scale: 0.2, y: 10 }, { opacity: 0.72, scale: 1, y: 0, duration: 0.5, stagger: 0.04, ease: EASE.out }, 0.12)
          .fromTo('.motivation-action', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.38, ease: EASE.out }, 0.4)
      }, root)
      delayed = gsap.delayedCall(durationMs / 1000, finish)
      return () => {
        delayed?.kill()
        ctx.revert()
      }
    }

    delayed = gsap.delayedCall(durationMs / 1000, finish)
    return () => delayed?.kill()
  }, [durationMs])

  return (
    <div ref={rootRef} className={`motivation-overlay ${variant}`} role="status" aria-live="polite" aria-label={title}>
      <div className="motivation-ambient" aria-hidden="true" />
      <div className="motivation-sparks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => <i className="motivation-spark" key={index} />)}
      </div>
      <section className="motivation-copy">
        <span className="motivation-symbol" aria-hidden="true">{icon}</span>
        <span className="motivation-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{message}</p>
        {stat && statLabel && <span className="motivation-stat"><b>{stat}</b> {statLabel}</span>}
      </section>
      {actionLabel && (
        <button className="motivation-action" onClick={() => closeRef.current()}>
          {actionLabel}<FontAwesomeIcon icon={faArrowRight} />
        </button>
      )}
    </div>
  )
}
