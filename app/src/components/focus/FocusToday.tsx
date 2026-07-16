import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faChartLine,
  faChevronDown,
  faClock,
  faFire,
  faGear,
  faListCheck,
  faPause,
  faPlay,
  faShieldHalved,
  faSliders,
  faStop,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { gsap, reducedMotion } from '@/anim/animations'
import type {
  FocusPlatform,
  FocusPomodoroPhase,
  FocusProfile,
  FocusSessionRecord,
  FocusSubject,
  FocusSubjectChoice,
  FocusTimerMode,
  FocusTimerSettings,
  FocusTimerState,
} from './focusTypes'
import { compactFocusTime, formatFocusTime } from './FocusPrimitives'
import { FocusSubjectManager } from './FocusSubjectManager'
import './FocusTodayHome.css'

interface FocusTodayProps {
  profile: FocusProfile
  subjects: FocusSubject[]
  subjectChoices: FocusSubjectChoice[]
  subjectPlanConfigured: boolean
  sessions: FocusSessionRecord[]
  selectedSubjectId: string
  timerMode: FocusTimerMode
  timerState: FocusTimerState
  pomodoroPhase: FocusPomodoroPhase
  plannedSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  timerSettings: FocusTimerSettings
  platform: FocusPlatform
  nativeFocusShieldAvailable: boolean
  onSelectSubject: (subjectId: string) => void
  onSubjectSelectionChange: (subjectId: string, selected: boolean) => boolean | void
  onSubjectCreate: (name: string) => string | null
  onModeChange: (mode: FocusTimerMode) => void
  onPhaseChange: (phase: FocusPomodoroPhase) => void
  onPlannedSecondsChange: (seconds: number) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onOpenAnalytics: () => void
  onOpenFriends: () => void
  onOpenSettings: () => void
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function phaseLabel(phase: FocusPomodoroPhase) {
  if (phase === 'short-break') return 'Short break'
  if (phase === 'long-break') return 'Long break'
  return 'Focus block'
}

function phaseShortLabel(phase: FocusPomodoroPhase) {
  if (phase === 'short-break') return 'Short'
  if (phase === 'long-break') return 'Long'
  return 'Focus'
}

function timerClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  const remaining = safe % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

export function FocusToday(props: FocusTodayProps) {
  const {
    profile, subjects, subjectChoices, subjectPlanConfigured, sessions, selectedSubjectId, timerMode, timerState,
    pomodoroPhase, plannedSeconds, elapsedSeconds, remainingSeconds, timerSettings, platform,
    nativeFocusShieldAvailable, onSelectSubject, onSubjectSelectionChange, onSubjectCreate, onModeChange,
    onPhaseChange, onPlannedSecondsChange, onStart, onPause, onResume, onFinish, onOpenAnalytics,
    onOpenFriends, onOpenSettings,
  } = props
  const homeRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const [customMinutes, setCustomMinutes] = useState('')
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  const [subjectManagerOpen, setSubjectManagerOpen] = useState(false)
  const selectedSubject = subjects.find(subject => subject.id === selectedSubjectId)
  const todayStart = startOfToday()
  const completedToday = sessions.filter(session => session.completed && session.endedAt >= todayStart)
  const savedTodaySeconds = completedToday.reduce((sum, session) => sum + session.focusedSeconds, 0)
  const liveContribution = timerState !== 'idle' && pomodoroPhase === 'focus' ? elapsedSeconds : 0
  const todaySeconds = savedTodaySeconds + liveContribution
  const hasDailyGoal = profile.dailyGoalSeconds > 0
  const dailyProgress = hasDailyGoal ? Math.min(100, Math.round(todaySeconds / profile.dailyGoalSeconds * 100)) : 0
  const timerDisplay = timerMode === 'pomodoro' ? remainingSeconds : elapsedSeconds
  const timerProgress = timerMode === 'pomodoro' && plannedSeconds > 0
    ? Math.min(100, Math.max(0, elapsedSeconds / plannedSeconds * 100))
    : 0
  const defaultFocusLengths = [...new Set([timerSettings.focusSeconds || 1_500, 3_000])]
  const customDurationActive = timerMode === 'pomodoro' && pomodoroPhase === 'focus' && !defaultFocusLengths.includes(plannedSeconds)
  const canStart = timerMode === 'stopwatch' || plannedSeconds > 0
  const dayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const sessionLabel = timerMode === 'stopwatch'
    ? 'Open focus block'
    : phaseLabel(pomodoroPhase)
  const startLabel = timerMode === 'stopwatch'
    ? 'Start stopwatch'
    : pomodoroPhase === 'focus' ? 'Start focus' : `Start ${phaseLabel(pomodoroPhase).toLowerCase()}`

  useEffect(() => {
    if (timerState === 'idle') setFinishConfirmOpen(false)
    else setSubjectManagerOpen(false)
  }, [timerState])

  useEffect(() => {
    if (!customDurationActive || timerState !== 'idle') return
    setCustomMinutes(String(Math.round(plannedSeconds / 60)))
  }, [customDurationActive, plannedSeconds, timerState])

  useEffect(() => {
    const home = homeRef.current
    if (!home || reducedMotion()) return
    const context = gsap.context(() => {
      gsap.fromTo('[data-focus-home-enter]',
        { opacity: 0, y: 9 },
        { opacity: 1, y: 0, duration: 0.38, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity' })
    }, home)
    return () => context.revert()
  }, [])

  useEffect(() => {
    const timer = timerRef.current
    if (!timer || reducedMotion()) return
    const tween = gsap.fromTo(timer,
      { scale: 0.985 },
      { scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' })
    return () => { tween.kill() }
  }, [pomodoroPhase, timerMode, timerState])

  function applyCustomMinutes() {
    const minutes = Number(customMinutes)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) return
    const safeMinutes = Math.round(minutes)
    setCustomMinutes(String(safeMinutes))
    onPlannedSecondsChange(safeMinutes * 60)
  }

  function handleCustomKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    applyCustomMinutes()
    event.currentTarget.blur()
  }

  function requestFinish() {
    if (timerSettings.strictMode && timerState === 'running') {
      setFinishConfirmOpen(true)
      return
    }
    onFinish()
  }

  return (
    <div
      ref={homeRef}
      className={`focus-view focus-today-home mode-${timerMode} state-${timerState} phase-${pomodoroPhase}`}
    >
      <section className="fth-console" aria-label="Focus timer">
        <header className="fth-summary" data-focus-home-enter>
          <div>
            <span>{dayLabel}</span>
            <b>{compactFocusTime(todaySeconds)} focused</b>
            <small>{hasDailyGoal ? `${dailyProgress}% of ${compactFocusTime(profile.dailyGoalSeconds)} goal` : 'Set a daily goal in Settings'}</small>
          </div>
          <span className="fth-streak"><FontAwesomeIcon icon={faFire} /><b>{profile.currentStreak}</b><small>day streak</small></span>
        </header>

        <div className="fth-mode-switch" role="tablist" aria-label="Timer mode" data-focus-home-enter>
          <button role="tab" aria-selected={timerMode === 'pomodoro'} className={timerMode === 'pomodoro' ? 'active' : ''} disabled={timerState !== 'idle'} onClick={() => onModeChange('pomodoro')}><FontAwesomeIcon icon={faClock} /> Pomodoro</button>
          <button role="tab" aria-selected={timerMode === 'stopwatch'} className={timerMode === 'stopwatch' ? 'active' : ''} disabled={timerState !== 'idle'} onClick={() => onModeChange('stopwatch')}><FontAwesomeIcon icon={faBolt} /> Stopwatch</button>
        </div>
        <p className="fth-mode-hint" aria-live="polite" data-focus-home-enter>{timerMode === 'stopwatch'
          ? 'No countdown · pause and continue the same session, then save it once.'
          : 'A timed focus block followed by a short or long break.'}</p>

        <div className="fth-session-setup" data-focus-home-enter>
          {subjects.length ? (
            <label className="fth-subject-select">
              <span>Subject</span>
              <div style={{ '--fth-subject': selectedSubject?.color ?? 'var(--focus-blue)' } as CSSProperties}>
                <i aria-hidden="true" />
                <select value={selectedSubjectId} onChange={event => onSelectSubject(event.target.value)} disabled={timerState !== 'idle'} aria-label="Focus subject (optional)">
                  <option value="">General Focus (no subject)</option>
                  {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                </select>
                <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
              </div>
            </label>
          ) : (
            <button className="fth-subject-empty" type="button" onClick={() => setSubjectManagerOpen(true)} disabled={timerState !== 'idle'}>
              <span>Subject · optional</span><b>{subjectPlanConfigured ? 'General Focus' : 'Add subjects (optional)'}</b><FontAwesomeIcon icon={faSliders} />
            </button>
          )}

          {timerMode === 'pomodoro' && (
            <div className="fth-pomodoro-options">
              <div className="fth-phase-switch" aria-label="Pomodoro phase">
                {(['focus', 'short-break', 'long-break'] as FocusPomodoroPhase[]).map(phase => (
                  <button key={phase} className={pomodoroPhase === phase ? 'active' : ''} disabled={timerState !== 'idle'} onClick={() => onPhaseChange(phase)}>{phaseShortLabel(phase)}</button>
                ))}
              </div>
              {pomodoroPhase === 'focus' ? (
                <div className="fth-duration-switch" aria-label="Focus duration">
                  {defaultFocusLengths.map((seconds, index) => <button key={seconds} className={plannedSeconds === seconds ? 'active' : ''} onClick={() => onPlannedSecondsChange(seconds)} disabled={timerState !== 'idle'}><b>{Math.round(seconds / 60)}</b><span>{index === 0 ? 'default' : 'min'}</span></button>)}
                  <label className={customDurationActive ? 'active' : ''}><input type="number" min="1" max="180" inputMode="numeric" value={customMinutes} onChange={event => setCustomMinutes(event.target.value)} onBlur={applyCustomMinutes} onKeyDown={handleCustomKeyDown} disabled={timerState !== 'idle'} placeholder="—" aria-label="Custom focus minutes" /><span>custom</span></label>
                </div>
              ) : (
                <p className="fth-break-length">{Math.round((pomodoroPhase === 'short-break' ? timerSettings.shortBreakSeconds : timerSettings.longBreakSeconds) / 60)} min break</p>
              )}
            </div>
          )}
        </div>

        <div className="fth-timer-stage" data-focus-home-enter>
          <div
            ref={timerRef}
            className={`fth-timer-ring ${timerState}`}
            style={{ '--fth-progress': timerProgress } as CSSProperties}
            aria-live="off"
          >
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle className="fth-ring-track" cx="110" cy="110" r="101" pathLength="100" />
              <circle className="fth-ring-progress" cx="110" cy="110" r="101" pathLength="100" />
            </svg>
            <div>
              <span>{sessionLabel}</span>
              <b>{timerClock(timerDisplay)}</b>
              <small>{timerState === 'paused' ? (timerMode === 'stopwatch' ? 'Paused · focused time is safe' : 'Paused') : timerState === 'running' ? (timerMode === 'pomodoro' ? `${Math.round(timerProgress)}% complete` : 'No countdown · counting up') : selectedSubject?.label ?? 'General Focus'}</small>
            </div>
          </div>
        </div>

        <div className="fth-session-actions" data-focus-home-enter>
          {timerState === 'idle' && <button className="primary" onClick={onStart} disabled={!canStart}><FontAwesomeIcon icon={faPlay} /> {startLabel}</button>}
          {timerState === 'running' && <button className="primary" onClick={onPause}><FontAwesomeIcon icon={faPause} /> Pause</button>}
          {timerState === 'paused' && <button className="primary" onClick={onResume}><FontAwesomeIcon icon={faPlay} /> Resume</button>}
          {timerState !== 'idle' && <button className="secondary" onClick={requestFinish}><FontAwesomeIcon icon={faStop} /> Finish</button>}
        </div>
      </section>

      <nav className="fth-shortcuts" aria-label="Focus shortcuts" data-focus-home-enter>
        <button onClick={() => setSubjectManagerOpen(true)} disabled={timerState !== 'idle'}><FontAwesomeIcon icon={faListCheck} /><span><b>Plan</b><small>{subjects.length ? `${subjects.length} selected` : 'Choose subjects'}</small></span></button>
        <button onClick={onOpenAnalytics}><FontAwesomeIcon icon={faChartLine} /><span><b>Analytics</b><small>Progress</small></span></button>
        <button onClick={onOpenFriends}><FontAwesomeIcon icon={faUsers} /><span><b>Circle</b><small>Friends & groups</small></span></button>
        <button onClick={onOpenSettings}><FontAwesomeIcon icon={faGear} /><span><b>Settings</b><small>Timer & Shield</small></span></button>
      </nav>

      {timerState !== 'idle' && timerSettings.fullscreenSessions && (
        <div className="focus-session-layer" role="dialog" aria-modal="true" aria-label="Active focus session">
          <div className="focus-session-sheet">
            <div className="focus-session-head"><span>{timerMode === 'pomodoro' ? phaseLabel(pomodoroPhase) : 'Stopwatch'} · {selectedSubject?.label ?? 'General Focus'}</span><button onClick={requestFinish}>Finish</button></div>
            <div className={`focus-session-orbit ${timerState}`}><i><FontAwesomeIcon icon={timerState === 'running' ? faBolt : faPause} /></i><div><span>{timerState === 'running' ? 'Focusing' : 'Paused'}</span><b>{formatFocusTime(timerDisplay, true)}</b><small>{timerMode === 'pomodoro' ? `${compactFocusTime(elapsedSeconds)} completed` : timerState === 'paused' ? 'Paused time is not counted' : 'One continuous saved session'}</small></div></div>
            <div className="focus-session-actions">{timerState === 'running' ? <button className="primary" onClick={onPause}><FontAwesomeIcon icon={faPause} /> Pause</button> : <button className="primary" onClick={onResume}><FontAwesomeIcon icon={faPlay} /> Resume</button>}<button onClick={requestFinish}><FontAwesomeIcon icon={faStop} /> Save & finish</button></div>
            <div className="focus-session-truth"><FontAwesomeIcon icon={faShieldHalved} /><p><b>{platform === 'web' ? 'Web session' : `${platform.toUpperCase()} session`}</b>{platform === 'web' ? 'This timer cannot block other apps or tabs. Focus Shield provides guidance and tab-awareness only.' : nativeFocusShieldAvailable ? 'Native restrictions apply only after the device permission is granted.' : 'No app-blocking capability is active in this build.'}</p></div>
          </div>
        </div>
      )}

      {finishConfirmOpen && timerState !== 'idle' && (
        <div className="focus-finish-confirm-backdrop" role="presentation" onClick={() => setFinishConfirmOpen(false)}>
          <section className="focus-finish-confirm" role="dialog" aria-modal="true" aria-label="Finish focus session" onClick={event => event.stopPropagation()}>
            <i><FontAwesomeIcon icon={faStop} /></i><span>Strict mode</span><h3>Finish this block early?</h3>
            <p>{compactFocusTime(elapsedSeconds)} will be submitted as focused time. {timerMode === 'pomodoro' ? `The countdown still has ${compactFocusTime(remainingSeconds)} remaining.` : 'The open-ended stopwatch will stop now.'}</p>
            <div><button onClick={() => setFinishConfirmOpen(false)}>Keep focusing</button><button className="danger" onClick={() => { setFinishConfirmOpen(false); onFinish() }}>Finish block</button></div>
          </section>
        </div>
      )}

      <FocusSubjectManager choices={subjectChoices} open={subjectManagerOpen} onClose={() => setSubjectManagerOpen(false)} onToggle={onSubjectSelectionChange} onCreate={onSubjectCreate} />
    </div>
  )
}
