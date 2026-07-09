import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'

interface PenniLoaderProps {
  label?: string
  full?: boolean
  className?: string
}

export function PenniLoader({ label = 'Loading', full = false, className = '' }: PenniLoaderProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.penni-loader-word', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out' })
      gsap.to('.penni-loader-dot', { scale: 1.38, opacity: 0.58, duration: 0.55, ease: 'sine.inOut', repeat: -1, yoyo: true })
      gsap.to('.penni-loader-orbit', { rotate: 360, duration: 2.8, ease: 'none', repeat: -1 })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className={`penni-loader ${full ? 'full' : ''} ${className}`} role="status" aria-live="polite">
      <div className="penni-loader-mark" aria-hidden="true">
        <span className="penni-loader-orbit" />
        <b>P</b>
      </div>
      <div className="penni-loader-copy">
        <div className="penni-loader-word">
          Penni<span className="penni-loader-dot">.</span>
        </div>
        <span>{label}</span>
      </div>
    </div>
  )
}
