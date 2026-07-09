import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'

gsap.registerPlugin(Flip)

/* ─── Shared motion language ─────────────────────────────────── */
export const DUR = { xs: 0.25, sm: 0.35, md: 0.5, lg: 0.7 }
export const EASE = {
  out: 'power3.out',
  expo: 'expo.out',
  micro: 'back.out(1.8)',   // tiny micro-interactions only
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ─── useGsapReveal — fade/slide a single element on mount ───── */
export function useGsapReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const tween = gsap.fromTo(el,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: DUR.md, ease: EASE.out, clearProps: 'transform' })
    return () => { tween.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

/* ─── useStaggerReveal — stagger direct children (cards, sections) ─ */
export function useStaggerReveal<T extends HTMLElement>(
  selector: string,
  deps: unknown[] = [],
  opts: { y?: number; stagger?: number; delay?: number } = {},
) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const targets = el.querySelectorAll(selector)
    if (!targets.length) return
    const tween = gsap.fromTo(targets,
      { opacity: 0, y: opts.y ?? 18 },
      {
        opacity: 1, y: 0,
        duration: DUR.md,
        ease: EASE.out,
        stagger: opts.stagger ?? 0.06,
        delay: opts.delay ?? 0,
        clearProps: 'transform,opacity',
      })
    return () => { tween.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

/* ─── usePageTransition — consistent screen enter ─────────────── */
export function usePageTransition<T extends HTMLElement>(key?: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const tween = gsap.fromTo(el,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: EASE.out, clearProps: 'transform,opacity' })
    return () => { tween.kill() }
  }, [key])
  return ref
}

/* ─── useCardHover — lift + glow on pointer devices ───────────── */
export function useCardHover<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const enter = () => gsap.to(el, { y: -3, duration: DUR.sm, ease: EASE.out })
    const leave = () => gsap.to(el, { y: 0, duration: DUR.sm, ease: EASE.out })
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    return () => {
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
      gsap.killTweensOf(el)
    }
  }, [])
  return ref
}

/* ─── useFlipTransition — shared-element style state change ───── */
export function useFlipTransition() {
  return {
    capture(targets: gsap.DOMTarget) {
      try { return Flip.getState(targets) } catch { return null }
    },
    play(state: ReturnType<typeof Flip.getState> | null) {
      if (!state || reducedMotion()) return
      try {
        Flip.from(state, { duration: DUR.md, ease: EASE.out, absolute: true, nested: true })
      } catch { /* non-fatal */ }
    },
  }
}

/* ─── Micro-interactions ──────────────────────────────────────── */
export function popElement(el: Element | null) {
  if (!el || reducedMotion()) return
  gsap.fromTo(el, { scale: 0.75 }, { scale: 1, duration: 0.4, ease: EASE.micro, clearProps: 'scale' })
}

export function burstElement(el: Element | null, color = 'var(--yellow)') {
  if (!el || reducedMotion() || typeof document === 'undefined') return
  const rect = (el as HTMLElement).getBoundingClientRect()
  const burst = document.createElement('span')
  burst.className = 'motion-burst'
  Object.assign(burst.style, {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    '--burst': color,
  } as unknown as CSSStyleDeclaration)
  document.body.appendChild(burst)
  gsap.fromTo(burst,
    { opacity: 0.8, scale: 0.25 },
    { opacity: 0, scale: 1.7, duration: 0.5, ease: 'power2.out', onComplete: () => burst.remove() })
}

export function pulseCorrect(el: Element | null) {
  if (!el || reducedMotion()) return
  gsap.fromTo(el, { scale: 0.985 }, { scale: 1, duration: 0.45, ease: EASE.micro, clearProps: 'scale' })
}

export function shakeWrong(el: Element | null) {
  if (!el || reducedMotion()) return
  gsap.fromTo(el, { x: -5 }, {
    x: 0, duration: 0.4, ease: 'elastic.out(1, 0.35)', clearProps: 'x',
  })
}

/* ─── Theme wipe — circular overlay so themes never hard-snap ── */
export function themeWipe(originX: number, originY: number, applyTheme: () => void) {
  if (reducedMotion() || typeof document === 'undefined') { applyTheme(); return }
  const overlay = document.createElement('div')
  const r = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY),
  )
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '2000', pointerEvents: 'none',
    background: 'var(--app-bg)',
    clipPath: `circle(0px at ${originX}px ${originY}px)`,
  } as CSSStyleDeclaration)
  applyTheme()
  document.body.appendChild(overlay)
  gsap.fromTo(overlay,
    { clipPath: `circle(${r}px at ${originX}px ${originY}px)`, opacity: 1 },
    {
      clipPath: `circle(0px at ${originX}px ${originY}px)`,
      duration: 0.65, ease: 'power2.inOut',
      onComplete: () => overlay.remove(),
    })
}

export { gsap, Flip }
