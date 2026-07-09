import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { gsap, reducedMotion } from '@/anim/animations'

const FeedCosmicGlobe = lazy(() => import('./FeedCosmicGlobe').then(module => ({ default: module.FeedCosmicGlobe })))

const STAR_COUNT = 42

function shouldUseLiteBackdrop() {
  if (typeof window === 'undefined') return true
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean }
    deviceMemory?: number
  }
  return Boolean(
    window.matchMedia('(max-width: 820px), (pointer: coarse)').matches ||
    nav.connection?.saveData ||
    (nav.deviceMemory && nav.deviceMemory <= 4),
  )
}

export function FeedCosmicBackdrop() {
  const shellRef = useRef<HTMLDivElement>(null)
  const globeWrapRef = useRef<HTMLDivElement>(null)
  const [lite, setLite] = useState(() => shouldUseLiteBackdrop())

  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      x: (i * 37) % 100,
      y: (i * 61) % 100,
      size: 1 + ((i * 13) % 22) / 10,
      delay: (i * 0.21) % 3.8,
      alpha: 0.24 + ((i * 19) % 42) / 100,
    }))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px), (pointer: coarse)')
    const update = () => setLite(shouldUseLiteBackdrop())
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.feed-cosmic-globe-wrap', { opacity: 0, scale: lite ? 0.96 : 0.9, y: lite ? 10 : 28 }, { opacity: 1, scale: 1, y: 0, duration: lite ? 0.65 : 1.2, ease: 'expo.out' })
      if (!lite) {
        gsap.to('.feed-cosmic-ring', { rotate: 360, duration: 64, ease: 'none', repeat: -1, stagger: 7 })
        gsap.to('.feed-cosmic-star', { opacity: 'random(0.22,0.74)', scale: 'random(0.82,1.18)', duration: 'random(2.6,4.6)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.035 })
        gsap.to('.feed-cosmic-nebula', { xPercent: 3, yPercent: -2, scale: 1.035, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      }
    }, shell)
    return () => ctx.revert()
  }, [lite])

  useEffect(() => {
    if (reducedMotion()) return
    const target = globeWrapRef.current
    if (!target) return
    let frame = 0
    let nextX = 0
    let nextY = 0

    const move = (x: number, y: number) => {
      nextX = x
      nextY = y
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        target.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) rotate(${nextX * 0.01}deg)`
        frame = 0
      })
    }

    const onPointer = (event: PointerEvent) => {
      if (lite) return
      const nx = (event.clientX / window.innerWidth - 0.5) * 2
      const ny = (event.clientY / window.innerHeight - 0.5) * 2
      move(nx * 14, ny * 9)
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      const gamma = Math.max(-14, Math.min(14, event.gamma ?? 0))
      const beta = Math.max(-14, Math.min(14, (event.beta ?? 0) - 45))
      move(gamma * 0.42, beta * 0.22)
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('deviceorientation', onOrientation, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrientation)
      if (frame) window.cancelAnimationFrame(frame)
      target.style.transform = ''
    }
  }, [lite])

  return (
    <div ref={shellRef} className={`feed-cosmic-backdrop ${lite ? 'is-lite' : 'is-rich'}`} aria-hidden="true">
      <div className="feed-cosmic-nebula" />
      <div className="feed-cosmic-stars">
        {stars.map(star => (
          <i
            key={star.id}
            className="feed-cosmic-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: star.alpha,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <span className="feed-cosmic-shooting one" />
      <span className="feed-cosmic-shooting two" />
      <div ref={globeWrapRef} className="feed-cosmic-globe-wrap">
        <div className="feed-cosmic-ring ring-a" />
        <div className="feed-cosmic-ring ring-b" />
        {lite ? (
          <div className="feed-cosmic-planet" />
        ) : (
          <Suspense fallback={<div className="feed-cosmic-planet" />}>
            <FeedCosmicGlobe />
          </Suspense>
        )}
      </div>
      <div className="feed-cosmic-haze" />
    </div>
  )
}
