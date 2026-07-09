import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'

interface PenniCharacterProps {
  className?: string
}

export function PenniCharacter({ className = '' }: PenniCharacterProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.to(el, { x: 8, y: -2, duration: 0.72, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className={`penni-character ${className}`} role="img" aria-label="Penni running with a sling bag">
      <span className="penni-shadow" />
      <span className="penni-hair-back" />
      <span className="penni-head">
        <span className="penni-fringe" />
        <span className="penni-eye eye-left" />
        <span className="penni-eye eye-right" />
        <span className="penni-smile" />
      </span>
      <span className="penni-body">
        <span className="penni-strap" />
        <span className="penni-bag" />
      </span>
      <span className="penni-arm arm-back" />
      <span className="penni-arm arm-front" />
      <span className="penni-leg leg-back" />
      <span className="penni-leg leg-front" />
    </div>
  )
}
