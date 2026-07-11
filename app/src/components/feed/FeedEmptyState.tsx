import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'
import { fmtFull, TODAY } from '@/constants/categories'
import { PenniCharacter } from '@/components/brand/PenniCharacter'

interface FeedEmptyStateProps {
  date: string
  animate?: boolean
}

export function FeedEmptyState({ date, animate = true }: FeedEmptyStateProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isToday = date === TODAY

  useEffect(() => {
    const el = ref.current
    if (!el || !animate || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.feed-empty-card', { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: 'expo.out' })
      gsap.to('.feed-empty-orbit', { rotate: 360, duration: 9, repeat: -1, ease: 'none', stagger: 0.4 })
      gsap.to('.feed-empty-core', { scale: 1.06, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.feed-empty-comet', { x: 12, y: -10, opacity: 0.72, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      const penni = el.querySelector<HTMLElement>('.feed-empty-penni')
      if (penni) {
        const system = el.querySelector<HTMLElement>('.feed-empty-system')
        const systemSize = system?.getBoundingClientRect().width ?? 148
        const radiusX = systemSize * 0.47
        const radiusY = systemSize * 0.38
        const run = { angle: -72 }
        gsap.to(run, {
          angle: 288,
          duration: 7.6,
          repeat: -1,
          ease: 'none',
          onUpdate: () => {
            const rad = (run.angle * Math.PI) / 180
            const x = Math.cos(rad) * radiusX
            const y = Math.sin(rad) * radiusY
            const depth = (Math.sin(rad) + 1) / 2
            const facingLeft = Math.cos(rad) < 0
            gsap.set(penni, {
              x,
              y,
              scale: 0.16 + depth * 0.06,
              rotate: Math.cos(rad) * 7,
              rotateY: facingLeft ? 180 : 0,
              opacity: 0.66 + depth * 0.34,
              zIndex: Math.round(2 + depth * 6),
            })
          },
        })
      }
    }, el)
    return () => ctx.revert()
  }, [animate, date])

  return (
    <div ref={ref} className={`feed-empty-state ${animate ? 'animated' : 'static'}`}>
      <div className="feed-empty-card">
        <div className="feed-empty-system" aria-hidden="true">
          <span className="feed-empty-core" />
          <span className="feed-empty-orbit orbit-one"><i /></span>
          <span className="feed-empty-orbit orbit-two"><i /></span>
          <span className="feed-empty-orbit orbit-three"><i /></span>
          <span className="feed-empty-comet" />
          <span className="feed-empty-penni-orbit">
            <PenniCharacter className="feed-empty-penni" bob={false} />
          </span>
        </div>
        <span>{fmtFull(date)}</span>
        <h3>Penni is busy</h3>
        <p>
          {isToday
            ? 'Drafting news for you.'
            : 'Drafting news for this day.'}
        </p>
      </div>
    </div>
  )
}
