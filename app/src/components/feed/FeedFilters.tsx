import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faChevronDown,
  faMagnifyingGlass,
  faRotateLeft,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { fmtFull, TODAY, YESTERDAY } from '@/constants/categories'
import { useAppStore, type SourceFocus } from '@/stores/useAppStore'

interface FeedFiltersProps {
  dates: string[]
  storyCount: number
}

const SOURCE_OPTIONS: ReadonlyArray<{ value: SourceFocus; label: string }> = [
  { value: null, label: 'All sources' },
  { value: 'hindu', label: 'The Hindu' },
  { value: 'ie', label: 'Indian Express' },
  { value: 'pib', label: 'PIB' },
  { value: 'govt', label: 'Govt sources' },
]

function dateLabel(date: string) {
  const relative = date === TODAY ? 'Today' : date === YESTERDAY ? 'Yesterday' : null
  return relative ? `${relative} · ${fmtFull(date)}` : fmtFull(date)
}

export function FeedFilters({ dates, storyCount }: FeedFiltersProps) {
  const mobileTitleId = useId()
  const mobileDescriptionId = useId()
  const surfaceId = useId()
  const surfaceRef = useRef<HTMLElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const {
    selectedDate,
    setSelectedDate,
    sourceFocus,
    setSourceFocus,
    gsFocus,
    setGsFocus,
    getFocusableGsPapers,
    setScreen,
  } = useAppStore()

  const dateOptions = dates.includes(selectedDate) ? dates : [selectedDate, ...dates]
  const gsPapers = getFocusableGsPapers(selectedDate)
  const activeFilterCount = Number(sourceFocus !== null) + Number(gsFocus !== null)
  const storyLabel = `${storyCount} ${storyCount === 1 ? 'story' : 'stories'}`

  const closeMobileFilters = useCallback(() => {
    setMobileOpen(false)
    window.requestAnimationFrame(() => mobileTriggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    const focusFrame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileFilters()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = surfaceRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMobileFilters, mobileOpen])

  function updateSource(value: string) {
    const source = SOURCE_OPTIONS.find(option => (option.value ?? 'all') === value)?.value ?? null
    setSourceFocus(source)
  }

  function updateGsPaper(value: string) {
    setGsFocus(gsPapers.find(paper => paper === value) ?? null)
  }

  function resetFilters() {
    setSourceFocus(null)
    setGsFocus(null)
  }

  return (
    <>
      <button
        ref={mobileTriggerRef}
        type="button"
        className="feed-filter-button"
        onClick={() => setMobileOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
        aria-controls={surfaceId}
        aria-label={`Open issue filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
        title="Issue filters"
      >
        <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="feed-filters-mobile-scrim"
          onClick={closeMobileFilters}
          aria-label="Close issue filters"
        />
      )}

      <section
        ref={surfaceRef}
        id={surfaceId}
        className={`feed-filters-surface feed-filters-dialog ${mobileOpen ? 'mobile-open' : ''}`}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-labelledby={mobileOpen ? mobileTitleId : undefined}
        aria-describedby={mobileOpen ? mobileDescriptionId : undefined}
      >
        <header className="feed-filters-mobile-sheet-header">
          <i className="feed-filters-mobile-handle" aria-hidden="true" />
          <span>
            <b id={mobileTitleId}>Issue filters</b>
            <small id={mobileDescriptionId}>{dateLabel(selectedDate)} · {storyLabel}</small>
          </span>
          <button
            ref={mobileCloseRef}
            type="button"
            className="feed-filters-mobile-close"
            onClick={closeMobileFilters}
            aria-label="Close issue filters"
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </header>

      <div className="feed-filters-grid">
          <label className="feed-filters-field">
            <span className="feed-filters-label">
              <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
              Date
            </span>
            <span className="feed-filters-select-wrap">
              <select
                value={selectedDate}
                onChange={event => setSelectedDate(event.currentTarget.value)}
                aria-label="Briefing date"
              >
                {dateOptions.map(date => (
                  <option key={date} value={date}>{dateLabel(date)}</option>
                ))}
              </select>
              <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
            </span>
          </label>

          <label className="feed-filters-field">
            <span className="feed-filters-label">Source</span>
            <span className="feed-filters-select-wrap">
              <select
                value={sourceFocus ?? 'all'}
                onChange={event => updateSource(event.currentTarget.value)}
                aria-label="News source"
              >
                {SOURCE_OPTIONS.map(option => {
                  const value = option.value ?? 'all'
                  return <option key={value} value={value}>{option.label}</option>
                })}
              </select>
              <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
            </span>
          </label>

          <label className="feed-filters-field">
            <span className="feed-filters-label">GS paper</span>
            <span className="feed-filters-select-wrap">
              <select
                value={gsFocus ?? 'all'}
                onChange={event => updateGsPaper(event.currentTarget.value)}
                aria-label="GS paper"
                disabled={gsPapers.length === 0}
              >
                <option value="all">All GS papers</option>
                {gsPapers.map(paper => <option key={paper} value={paper}>{paper}</option>)}
              </select>
              <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
            </span>
          </label>
        </div>

        <footer className="feed-filters-actions">
          <button
            type="button"
            className="feed-filters-reset"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
          >
            <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            className="feed-filters-search"
            onClick={() => {
              setMobileOpen(false)
              setScreen('search')
            }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            Search briefing
          </button>
        </footer>
        <button
          type="button"
          className="feed-filters-mobile-apply"
          onClick={closeMobileFilters}
        >
          Apply · Show {storyLabel}
        </button>
      </section>
    </>
  )
}
