import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { fmtFull, fmtShort, dayName, TODAY, YESTERDAY } from '@/constants/categories'
import { useHaptic } from '@/hooks/useHaptic'

interface DateTabsProps {
  dates: string[]
  variant?: 'feed' | 'globe'
}

export function DateTabs({ dates, variant = 'feed' }: DateTabsProps) {
  const { selectedDate, setSelectedDate, getArticlesForDate } = useAppStore()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()
  const [draft, setDraft] = useState(() => splitDate(selectedDate))
  const draftRef = useRef(draft)

  useEffect(() => {
    if (open) {
      setDraft(splitDate(selectedDate))
      setPickerOpen(false)
    }
  }, [open, selectedDate])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

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
    if (!date) return
    setSelectedDate(date)
    setOpen(false)
  }

  function tickSound() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 520
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.06)
      window.setTimeout(() => void ctx.close(), 90)
    } catch { /* sound is optional */ }
  }

  async function nudge(part: 'day' | 'month' | 'year', delta: number) {
    setDraft(prev => {
      const next = normalizeDraft({ ...prev, [part]: prev[part] + delta })
      draftRef.current = next
      return next
    })
    tickSound()
    await haptic(5)
  }

  async function pickCurrent() {
    const date = toDateInput(draftRef.current)
    chooseDate(date)
    tickSound()
    await haptic(8)
  }

  const activeCount = getArticlesForDate(selectedDate).length
  const quickDates = [TODAY, YESTERDAY]
  const customActive = !quickDates.includes(selectedDate)
  const draftDate = toDateInput(draft)
  const draftCount = getArticlesForDate(draftDate).length
  const draftAvailable = dates.includes(draftDate)
  const selectedAvailable = dates.includes(selectedDate)
  const yearRange = useMemo(() => {
    const currentYear = splitDate(TODAY).year
    return { min: currentYear - 8, max: currentYear + 1 }
  }, [])

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
        <div className="issue-date-menu" role="menu" onPointerDown={(event) => event.stopPropagation()}>
          {quickDates.map((d) => {
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
          <div className={`issue-date-wheel-panel ${customActive ? 'active' : ''} ${pickerOpen ? 'open' : ''}`} role="menuitem">
            <button type="button" className="issue-date-wheel-head" onClick={() => setPickerOpen(v => !v)}>
              <span>
                <b>{customActive ? 'Selected date' : 'Choose from calendar'}</b>
                <i>
                  {customActive
                    ? `${fmtShort(selectedDate)} · ${activeCount} ${activeCount === 1 ? 'story' : 'stories'}${selectedAvailable ? '' : ' · no feed yet'}`
                    : 'Spin the date lens'}
                </i>
              </span>
                  {customActive && <FontAwesomeIcon icon={faCheck} />}
            </button>
            {pickerOpen && (
              <>
                <div className="issue-date-wheel" aria-label="Choose issue date">
                  <WheelColumn
                    label="Day"
                    value={draft.day}
                    previous={wrapNumber(draft.day - 1, 1, daysInMonth(draft.year, draft.month))}
                    next={wrapNumber(draft.day + 1, 1, daysInMonth(draft.year, draft.month))}
                    onUp={() => nudge('day', -1)}
                    onDown={() => nudge('day', 1)}
                  />
                  <WheelColumn
                    label="Month"
                    value={MONTHS[draft.month - 1].slice(0, 3)}
                    previous={MONTHS[wrapNumber(draft.month - 1, 1, 12) - 1].slice(0, 3)}
                    next={MONTHS[wrapNumber(draft.month + 1, 1, 12) - 1].slice(0, 3)}
                    onUp={() => nudge('month', -1)}
                    onDown={() => nudge('month', 1)}
                  />
                  <WheelColumn
                    label="Year"
                    value={draft.year}
                    previous={wrapNumber(draft.year - 1, yearRange.min, yearRange.max)}
                    next={wrapNumber(draft.year + 1, yearRange.min, yearRange.max)}
                    onUp={() => nudge('year', -1)}
                    onDown={() => nudge('year', 1)}
                  />
                </div>
                <button
                  type="button"
                  className="issue-date-picker-apply"
                  onClick={() => void pickCurrent()}
                >
                  {draftAvailable ? `Show ${draftCount} ${draftCount === 1 ? 'story' : 'stories'}` : 'Show this day'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface DateDraft {
  year: number
  month: number
  day: number
}

function splitDate(date: string): DateDraft {
  const [year, month, day] = date.split('-').map(Number)
  return normalizeDraft({ year: year || new Date().getFullYear(), month: month || 1, day: day || 1 })
}

function toDateInput(draft: DateDraft) {
  const normalized = normalizeDraft(draft)
  return `${normalized.year}-${String(normalized.month).padStart(2, '0')}-${String(normalized.day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function wrapNumber(value: number, min: number, max: number) {
  if (value < min) return max
  if (value > max) return min
  return value
}

function normalizeDraft(draft: DateDraft): DateDraft {
  const month = wrapNumber(draft.month, 1, 12)
  const maxDay = daysInMonth(draft.year, month)
  return {
    year: draft.year,
    month,
    day: wrapNumber(Math.min(draft.day, maxDay), 1, maxDay),
  }
}

interface WheelColumnProps {
  label: string
  value: string | number
  previous: string | number
  next: string | number
  onUp: () => void
  onDown: () => void
}

function WheelColumn({ label, value, previous, next, onUp, onDown }: WheelColumnProps) {
  return (
    <div className="date-wheel-col">
      <button type="button" aria-label={`Previous ${label}`} onClick={onUp}>‹</button>
      <span>{previous}</span>
      <b>{value}</b>
      <span>{next}</span>
      <button type="button" aria-label={`Next ${label}`} onClick={onDown}>›</button>
      <em>{label}</em>
    </div>
  )
}
