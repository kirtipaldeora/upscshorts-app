import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'
import { fmtFull, TODAY } from '@/constants/categories'

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
        </div>
        <span>{fmtFull(date)}</span>
        <h3>{isToday ? 'No briefing yet' : 'No briefing found'}</h3>
        <p>
          {isToday
            ? 'Today’s stories have not been published yet.'
            : 'There are no published stories for this day.'}
        </p>
      </div>
    </div>
  )
}
