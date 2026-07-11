import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'

interface PenniCharacterProps {
  className?: string
  bob?: boolean
}

export function PenniCharacter({ className = '', bob = true }: PenniCharacterProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !bob || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.to(el, { x: 8, y: -2, duration: 0.72, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, el)
    return () => ctx.revert()
  }, [bob])

  return (
    <div ref={ref} className={`penni-character ${className}`} role="img" aria-label="Penni running with a snack">
      <span className="penni-shadow" />
      <span className="penni-ponytail" />
      <span className="penni-hair-back" />
      <span className="penni-head">
        <span className="penni-fringe" />
        <span className="penni-cheek" />
        <span className="penni-eye eye-left" />
        <span className="penni-eye eye-right" />
        <span className="penni-mouth" />
      </span>
      <span className="penni-body">
        <span className="penni-shirt-light" />
        <span className="penni-shorts" />
      </span>
      <span className="penni-arm arm-back" />
      <span className="penni-arm arm-front">
        <span className="penni-snack" />
      </span>
      <span className="penni-leg leg-back" />
      <span className="penni-leg leg-front" />
    </div>
  )
}
