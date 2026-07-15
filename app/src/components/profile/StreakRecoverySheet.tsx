import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFireFlameCurved } from '@fortawesome/free-solid-svg-icons'

interface StreakRecoverySheetProps {
  lastStreak: number
  onDismiss: () => void
  onPractice: () => void
}

export function StreakRecoverySheet({ lastStreak, onDismiss, onPractice }: StreakRecoverySheetProps) {
  return (
    <div className="streak-recovery-overlay" role="dialog" aria-modal="true" aria-label="Restart your streak">
      <button className="streak-recovery-scrim" onClick={onDismiss} aria-label="Dismiss" />
      <section className="streak-recovery-sheet">
        <div className="streak-recovery-icon"><FontAwesomeIcon icon={faFireFlameCurved} /></div>
        <span>Your rhythm paused</span>
        <h2>{lastStreak > 0 ? `${lastStreak}-day streak ended` : 'Start a fresh streak'}</h2>
        <p>One focused activity today is enough to begin again. Progress is built by returning, not by being perfect.</p>
        <button onClick={onPractice}>Start today’s practice</button>
        <button className="quiet" onClick={onDismiss}>Remind me later</button>
      </section>
    </div>
  )
}
