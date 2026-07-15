import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faClockRotateLeft, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { FocusSubjectChoice } from './focusTypes'
import './FocusSubjectManager.css'

interface FocusSubjectManagerProps {
  choices: FocusSubjectChoice[]
  open: boolean
  onClose: () => void
  onToggle: (id: string, selected: boolean) => boolean | void
  onCreate: (name: string) => string | null
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function normaliseName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function goalLabel(seconds: number) {
  if (seconds <= 0) return null
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min daily goal`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours} hr${hours === 1 ? '' : 's'}${remainder ? ` ${remainder} min` : ''} daily goal`
}

export function FocusSubjectManager({ choices, open, onClose, onToggle, onCreate }: FocusSubjectManagerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const historyNoteId = useId()
  const inputId = useId()
  const inputHelpId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const suggested = choices.filter(choice => !choice.custom)
  const custom = choices.filter(choice => choice.custom)
  const selectedCount = choices.filter(choice => choice.selected).length

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDraft('')
    setError('')
    setStatus('')

    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus())

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(element => element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown, true)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  function toggleChoice(choice: FocusSubjectChoice, selected: boolean) {
    setError('')
    setStatus('')
    const changed = onToggle(choice.id, selected)
    if (changed === false) {
      setError(`“${choice.label}” could not be ${selected ? 'shown' : 'hidden'} right now. Finish any active session using it and try again.`)
      return
    }
    setStatus(`${choice.label} ${selected ? 'shown in' : 'hidden from'} your focus timer.`)
  }

  function submitCustomSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatus('')

    const name = cleanName(draft).slice(0, 50)
    if (!name) {
      setError('Enter a subject name first.')
      inputRef.current?.focus()
      return
    }

    const duplicate = choices.find(choice => normaliseName(choice.label) === normaliseName(name))
    if (duplicate) {
      if (duplicate.selected) {
        setError(`“${duplicate.label}” is already chosen.`)
        inputRef.current?.focus()
        return
      }

      const restored = onToggle(duplicate.id, true)
      if (restored === false) {
        setError(`“${duplicate.label}” already exists but could not be shown right now.`)
        inputRef.current?.focus()
        return
      }
      setDraft('')
      setStatus(`“${duplicate.label}” was already in your library and is now shown in the timer.`)
      inputRef.current?.focus()
      return
    }

    const createdId = onCreate(name)
    if (!createdId) {
      setError('That subject could not be added. Check whether it already exists and try again.')
      inputRef.current?.focus()
      return
    }

    setDraft('')
    setStatus(`“${name}” was added to your subjects.`)
    inputRef.current?.focus()
  }

  if (!open) return null

  return createPortal(
    <div className="focus-subject-manager-layer">
      <button
        className="focus-subject-manager-backdrop"
        type="button"
        tabIndex={-1}
        aria-label="Close subject manager"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="focus-subject-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId} ${historyNoteId}`}
        tabIndex={-1}
      >
        <header className="focus-subject-manager-head">
          <div>
            <span>Focus setup</span>
            <h2 id={titleId}>Choose your subjects</h2>
            <p id={descriptionId}>Keep the timer uncluttered by showing only what you are actively studying.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close subject manager">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className="focus-subject-manager-summary" aria-live="polite" aria-atomic="true">
          <strong>{selectedCount}</strong>
          <span>subject{selectedCount === 1 ? '' : 's'} chosen</span>
          <small>Changes apply immediately</small>
        </div>

        <div className="focus-subject-manager-scroll">
          <div className="focus-subject-manager-history" id={historyNoteId}>
            <FontAwesomeIcon icon={faClockRotateLeft} />
            <p><b>Your study history is safe.</b> Hiding a subject removes it from timer choices only. Past sessions remain in Analytics and your totals.</p>
          </div>

          <SubjectSection
            title="Suggested subjects"
            detail="Common UPSC study areas. Choose only the ones you use."
            choices={suggested}
            empty="No suggested subjects are available."
            onToggle={toggleChoice}
          />

          <SubjectSection
            title="My subjects"
            detail="Subjects you added yourself stay in your library even when hidden."
            choices={custom}
            empty="You have not added a custom subject yet."
            onToggle={toggleChoice}
          />

          <form className="focus-subject-manager-create" onSubmit={submitCustomSubject} noValidate>
            <div className="focus-subject-manager-create-copy">
              <label htmlFor={inputId}>Add your own subject</label>
              <span id={inputHelpId}>Use a clear name such as Sociology Optional.</span>
            </div>
            <div className="focus-subject-manager-create-row">
              <div>
                <input
                  ref={inputRef}
                  id={inputId}
                  value={draft}
                  onChange={event => {
                    setDraft(event.target.value)
                    setError('')
                    setStatus('')
                  }}
                  maxLength={50}
                  placeholder="Subject name"
                  autoComplete="off"
                  aria-describedby={inputHelpId}
                  aria-invalid={Boolean(error)}
                />
                <small aria-hidden="true">{draft.length}/50</small>
              </div>
              <button type="submit" disabled={!draft.trim()}>
                <FontAwesomeIcon icon={faPlus} /> Add
              </button>
            </div>
          </form>

          <div className="focus-subject-manager-message" aria-live="polite" aria-atomic="true">
            {error ? <p className="error" role="alert">{error}</p> : status ? <p className="success">{status}</p> : null}
          </div>
        </div>

        <footer className="focus-subject-manager-foot">
          <p>{selectedCount ? 'Your chosen subjects are ready in the timer.' : 'No subject selected — sessions will be saved as General Focus.'}</p>
          <button type="button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function SubjectSection({ title, detail, choices, empty, onToggle }: {
  title: string
  detail: string
  choices: FocusSubjectChoice[]
  empty: string
  onToggle: (choice: FocusSubjectChoice, selected: boolean) => void
}) {
  const headingId = useId()

  return (
    <section className="focus-subject-manager-section" aria-labelledby={headingId}>
      <div className="focus-subject-manager-section-head">
        <div><h3 id={headingId}>{title}</h3><p>{detail}</p></div>
        <span>{choices.filter(choice => choice.selected).length}/{choices.length} shown</span>
      </div>
      {choices.length ? (
        <div className="focus-subject-manager-list">
          {choices.map(choice => (
            <label className={choice.selected ? 'selected' : ''} key={choice.id}>
              <input
                type="checkbox"
                checked={choice.selected}
                onChange={event => onToggle(choice, event.target.checked)}
              />
              <span className="focus-subject-manager-check" aria-hidden="true">
                {choice.selected && <FontAwesomeIcon icon={faCheck} />}
              </span>
              <i style={{ backgroundColor: choice.color }} aria-hidden="true" />
              <span className="focus-subject-manager-choice-copy">
                <b>{choice.label}</b>
                {goalLabel(choice.goalSeconds) && <small>{goalLabel(choice.goalSeconds)}</small>}
              </span>
              {choice.hasHistory && <em>History kept</em>}
            </label>
          ))}
        </div>
      ) : <p className="focus-subject-manager-empty">{empty}</p>}
    </section>
  )
}
