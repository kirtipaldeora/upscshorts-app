import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHouse,
  faBookOpen,
  faDumbbell,
  faEarthAsia,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore, type Screen } from '@/stores/useAppStore'
import { useHaptic } from '@/hooks/useHaptic'
import { EASE, gsap, popElement, reducedMotion } from '@/anim/animations'

interface NavItem {
  screen?: Screen
  icon: typeof faHouse
  label: string
  action?: () => void
}

export function BottomNav() {
  const { activeScreen, setScreen } = useAppStore()
  const haptic = useHaptic()
  const navRef = useRef<HTMLElement>(null)

  const items: NavItem[] = [
    { screen: 'feed',     icon: faHouse,      label: 'Feed' },
    { screen: 'revise',   icon: faBookOpen,   label: 'Revise' },
    { screen: 'maps',     icon: faEarthAsia,  label: 'Maps' },
    { screen: 'practice', icon: faDumbbell,   label: 'Practice' },
    { screen: 'profile',  icon: faUser,       label: 'Profile' },
  ]

  async function handleTap(item: NavItem) {
    await haptic()
    if (item.action) {
      item.action()
    } else if (item.screen) {
      setScreen(item.screen)
    }
  }

  useEffect(() => {
    const nav = navRef.current
    if (!nav || reducedMotion()) return
    const tween = gsap.fromTo(nav,
      { opacity: 0, y: 18, scale: 0.96, xPercent: -50 },
      { opacity: 1, y: 0, scale: 1, xPercent: -50, duration: 0.48, ease: EASE.expo, clearProps: 'opacity' })
    return () => { tween.kill() }
  }, [])

  useEffect(() => {
    const nav = navRef.current
    if (!nav || reducedMotion()) return
    const active = nav.querySelector('.nav-item.active')
    popElement(active)
    if (active) {
      gsap.fromTo(active.querySelector('svg'),
        { y: 4, rotate: -8 },
        { y: 0, rotate: 0, duration: 0.42, ease: EASE.micro, clearProps: 'transform' })
    }
  }, [activeScreen])

  return (
    <nav
      ref={navRef}
      className="bottom-nav-motion"
      style={{
        position: 'absolute',
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 11,
        zIndex: 100,
      }}
    >
      {items.map((item) => {
        const isActive = item.screen ? activeScreen === item.screen : false
        return (
          <button
            key={item.label}
            onClick={() => handleTap(item)}
            className={`nav-item ${isActive ? 'active' : ''}`}
            style={{
              width: 54,
              height: 54,
              borderRadius: 19,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s cubic-bezier(0.3, 1.2, 0.4, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Premium liquid glass gloss highlight overlay */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%)',
                pointerEvents: 'none',
              }}
            />
            <FontAwesomeIcon
              icon={item.icon}
              style={{
                fontSize: 19,
                transition: 'transform 0.3s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            />
          </button>
        )
      })}
    </nav>
  )
}
