import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { fmtFull, fmtShort, dayName, TODAY, YESTERDAY } from '@/constants/categories'

interface DateTabsProps {
  dates: string[]
  variant?: 'feed' | 'globe'
}

export function DateTabs({ dates, variant = 'feed' }: DateTabsProps) {
  const { selectedDate, setSelectedDate, getArticlesForDate } = useAppStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function getLabel(d: string) {
    if (d === TODAY) return 'Today'
    if (d === YESTERDAY) return 'Yesterday'
    return dayName(d)
  }

  function chooseDate(date: string) {
    setSelectedDate(date)
    setOpen(false)
  }

  const activeCount = getArticlesForDate(selectedDate).length

  return (
    <div ref={wrapRef} className={`issue-date-wrap ${variant === 'globe' ? 'globe-date-wrap' : ''}`}>
      <button
        type="button"
        className={`issue-date-button ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <FontAwesomeIcon icon={faCalendarDays} />
        <span>
          <b>{getLabel(selectedDate)}</b>
          <i>{fmtFull(selectedDate)} · {activeCount} stories</i>
        </span>
        <FontAwesomeIcon className="issue-date-chevron" icon={faChevronDown} />
      </button>

      {open && (
        <div className="issue-date-menu" role="menu">
          {dates.map((d) => {
            const active = d === selectedDate
            const articleCount = getArticlesForDate(d).length

            return (
              <button
                key={d}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`issue-date-option ${active ? 'active' : ''}`}
                onClick={() => chooseDate(d)}
              >
                <span>
                  <b>{getLabel(d)}</b>
                  <i>{fmtShort(d)} · {articleCount} stories</i>
                </span>
                {active && <FontAwesomeIcon icon={faCheck} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
