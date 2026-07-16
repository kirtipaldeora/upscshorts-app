import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faChartLine,
  faClock,
  faGear,
  faTrophy,
  faUserGroup,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { profileMascotUrl } from '@/components/auth/ProfileMascot'
import { FocusAnalytics } from './FocusAnalytics'
import { FocusFriends } from './FocusFriends'
import { FocusGroups } from './FocusGroups'
import { FocusRankings } from './FocusRankings'
import { FocusSettings } from './FocusSettings'
import { FocusToday } from './FocusToday'
import { FocusAvatar } from './FocusPrimitives'
import {
  EMPTY_FOCUS_DATA,
  type FocusPlatform,
  type FocusPomodoroPhase,
  type FocusPreferences,
  type FocusScreenProps,
  type FocusTimerMode,
  type FocusTimerSettings,
  type FocusTimerSnapshot,
  type FocusTimerState,
  type FocusView,
} from './focusTypes'
import './FocusScreen.css'

const NAV_ITEMS: Array<{ id: FocusView; label: string; icon: typeof faClock }> = [
  { id: 'today', label: 'Today', icon: faClock },
  { id: 'analytics', label: 'Analytics', icon: faChartLine },
  { id: 'friends', label: 'Friends', icon: faUsers },
  { id: 'groups', label: 'Groups', icon: faUserGroup },
  { id: 'rankings', label: 'Rankings', icon: faTrophy },
  { id: 'settings', label: 'Settings', icon: faGear },
]

const CIRCLE_NAV_ITEMS = NAV_ITEMS.filter((item): item is typeof NAV_ITEMS[number] & {
  id: 'friends' | 'groups' | 'rankings'
} => item.id === 'friends' || item.id === 'groups' || item.id === 'rankings')

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1]?.[0]}` : parts[0]?.slice(0, 2) || 'UA').toUpperCase()
}

function detectPlatform(): FocusPlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

function phaseDuration(phase: FocusPomodoroPhase, settings: FocusTimerSettings) {
  if (phase === 'short-break') return settings.shortBreakSeconds || 300
  if (phase === 'long-break') return settings.longBreakSeconds || 900
  return settings.focusSeconds || 1_500
}

export function FocusScreen(props: FocusScreenProps) {
  const {
    data,
    initialView = 'today',
    platform: platformOverride,
    nativeFocusShieldAvailable = false,
    socialNotice,
    socialNoticeKind,
    onClose,
    onTimerModeChange,
    onSubjectChange,
    onSubjectSelectionChange,
    onSubjectCreate,
    onPomodoroPhaseChange,
    onPomodoroLengthChange,
    onSessionStart,
    onSessionPause,
    onSessionResume,
    onSessionFinish,
    onSearchPeople,
    onUsernameChange,
    onFriendAction,
    onOpenGroup,
    onCreateGroup,
    onJoinGroup,
    onJoinGroupByCode,
    onLeaveGroup,
    onInviteToGroup,
    onRespondGroupInvite,
    onRespondGroupJoinRequest,
    onSendGroupMessage,
    onGroupMemberAction,
    onRankingScopeChange,
    onPreferenceChange,
    onTimerSettingsChange,
    onFocusShieldAction,
  } = props
  const setScreen = useAppStore(state => state.setScreen)
  const authUser = useAuthStore(state => state.user)
  const authProfile = useAuthStore(state => state.profile)
  const source = data ?? EMPTY_FOCUS_DATA
  const profile = useMemo(() => {
    if (data?.profile) return data.profile
    const name = authProfile?.name || authUser?.name || 'UPSC Aspirant'
    return { ...EMPTY_FOCUS_DATA.profile, id: authUser?.id ?? '', name, initials: initials(name), avatarUrl: authProfile?.photoUrl || authUser?.avatarUrl || profileMascotUrl(authProfile?.mascotId) }
  }, [authProfile?.mascotId, authProfile?.name, authProfile?.photoUrl, authUser?.avatarUrl, authUser?.id, authUser?.name, data?.profile])
  const platform = platformOverride ?? detectPlatform()
  const initialTimer = source.timer
  const controlledTimer = Boolean(data?.timer)
  const initialTimerSettings = { ...EMPTY_FOCUS_DATA.timerSettings, ...source.timerSettings }
  const initialPhase = initialTimer?.phase ?? 'focus'
  const initialPlannedSeconds = initialTimer?.plannedSeconds ?? phaseDuration(initialPhase, initialTimerSettings)
  const [view, setView] = useState<FocusView>(initialView)
  const [preferences, setPreferences] = useState<FocusPreferences>(source.preferences)
  const [timerSettings, setTimerSettings] = useState<FocusTimerSettings>(initialTimerSettings)
  const [timerMode, setTimerMode] = useState<FocusTimerMode>(initialTimer?.mode ?? 'pomodoro')
  const [timerState, setTimerState] = useState<FocusTimerState>(initialTimer?.state ?? 'idle')
  const [pomodoroPhase, setPomodoroPhase] = useState<FocusPomodoroPhase>(initialPhase)
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialTimer?.selectedSubjectId ?? source.subjects[0]?.id ?? '')
  const [plannedSeconds, setPlannedSeconds] = useState(initialPlannedSeconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialTimer?.elapsedSeconds ?? 0)
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimer?.remainingSeconds ?? initialPlannedSeconds)
  const [startedAt, setStartedAt] = useState(initialTimer?.startedAt ?? 0)
  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetDragRef = useRef<{ y: number; at: number } | null>(null)

  useEffect(() => { setPreferences(source.preferences) }, [source.preferences])
  useEffect(() => { setTimerSettings({ ...EMPTY_FOCUS_DATA.timerSettings, ...source.timerSettings }) }, [source.timerSettings])
  useEffect(() => {
    if (!data?.timer) return
    const timer = data.timer
    setTimerMode(timer.mode); setTimerState(timer.state); setPomodoroPhase(timer.phase); setSelectedSubjectId(timer.selectedSubjectId)
    setPlannedSeconds(timer.plannedSeconds); setElapsedSeconds(timer.elapsedSeconds); setRemainingSeconds(timer.remainingSeconds); setStartedAt(timer.startedAt ?? 0)
  }, [data?.timer])
  useEffect(() => {
    if (!controlledTimer && !selectedSubjectId && source.subjects[0]) setSelectedSubjectId(source.subjects[0].id)
  }, [controlledTimer, selectedSubjectId, source.subjects])

  useEffect(() => {
    if (controlledTimer || timerState !== 'running') return
    const interval = window.setInterval(() => {
      setElapsedSeconds(value => value + 1)
      if (timerMode === 'pomodoro') setRemainingSeconds(value => Math.max(0, value - 1))
    }, 1_000)
    return () => window.clearInterval(interval)
  }, [controlledTimer, timerMode, timerState])

  useEffect(() => {
    if (controlledTimer || timerMode !== 'pomodoro' || timerState !== 'running' || remainingSeconds > 0) return
    finishSession()
    // Completion is driven by a countdown transition, not by render-time polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledTimer, remainingSeconds, timerMode, timerState])

  useEffect(() => {
    if (view === 'today') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setView('today')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view])

  function snapshot(nextState = timerState): FocusTimerSnapshot {
    return { mode: timerMode, state: nextState, phase: pomodoroPhase, selectedSubjectId, plannedSeconds, elapsedSeconds, remainingSeconds, startedAt: startedAt || undefined }
  }

  function changeMode(mode: FocusTimerMode) {
    if (timerState !== 'idle') return
    if (!controlledTimer) {
      setTimerMode(mode)
      setElapsedSeconds(0)
      setRemainingSeconds(plannedSeconds)
    }
    onTimerModeChange?.(mode)
  }

  function changeSubject(subjectId: string) {
    if (timerState !== 'idle') return
    if (!controlledTimer) setSelectedSubjectId(subjectId)
    onSubjectChange?.(subjectId)
  }

  function changePhase(phase: FocusPomodoroPhase) {
    if (timerState !== 'idle') return
    const duration = phaseDuration(phase, timerSettings)
    if (!controlledTimer) {
      setPomodoroPhase(phase)
      setPlannedSeconds(duration)
      setRemainingSeconds(duration)
      setElapsedSeconds(0)
    }
    onPomodoroPhaseChange?.(phase)
  }

  function changePlannedSeconds(seconds: number) {
    const safe = Math.max(60, Math.min(10_800, Math.round(seconds)))
    if (!controlledTimer) {
      setPlannedSeconds(safe)
      setRemainingSeconds(safe)
      setElapsedSeconds(0)
    }
    onPomodoroLengthChange?.(safe)
  }

  function startSession() {
    const now = Date.now()
    if (!controlledTimer) {
      setStartedAt(now)
      setElapsedSeconds(0)
      if (timerMode === 'pomodoro') setRemainingSeconds(plannedSeconds)
      setTimerState('running')
    }
    onSessionStart?.({ ...snapshot('running'), elapsedSeconds: 0, remainingSeconds: timerMode === 'pomodoro' ? plannedSeconds : 0, startedAt: now })
  }

  function pauseSession() {
    if (!controlledTimer) setTimerState('paused')
    onSessionPause?.(snapshot('paused'))
  }

  function resumeSession() {
    if (!controlledTimer) setTimerState('running')
    onSessionResume?.(snapshot('running'))
  }

  function finishSession() {
    const endedAt = Date.now()
    onSessionFinish?.({ subjectId: selectedSubjectId, mode: timerMode, phase: pomodoroPhase, plannedSeconds, elapsedSeconds, startedAt: startedAt || endedAt, endedAt })
    if (!controlledTimer) {
      setTimerState('idle')
      setElapsedSeconds(0)
      setRemainingSeconds(plannedSeconds)
      setStartedAt(0)
    }
  }

  function changePreference<K extends keyof FocusPreferences>(key: K, value: FocusPreferences[K]) {
    setPreferences(current => ({ ...current, [key]: value }))
    onPreferenceChange?.(key, value)
  }

  function changeTimerSetting<K extends keyof FocusTimerSettings>(key: K, value: FocusTimerSettings[K]) {
    setTimerSettings(current => {
      const next = { ...current, [key]: value }
      if (!controlledTimer && timerState === 'idle') {
        const durationKey = pomodoroPhase === 'focus' ? 'focusSeconds' : pomodoroPhase === 'short-break' ? 'shortBreakSeconds' : 'longBreakSeconds'
        if (key === durationKey && typeof value === 'number' && value > 0) {
          setPlannedSeconds(value)
          setRemainingSeconds(value)
          setElapsedSeconds(0)
        }
      }
      return next
    })
    onTimerSettingsChange?.(key, value)
  }

  const todayProfile = timerSettings.dailyGoalSeconds > 0
    ? { ...profile, dailyGoalSeconds: timerSettings.dailyGoalSeconds }
    : profile
  const showSocialNotice = Boolean(
    socialNotice && (view === 'friends' || view === 'groups' || view === 'rankings'),
  )
  const isCircleView = view === 'friends' || view === 'groups' || view === 'rankings'
  const incomingRequestCount = source.requests.filter(request => request.direction === 'incoming').length

  function closeSheet() {
    setSheetDragY(0)
    setSheetDragging(false)
    sheetDragRef.current = null
    setView('today')
  }

  function beginSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    sheetDragRef.current = { y: event.clientY, at: performance.now() }
    setSheetDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sheetDragRef.current) return
    setSheetDragY(Math.max(0, event.clientY - sheetDragRef.current.y))
  }

  function endSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = sheetDragRef.current
    sheetDragRef.current = null
    setSheetDragging(false)
    if (!start) return
    const distance = Math.max(0, event.clientY - start.y)
    const velocity = distance / Math.max(1, performance.now() - start.at)
    if (distance >= 90 || (distance >= 32 && velocity >= 0.55)) closeSheet()
    else setSheetDragY(0)
  }

  const secondaryMain = view === 'analytics' ? <FocusAnalytics profile={profile} sessions={source.sessions} activityLog={source.activityLog} subjects={source.analyticsSubjects} />
      : view === 'friends' ? <FocusFriends username={profile.username} friends={source.friends} requests={source.requests} onSearchPeople={onSearchPeople} onUsernameChange={onUsernameChange} onAction={(action, personId, requestId) => onFriendAction?.(action, personId, requestId) ?? false} />
        : view === 'groups' ? <FocusGroups profile={profile} groups={source.groups} groupInvites={source.groupInvites} groupJoinRequests={source.groupJoinRequests} people={source.groupMembers} messages={source.groupMessages} rankings={source.rankings} onOpenGroup={groupId => onOpenGroup?.(groupId)} onCreateGroup={draft => onCreateGroup?.(draft) ?? null} onJoinGroup={groupId => onJoinGroup?.(groupId)} onJoinGroupByCode={onJoinGroupByCode} onLeaveGroup={groupId => onLeaveGroup?.(groupId) ?? false} onInviteToGroup={(groupId, exactContact) => onInviteToGroup?.(groupId, exactContact) ?? false} onRespondGroupInvite={(inviteId, accept) => onRespondGroupInvite?.(inviteId, accept) ?? false} onRespondGroupJoinRequest={(requestId, accept) => onRespondGroupJoinRequest?.(requestId, accept) ?? false} onSendMessage={(groupId, text) => onSendGroupMessage?.(groupId, text) ?? false} onMemberAction={(action, groupId, personId) => onGroupMemberAction?.(action, groupId, personId) ?? false} />
          : view === 'rankings' ? <FocusRankings profile={profile} entries={source.rankings} onScopeChange={period => onRankingScopeChange?.(period)} />
            : view === 'settings' ? <FocusSettings preferences={preferences} timerSettings={timerSettings} platform={platform} nativeFocusShieldAvailable={nativeFocusShieldAvailable} onChange={changePreference} onTimerChange={changeTimerSetting} onShieldAction={() => onFocusShieldAction?.(platform)} /> : null

  return (
    <div className={`focus-screen ${view !== 'today' ? 'sheet-open' : ''}`}>
      <header className="focus-header">
        <div className="focus-header-brand">{onClose && <button className="focus-header-close" onClick={onClose} aria-label="Close Focus"><FontAwesomeIcon icon={faArrowLeft} /></button>}<div><span>Penni Focus</span><h1>Today</h1></div></div>
        <button className="focus-header-account" onClick={() => setScreen('profile')} aria-label="Open account and profile">
          <FocusAvatar name={profile.name} initials={profile.initials} avatarUrl={profile.avatarUrl} size="sm" />
        </button>
      </header>
      <div className="focus-layout">
        <main className="focus-main">
          <FocusToday profile={todayProfile} subjects={source.subjects} subjectChoices={source.subjectChoices} subjectPlanConfigured={source.subjectPlanConfigured} sessions={source.sessions} selectedSubjectId={selectedSubjectId} timerMode={timerMode} timerState={timerState} pomodoroPhase={pomodoroPhase} plannedSeconds={plannedSeconds} elapsedSeconds={elapsedSeconds} remainingSeconds={remainingSeconds} timerSettings={timerSettings} platform={platform} nativeFocusShieldAvailable={nativeFocusShieldAvailable} onSelectSubject={changeSubject} onSubjectSelectionChange={(subjectId, selected) => onSubjectSelectionChange?.(subjectId, selected)} onSubjectCreate={name => onSubjectCreate?.(name) ?? null} onModeChange={changeMode} onPhaseChange={changePhase} onPlannedSecondsChange={changePlannedSeconds} onStart={startSession} onPause={pauseSession} onResume={resumeSession} onFinish={finishSession} onOpenAnalytics={() => setView('analytics')} onOpenFriends={() => setView('friends')} onOpenSettings={() => setView('settings')} />
        </main>
      </div>
      {view !== 'today' && <FocusSheetPortal>
        <div className="focus-secondary-sheet-backdrop" onClick={closeSheet}>
          <section
            className={`focus-secondary-sheet ${sheetDragging ? 'dragging' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${isCircleView ? 'Circle' : NAV_ITEMS.find(item => item.id === view)?.label ?? 'Focus'} panel`}
            style={{ '--focus-sheet-drag-y': `${sheetDragY}px` } as CSSProperties}
            onClick={event => event.stopPropagation()}
          >
            <div className="focus-secondary-sheet-handle" onPointerDown={beginSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={endSheetDrag} onPointerCancel={() => { sheetDragRef.current = null; setSheetDragging(false); setSheetDragY(0) }}><i /></div>
            <header><div><span>Penni Focus</span><h2>{isCircleView ? 'Circle' : NAV_ITEMS.find(item => item.id === view)?.label}</h2></div><button onClick={closeSheet} aria-label="Close panel"><FontAwesomeIcon icon={faXmark} /></button></header>
            {isCircleView && <nav className="focus-circle-tabs" aria-label="Circle sections">{CIRCLE_NAV_ITEMS.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)} aria-current={view === item.id ? 'page' : undefined}><FontAwesomeIcon icon={item.icon} /><span>{item.label}</span>{item.id === 'friends' && incomingRequestCount > 0 && <i>{incomingRequestCount}</i>}</button>)}</nav>}
            <div className="focus-secondary-sheet-body">{showSocialNotice && <p className={`focus-social-notice ${socialNoticeKind ?? 'unavailable'}`} role="status">{socialNotice}</p>}{secondaryMain}</div>
          </section>
        </div>
      </FocusSheetPortal>}
    </div>
  )
}

function FocusSheetPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return children
  return createPortal(<div className="focus-secondary-sheet-portal">{children}</div>, document.body)
}
