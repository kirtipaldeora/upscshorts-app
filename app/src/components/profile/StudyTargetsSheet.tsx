import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBookOpen,
  faCheck,
  faDumbbell,
  faFilePen,
  faGraduationCap,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { StudyTargets } from '@/stores/usePracticeStore'

interface StudyTargetsSheetProps {
  initial: StudyTargets
  dailyMcqs: number
  onClose: () => void
  onSave: (targets: StudyTargets) => void
}

const TARGETS = [
  { id: 'prelims', icon: faDumbbell, title: 'Daily Prelims', description: 'Complete your daily MCQ target.' },
  { id: 'mains', icon: faFilePen, title: 'Daily Mains', description: 'Write and evaluate one answer.' },
  { id: 'news', icon: faBookOpen, title: 'News analysis', description: 'Finish one current-affairs Deep Dive.' },
  { id: 'gs', icon: faGraduationCap, title: 'GS learning', description: 'Complete five Atlas practice answers.' },
] as const

export function StudyTargetsSheet({ initial, dailyMcqs, onClose, onSave }: StudyTargetsSheetProps) {
  const [draft, setDraft] = useState(initial)
  const enabled = Object.values(draft).filter(Boolean).length

  function toggle(id: keyof StudyTargets) {
    setDraft(value => ({ ...value, [id]: !value[id] }))
  }

  return (
    <div className="targets-overlay" role="dialog" aria-modal="true" aria-label="Study targets">
      <button className="targets-scrim" onClick={onClose} aria-label="Close targets" />
      <section className="targets-sheet">
        <header className="targets-head">
          <div><span>Build a sustainable routine</span><h2>My targets</h2></div>
          <button onClick={onClose} aria-label="Close targets"><FontAwesomeIcon icon={faXmark} /></button>
        </header>
        <p className="targets-intro">Choose the activities you want Penni to keep visible each day. You can change them anytime.</p>
        <div className="targets-list">
          {TARGETS.map(item => {
            const active = draft[item.id]
            return (
              <button key={item.id} className={active ? 'active' : ''} onClick={() => toggle(item.id)}>
                <i><FontAwesomeIcon icon={item.icon} /></i>
                <span><b>{item.title}</b><small>{item.id === 'prelims' ? `${dailyMcqs} MCQs · ${item.description}` : item.description}</small></span>
                <em>{active ? <FontAwesomeIcon icon={faCheck} /> : '+'}</em>
              </button>
            )
          })}
        </div>
        <div className="targets-footnote"><FontAwesomeIcon icon={faCheck} /> {enabled || 'No'} target{enabled === 1 ? '' : 's'} selected</div>
        <button className="targets-save" disabled={enabled === 0} onClick={() => onSave(draft)}>Save targets</button>
      </section>
    </div>
  )
}
