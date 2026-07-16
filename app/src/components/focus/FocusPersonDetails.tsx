import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faClock, faFire, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { FocusPerson } from './focusTypes'
import { compactFocusTime, FocusAvatar, formatFocusTime } from './FocusPrimitives'

interface FocusLivePeopleGridProps {
  people: FocusPerson[]
  selectedId?: string
  emptyTitle?: string
  emptyDetail?: string
  onSelect: (person: FocusPerson, trigger: HTMLElement) => void
}

export function FocusLivePeopleGrid({
  people,
  selectedId,
  emptyTitle = 'No one is studying right now',
  emptyDetail = 'Live members appear here only when they choose to share their focus status.',
  onSelect,
}: FocusLivePeopleGridProps) {
  const ordered = useMemo(
    () => [...people].sort((a, b) => Number(b.isLive) - Number(a.isLive) ||
      (b.isLive ? (b.liveSeconds ?? 0) - (a.liveSeconds ?? 0) : b.todaySeconds - a.todaySeconds)),
    [people],
  )

  if (!ordered.length) {
    return <div className="focus-live-people-empty"><FontAwesomeIcon icon={faClock} /><b>{emptyTitle}</b><p>{emptyDetail}</p></div>
  }

  return <div className="focus-live-people-grid">{ordered.map(person => (
    <button
      type="button"
      key={person.id}
      className={`${person.isLive ? 'live' : 'offline'} ${selectedId === person.id ? 'selected' : ''}`}
      aria-label={`${person.name}, ${person.isLive ? `studying for ${formatFocusTime(person.liveSeconds ?? 0, true)}` : person.analyticsShared ? `${compactFocusTime(person.todaySeconds)} focused today` : 'offline, totals private'}. Open study details`}
      onClick={event => onSelect(person, event.currentTarget)}
    >
      <span className="focus-study-desk" aria-hidden="true">
        <svg viewBox="0 0 72 60" role="presentation">
          <path className="desk" d="M8 39h56M12 39v16M60 39v16M12 47h48M51 12h10l-2.5 12h-9zM55 24v15" />
          {person.isLive && <>
            <circle className="person" cx="29" cy="18" r="6.5" />
            <path className="person" d="M19.5 38v-5.5c0-5.2 4.2-9.5 9.5-9.5s9.5 4.3 9.5 9.5V38M16 14l-3-2m3 8h-4m6-11-1.5-3" />
          </>}
        </svg>
        {person.isLive && <i />}
      </span>
      <b title={person.name}>{person.name}</b>
      <strong>{person.isLive ? formatFocusTime(person.liveSeconds ?? 0, true) : person.analyticsShared ? compactFocusTime(person.todaySeconds) : 'Private'}</strong>
      <small title={person.isLive ? person.subject || 'Focus session' : person.username ? `@${person.username}` : undefined}>{person.isLive ? person.subject || 'Focus session' : person.analyticsShared ? 'today' : 'totals hidden'}</small>
    </button>
  ))}</div>
}

interface FocusPersonDetailsProps {
  person: FocusPerson
  relationshipLabel: string
  restoreFocusTo?: HTMLElement | null
  onClose: () => void
  actions?: ReactNode
  busy?: boolean
}

type SharedMetric = { label: string; value: number }

export function FocusPersonDetails({
  person,
  relationshipLabel,
  restoreFocusTo,
  onClose,
  actions,
  busy = false,
}: FocusPersonDetailsProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const dragStartRef = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  onCloseRef.current = onClose
  const metrics: SharedMetric[] = [
    { label: 'Today', value: person.todaySeconds },
    { label: 'This week', value: person.weeklySeconds },
    { label: 'This month', value: person.monthlySeconds },
  ]
  const hasLoggedFocus = metrics.some(metric => metric.value > 0)

  useEffect(() => {
    const parentDialog = document.querySelector<HTMLElement>('.focus-secondary-sheet[aria-modal="true"]')
    const parentModal = parentDialog?.getAttribute('aria-modal') ?? null
    const parentHidden = parentDialog?.getAttribute('aria-hidden') ?? null
    const parentInert = parentDialog?.inert ?? false
    const previousOverflow = document.body.style.overflow

    if (parentDialog) {
      parentDialog.setAttribute('aria-modal', 'false')
      parentDialog.setAttribute('aria-hidden', 'true')
      parentDialog.inert = true
    }
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('.focus-person-sheet-close')?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter(element => element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) {
        event.preventDefault()
        sheetRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)!
      const active = document.activeElement
      if (event.shiftKey && (active === first || !sheetRef.current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !sheetRef.current.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (parentDialog) {
        if (parentModal === null) parentDialog.removeAttribute('aria-modal')
        else parentDialog.setAttribute('aria-modal', parentModal)
        if (parentHidden === null) parentDialog.removeAttribute('aria-hidden')
        else parentDialog.setAttribute('aria-hidden', parentHidden)
        parentDialog.inert = parentInert
      }
      if (restoreFocusTo?.isConnected) restoreFocusTo.focus()
    }
  }, [restoreFocusTo])

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return
    setDragY(Math.max(0, event.clientY - dragStartRef.current))
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
    if (dragY > 82) onClose()
    else setDragY(0)
  }

  function cancelDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
    setDragY(0)
  }

  const content = <div className="focus-person-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside
      ref={sheetRef}
      className="focus-person-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`${person.name} study details`}
      aria-busy={busy}
      tabIndex={-1}
      style={{ '--focus-person-drag': `${dragY}px` } as CSSProperties}
    >
      <div className="focus-person-sheet-handle" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}><i /></div>
      <button type="button" className="focus-person-sheet-close" onClick={onClose} aria-label="Close study details"><FontAwesomeIcon icon={faXmark} /></button>

      <header className="focus-person-sheet-profile">
        <FocusAvatar name={person.name} initials={person.initials} avatarUrl={person.avatarUrl} live={person.isLive} size="lg" />
        <div><span>{relationshipLabel}</span><h2>{person.name}</h2>{person.username && <p>@{person.username}</p>}</div>
        <em className={person.isLive ? 'live' : ''}>{person.isLive ? 'Studying now' : 'Currently offline'}</em>
      </header>

      <section className={`focus-person-current ${person.isLive ? 'live' : ''}`}>
        <div><span>{person.isLive ? 'Current focus session' : 'Current status'}</span><b>{person.isLive ? person.subject || 'Focus session' : 'Not studying right now'}</b></div>
        {person.isLive ? <p><FontAwesomeIcon icon={faClock} /><span>Focused for</span><b>{formatFocusTime(person.liveSeconds ?? 0, true)}</b></p> : <p><FontAwesomeIcon icon={faFire} /><span>Consistency</span><b>{person.streak ? `${person.streak}-day streak` : 'No shared streak'}</b></p>}
      </section>

      <section className="focus-person-analytics">
        <div className="focus-person-analytics-head"><div><span>Shared analytics</span><h3>Focus rhythm</h3></div><FontAwesomeIcon icon={faChartLine} /></div>
        <div className={`focus-person-periods ${person.analyticsShared ? '' : 'private'}`}>{metrics.map(metric => <article key={metric.label}><span>{metric.label}</span><b>{person.analyticsShared ? compactFocusTime(metric.value) : 'Private'}</b></article>)}</div>
        <p>{person.analyticsShared
          ? hasLoggedFocus
            ? 'These period totals are server-verified. Individual sessions, breaks and app activity remain private.'
            : 'This person shares aggregate analytics but has no verified focus time in these periods yet.'
          : 'This person keeps aggregate focus analytics private. Live subject and elapsed time can still appear separately when enabled.'}</p>
      </section>

      {actions && <div className="focus-person-sheet-actions">{actions}</div>}
    </aside>
  </div>

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
