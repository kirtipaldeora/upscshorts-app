import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faCheck,
  faChevronDown,
  faMagnifyingGlass,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { fmtFull, fmtShort, dayName, TODAY, YESTERDAY } from '@/constants/categories'
import { useHaptic } from '@/hooks/useHaptic'

interface DateTabsProps {
  dates: string[]
  variant?: 'feed' | 'globe'
}

interface DateDraft {
  year: number
  month: number
  day: number
}

interface WheelOption {
  value: number
  label: string
  hasNews: boolean
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function DateTabs({ dates, variant = 'feed' }: DateTabsProps) {
  const { selectedDate, setSelectedDate, getArticlesForDate, setScreen } = useAppStore()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => splitDate(selectedDate))
  const wrapRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const haptic = useHaptic()

  const availableDates = useMemo(() => new Set(dates), [dates])
  const currentYear = splitDate(TODAY).year
  const yearRange = useMemo(() => {
    const publishedYears = dates
      .map(date => Number(date.slice(0, 4)))
      .filter(year => Number.isInteger(year) && year >= 2000 && year <= currentYear + 5)
    return {
      min: Math.min(currentYear - 5, ...publishedYears),
      max: Math.max(currentYear + 1, ...publishedYears),
    }
  }, [currentYear, dates])

  useEffect(() => {
    if (open) setDraft(splitDate(selectedDate))
  }, [open, selectedDate])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const draftDate = toDateInput(draft)
  const activeCount = getArticlesForDate(selectedDate).length
  const draftCount = getArticlesForDate(draftDate).length
  const draftAvailable = availableDates.has(draftDate)
  const selectedAvailable = availableDates.has(selectedDate)

  const dayOptions = useMemo<WheelOption[]>(() => {
    return Array.from({ length: daysInMonth(draft.year, draft.month) }, (_, index) => {
      const value = index + 1
      const date = toDateInput({ ...draft, day: value })
      return { value, label: String(value).padStart(2, '0'), hasNews: availableDates.has(date) }
    })
  }, [availableDates, draft.month, draft.year])

  const monthOptions = useMemo<WheelOption[]>(() => {
    return MONTHS.map((label, index) => {
      const value = index + 1
      const prefix = `${draft.year}-${String(value).padStart(2, '0')}-`
      return { value, label, hasNews: dates.some(date => date.startsWith(prefix)) }
    })
  }, [dates, draft.year])

  const yearOptions = useMemo<WheelOption[]>(() => {
    return Array.from({ length: yearRange.max - yearRange.min + 1 }, (_, index) => {
      const value = yearRange.min + index
      return {
        value,
        label: String(value),
        hasNews: dates.some(date => date.startsWith(`${value}-`)),
      }
    })
  }, [dates, yearRange.max, yearRange.min])

  function getLabel(date: string) {
    if (date === TODAY) return 'Today'
    if (date === YESTERDAY) return 'Yesterday'
    return dayName(date)
  }

  function chooseDate(date: string) {
    if (!date) return
    setSelectedDate(date)
    setOpen(false)
    void haptic(8)
  }

  function updateDraft(part: keyof DateDraft, value: number) {
    setDraft(previous => normalizeDraft({ ...previous, [part]: value }))
    void haptic(4)
  }

  const quickDates = [TODAY, YESTERDAY]

  return (
    <div ref={wrapRef} className={`issue-date-wrap ${open ? 'open' : ''} ${variant === 'globe' ? 'globe-date-wrap' : ''}`}>
      <button
        type="button"
        className={`issue-date-button ${open ? 'active' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? dialogId : undefined}
      >
        <FontAwesomeIcon icon={faCalendarDays} />
        <span>
          <b>{getLabel(selectedDate)}</b>
          <i>{fmtFull(selectedDate)} · {activeCount} stories</i>
        </span>
        {selectedAvailable && <i className="issue-date-live-dot" aria-label="Briefing available" />}
        <FontAwesomeIcon className="issue-date-chevron" icon={faChevronDown} />
      </button>

      {variant === 'feed' && (
        <button
          type="button"
          className="issue-date-search"
          onClick={() => setScreen('search')}
          aria-label="Search the briefing"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            className="issue-date-scrim"
            aria-label="Close date picker"
            onClick={() => setOpen(false)}
          />
          <section
            id={dialogId}
            className="issue-date-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Choose briefing date"
            onPointerDown={event => event.stopPropagation()}
          >
            <header className="issue-date-menu-head">
              <span>
                <small>Briefing archive</small>
                <b>{fmtShort(draftDate)}</b>
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close date picker">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>

            <div className="issue-date-quick" aria-label="Recent briefings">
              {quickDates.map(date => {
                const active = date === selectedDate
                const available = availableDates.has(date)
                const articleCount = getArticlesForDate(date).length
                return (
                  <button
                    key={date}
                    type="button"
                    className={`${active ? 'active' : ''} ${available ? 'available' : ''}`}
                    onClick={() => chooseDate(date)}
                  >
                    <span>
                      <b>{getLabel(date)}</b>
                      <small>{articleCount} {articleCount === 1 ? 'story' : 'stories'}</small>
                    </span>
                    {available && <i aria-hidden="true" />}
                    {active && <FontAwesomeIcon icon={faCheck} />}
                  </button>
                )
              })}
            </div>

            <div className="issue-date-availability-key">
              <i aria-hidden="true" />
              <span>Dot marks a published briefing</span>
              <b>{availableDates.size} available</b>
            </div>

            <div className="issue-date-wheel" aria-label="Scroll to choose a day, month and year">
              <WheelColumn
                label="Day"
                value={draft.day}
                options={dayOptions}
                onChange={value => updateDraft('day', value)}
              />
              <WheelColumn
                label="Month"
                value={draft.month}
                options={monthOptions}
                onChange={value => updateDraft('month', value)}
              />
              <WheelColumn
                label="Year"
                value={draft.year}
                options={yearOptions}
                onChange={value => updateDraft('year', value)}
              />
            </div>

            <div className={`issue-date-selection ${draftAvailable ? 'available' : ''}`}>
              <i aria-hidden="true" />
              <span>
                <b>{fmtFull(draftDate)}</b>
                <small>
                  {draftAvailable
                    ? `${draftCount} ${draftCount === 1 ? 'story' : 'stories'} ready to read`
                    : 'No briefing has been published for this day'}
                </small>
              </span>
            </div>

            <button
              type="button"
              className="issue-date-picker-apply"
              onClick={() => chooseDate(draftDate)}
            >
              {draftAvailable ? `Open ${draftCount || ''} ${draftCount === 1 ? 'story' : 'stories'}` : 'View this date'}
            </button>
          </section>
        </>
      )}
    </div>
  )
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

function normalizeDraft(draft: DateDraft): DateDraft {
  const month = Math.min(12, Math.max(1, draft.month))
  const maxDay = daysInMonth(draft.year, month)
  return {
    year: draft.year,
    month,
    day: Math.min(maxDay, Math.max(1, draft.day)),
  }
}

interface WheelColumnProps {
  label: string
  value: number
  options: WheelOption[]
  onChange: (value: number) => void
}

const WHEEL_ROW_HEIGHT = 42

function WheelColumn({ label, value, options, onChange }: WheelColumnProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<number | null>(null)

  useEffect(() => {
    const index = Math.max(0, options.findIndex(option => option.value === value))
    trackRef.current?.scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior: 'auto' })
  }, [options, value])

  useEffect(() => {
    return () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    }
  }, [])

  function settleSelection() {
    const track = trackRef.current
    if (!track || options.length === 0) return
    const index = Math.min(options.length - 1, Math.max(0, Math.round(track.scrollTop / WHEEL_ROW_HEIGHT)))
    const nextValue = options[index].value
    if (nextValue !== value) onChange(nextValue)
    track.scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior: 'smooth' })
  }

  function onScroll() {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(settleSelection, 80)
  }

  function moveTo(nextValue: number, behavior: ScrollBehavior = 'smooth') {
    const index = options.findIndex(option => option.value === nextValue)
    if (index < 0) return
    trackRef.current?.scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior })
    if (nextValue !== value) onChange(nextValue)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = Math.max(0, options.findIndex(option => option.value === value))
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault()
      moveTo(options[index - 1].value)
    } else if (event.key === 'ArrowDown' && index < options.length - 1) {
      event.preventDefault()
      moveTo(options[index + 1].value)
    }
  }

  return (
    <div className="date-wheel-col">
      <span className="date-wheel-label">{label}</span>
      <div
        ref={trackRef}
        className="date-wheel-track"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={`date-wheel-item ${option.hasNews ? 'has-news' : ''}`}
            onClick={() => moveTo(option.value)}
          >
            <span>{option.label}</span>
            {option.hasNews && <i aria-label="Briefing available" />}
          </button>
        ))}
      </div>
    </div>
  )
}
