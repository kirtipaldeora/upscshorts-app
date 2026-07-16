import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAddressCard, faInbox, faUserPlus, faXmark } from '@fortawesome/free-solid-svg-icons'

export type FocusFriendsManageTab = 'add' | 'requests' | 'profile'

interface FocusFriendsManageSheetProps {
  activeTab: FocusFriendsManageTab
  requestCount: number
  restoreFocusTo: HTMLElement
  addPanel: ReactNode
  requestsPanel: ReactNode
  profilePanel: ReactNode
  onTabChange: (tab: FocusFriendsManageTab) => void
  onClose: () => void
}

const tabs: Array<{ id: FocusFriendsManageTab; label: string; icon: typeof faUserPlus }> = [
  { id: 'add', label: 'Add friend', icon: faUserPlus },
  { id: 'requests', label: 'Requests', icon: faInbox },
  { id: 'profile', label: 'My profile', icon: faAddressCard },
]

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0)
}

export function FocusFriendsManageSheet({
  activeTab,
  requestCount,
  restoreFocusTo,
  addPanel,
  requestsPanel,
  profilePanel,
  onTabChange,
  onClose,
}: FocusFriendsManageSheetProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  const dragStartRef = useRef<number | null>(null)
  const tabRefs = useRef<Record<FocusFriendsManageTab, HTMLButtonElement | null>>({ add: null, requests: null, profile: null })
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  closeRef.current = onClose

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
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('.focus-friends-manage-close')?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = focusableElements(sheetRef.current)
      if (!focusable.length) {
        event.preventDefault()
        sheetRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !sheetRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
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
      if (restoreFocusTo.isConnected) restoreFocusTo.focus()
    }
  }, [restoreFocusTo])

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = event.clientY
    setDragging(true)
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
    setDragging(false)
    if (dragY > 82) onClose()
    else setDragY(0)
  }

  function moveTab(current: FocusFriendsManageTab, direction: 1 | -1) {
    const currentIndex = tabs.findIndex(tab => tab.id === current)
    const next = tabs[(currentIndex + direction + tabs.length) % tabs.length]
    onTabChange(next.id)
    window.requestAnimationFrame(() => tabRefs.current[next.id]?.focus())
  }

  const panel = activeTab === 'add' ? addPanel : activeTab === 'requests' ? requestsPanel : profilePanel
  const content = (
    <div className="focus-friends-manage-portal">
      <div className="focus-friends-manage-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <aside
          ref={sheetRef}
          className={`focus-friends-manage-sheet ${dragging ? 'dragging' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="focus-friends-manage-title"
          tabIndex={-1}
          style={{ '--focus-friends-manage-drag': `${dragY}px` } as CSSProperties}
        >
          <div className="focus-friends-manage-handle" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}><i /></div>
          <header className="focus-friends-manage-head">
            <div><span>Study circle</span><h2 id="focus-friends-manage-title">Manage friends</h2></div>
            <button type="button" className="focus-friends-manage-close" onClick={onClose} aria-label="Close friend management"><FontAwesomeIcon icon={faXmark} /></button>
          </header>

          <nav className="focus-friends-manage-tabs" role="tablist" aria-label="Friend management">
            {tabs.map(tab => <button
              type="button"
              key={tab.id}
              ref={element => { tabRefs.current[tab.id] = element }}
              id={`focus-friends-${tab.id}-tab`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`focus-friends-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(tab.id, 1) }
                if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(tab.id, -1) }
                if (event.key === 'Home') { event.preventDefault(); onTabChange('add'); window.requestAnimationFrame(() => tabRefs.current.add?.focus()) }
                if (event.key === 'End') { event.preventDefault(); onTabChange('profile'); window.requestAnimationFrame(() => tabRefs.current.profile?.focus()) }
              }}
            ><FontAwesomeIcon icon={tab.icon} /><span>{tab.label}</span>{tab.id === 'requests' && requestCount > 0 && <b aria-label={`${requestCount} pending`}>{requestCount > 99 ? '99+' : requestCount}</b>}</button>)}
          </nav>

          <div
            className="focus-friends-manage-body"
            id={`focus-friends-${activeTab}-panel`}
            role="tabpanel"
            aria-labelledby={`focus-friends-${activeTab}-tab`}
          >{panel}</div>
        </aside>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
