import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHouse,
  faBookOpen,
  faDumbbell,
  faEarthAsia,
  faStopwatch,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore, type Screen } from '@/stores/useAppStore'
import {
  getActiveElapsedMs,
  getActiveRemainingMs,
  useFocusStore,
} from '@/stores/useFocusStore'
import { useHaptic } from '@/hooks/useHaptic'
import { EASE, gsap, popElement, reducedMotion } from '@/anim/animations'

interface NavItem {
  screen?: Screen
  icon: typeof faHouse
  label: string
  action?: () => void
}

function formatNavTimer(durationMs: number, countdown: boolean) {
  const totalSeconds = Math.max(0, countdown
    ? Math.ceil(durationMs / 1_000)
    : Math.floor(durationMs / 1_000))
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function BottomNav() {
  const { activeScreen, setScreen } = useAppStore()
  const activeFocusTimer = useFocusStore((state) => state.activeTimer)
  const [focusClock, setFocusClock] = useState(() => Date.now())
  const haptic = useHaptic()
  const navRef = useRef<HTMLElement>(null)

  const focusCountsDown = Boolean(
    activeFocusTimer &&
    activeFocusTimer.mode !== 'stopwatch' &&
    activeFocusTimer.plannedDurationMs !== null,
  )
  const focusTimeMs = activeFocusTimer
    ? focusCountsDown
      ? getActiveRemainingMs(activeFocusTimer, focusClock) ?? 0
      : getActiveElapsedMs(activeFocusTimer, focusClock)
    : 0
  const focusTimeLabel = activeFocusTimer
    ? formatNavTimer(focusTimeMs, focusCountsDown)
    : null
  const focusActivityLabel = activeFocusTimer
    ? `${activeFocusTimer.phase === 'focus'
      ? 'Focus session'
      : activeFocusTimer.phase === 'short-break'
        ? 'Short break'
        : 'Long break'} ${activeFocusTimer.status}`
    : null

  useEffect(() => {
    if (!activeFocusTimer || activeFocusTimer.status === 'paused') return
    setFocusClock(Date.now())
    const tick = window.setInterval(() => setFocusClock(Date.now()), 1_000)
    return () => window.clearInterval(tick)
  }, [activeFocusTimer?.id, activeFocusTimer?.status])

  const items: NavItem[] = [
    { screen: 'feed',     icon: faHouse,      label: 'Feed' },
    { screen: 'revise',   icon: faBookOpen,   label: 'Revise' },
    { screen: 'maps',     icon: faEarthAsia,  label: 'Maps' },
    { screen: 'focus',    icon: faStopwatch,  label: 'Focus' },
    { screen: 'practice', icon: faDumbbell,   label: 'Practice' },
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
        bottom: 'var(--app-bottom-nav-edge)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        width: 'calc(100% - 18px)',
        maxWidth: 430,
        zIndex: 100,
      }}
    >
      {items.map((item) => {
        const isActive = item.screen ? activeScreen === item.screen : false
        const isFocusItem = item.screen === 'focus'
        const itemLabel = isFocusItem && focusActivityLabel && focusTimeLabel
          ? `${item.label}, ${focusActivityLabel}, ${focusTimeLabel} ${focusCountsDown ? 'remaining' : 'elapsed'}`
          : item.label
        return (
          <button
            key={item.label}
            onClick={() => handleTap(item)}
            className={`nav-item ${isActive ? 'active' : ''} ${isFocusItem && activeFocusTimer ? `focus-timer-active focus-timer-${activeFocusTimer.status}` : ''}`}
            aria-label={itemLabel}
            aria-current={isActive ? 'page' : undefined}
            style={{
              width: 'clamp(46px, 14vw, 62px)',
              minWidth: 0,
              flex: '1 1 0',
              maxWidth: 62,
              height: 'var(--app-bottom-nav-height)',
              borderRadius: 18,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s cubic-bezier(0.3, 1.2, 0.4, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Premium liquid glass gloss highlight overlay */}
            <span
              className="nav-gloss"
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
                fontSize: 17,
                transition: 'transform 0.3s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            />
            {isFocusItem && activeFocusTimer && (
              <span
                className={`focus-nav-status ${activeFocusTimer.status}`}
                data-phase={activeFocusTimer.phase}
                title={focusActivityLabel ?? undefined}
                aria-hidden="true"
              />
            )}
            <span
              className={`nav-label ${isFocusItem && activeFocusTimer ? `nav-timer-label ${activeFocusTimer.status}` : ''}`}
              style={{ display: 'block' }}
            >
              {isFocusItem && focusTimeLabel ? focusTimeLabel : item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
