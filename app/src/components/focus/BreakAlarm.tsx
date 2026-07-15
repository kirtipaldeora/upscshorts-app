import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBell, faBellSlash, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { startBreakAlarmSound } from '@/lib/focusNotifications'
import './BreakAlarm.css'

interface BreakAlarmProps {
  breakKind: 'short-break' | 'long-break'
  soundEnabled: boolean
  extending?: boolean
  onFinish: () => void
  onExtend: () => void | Promise<void>
  onSoundChange: (enabled: boolean) => void
}

const SWIPE_COMPLETE_RATIO = 0.72

export function BreakAlarm({
  breakKind,
  soundEnabled,
  extending = false,
  onFinish,
  onExtend,
  onSoundChange,
}: BreakAlarmProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const knobRef = useRef<HTMLButtonElement>(null)
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null)
  const focusEffectGenerationRef = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const generation = ++focusEffectGenerationRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    knobRef.current?.focus({ preventScroll: true })

    return () => {
      window.requestAnimationFrame(() => {
        // React Strict Mode can immediately remount an effect. Do not let the
        // stale cleanup steal focus back out of the live alarm.
        if (focusEffectGenerationRef.current !== generation) return
        const isAvailable = (element: HTMLElement | null): element is HTMLElement => Boolean(
          element?.isConnected &&
          element.getClientRects().length > 0 &&
          !element.closest('[inert], [aria-hidden="true"]'),
        )
        const fallback = [...document.querySelectorAll<HTMLElement>(
          '[data-focus-alarm-return], .focus-screen button:not(:disabled), .screen.active button:not(:disabled), .bottom-nav button:not(:disabled)',
        )].find(isAvailable) ?? null
        const target = isAvailable(previousFocus) ? previousFocus : fallback
        if (target) target.focus({ preventScroll: true })
        else document.body.focus({ preventScroll: true })
      })
    }
  }, [])

  useEffect(() => {
    if (!soundEnabled) return
    return startBreakAlarmSound()
  }, [soundEnabled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && soundEnabled) {
        event.preventDefault()
        onSoundChange(false)
        return
      }
      if (event.key !== 'Tab') return
      const controls = [...(sheetRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSoundChange, soundEnabled])

  function maxDrag() {
    const track = trackRef.current
    const knob = knobRef.current
    if (!track || !knob) return 0
    return Math.max(0, track.clientWidth - knob.offsetWidth - 12)
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (extending || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    dragStartRef.current = { x: event.clientX, offset: dragX }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = dragStartRef.current
    if (!start) return
    setDragX(Math.min(maxDrag(), Math.max(0, start.offset + event.clientX - start.x)))
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = dragStartRef.current
    const limit = maxDrag()
    const finalX = start
      ? Math.min(limit, Math.max(0, start.offset + event.clientX - start.x))
      : dragX
    dragStartRef.current = null
    setDragging(false)
    if (limit > 0 && finalX >= limit * SWIPE_COMPLETE_RATIO) {
      setDragX(limit)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      onFinish()
      return
    }
    setDragX(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const releaseReady = dragX >= maxDrag() * SWIPE_COMPLETE_RATIO && dragX > 0
  const breakLabel = breakKind === 'long-break' ? 'Long break' : 'Short break'

  return (
    <div className="focus-break-alarm-backdrop">
      <section
        ref={sheetRef}
        className="focus-break-alarm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="focus-break-alarm-title"
        aria-describedby="focus-break-alarm-description"
        aria-busy={extending}
      >
        <div className="focus-break-alarm-pulse" aria-hidden="true"><FontAwesomeIcon icon={faCheck} /></div>
        <p className="focus-break-alarm-eyebrow">{breakLabel} complete</p>
        <h2 id="focus-break-alarm-title">Ready to focus again?</h2>
        <p id="focus-break-alarm-description" className="focus-break-alarm-copy">Your break is finished. Swipe when you are ready, or take five more minutes without losing your study flow.</p>

        <button
          className={`focus-break-alarm-sound ${soundEnabled ? 'enabled' : ''}`}
          type="button"
          onClick={() => onSoundChange(!soundEnabled)}
          aria-pressed={soundEnabled}
        >
          <FontAwesomeIcon icon={soundEnabled ? faBell : faBellSlash} aria-hidden="true" />
          {soundEnabled ? 'Alarm sounding · tap to silence' : 'Alarm silent · tap for sound'}
        </button>

        <div className={`focus-break-swipe ${releaseReady ? 'ready' : ''}`} ref={trackRef}>
          <span>{releaseReady ? 'Release to finish' : 'Swipe to finish break'}</span>
          <i aria-hidden="true">››</i>
          <button
            ref={knobRef}
            type="button"
            disabled={extending}
            aria-label="Swipe right to finish break. Press Enter to finish with a keyboard."
            style={{ transform: `translate3d(${dragX}px, 0, 0)` }}
            className={dragging ? 'dragging' : ''}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => { dragStartRef.current = null; setDragging(false); setDragX(0) }}
            onLostPointerCapture={() => {
              if (!dragStartRef.current) return
              dragStartRef.current = null
              setDragging(false)
              setDragX(0)
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onFinish()
              }
            }}
          >
            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          </button>
        </div>

        <button className="focus-break-extend" type="button" disabled={extending} onClick={() => void onExtend()}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          {extending ? 'Starting five more minutes…' : 'Add 5 more minutes'}
        </button>
      </section>
    </div>
  )
}
