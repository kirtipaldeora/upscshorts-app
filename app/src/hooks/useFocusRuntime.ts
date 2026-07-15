import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import {
  cancelFocusCompletion,
  playFocusCompletionHaptic,
  playFocusCompletionSound,
  scheduleFocusCompletion,
  showFocusCompletion,
} from '@/lib/focusNotifications'
import {
  startFocusGuard,
  type FocusGuardHandle,
  type FocusInterruptionEvent,
} from '@/lib/focusShield'
import { setFocusPresence } from '@/lib/focusSocialClient'
import {
  getActiveElapsedMs,
  getActiveRemainingMs,
  isActiveTimerComplete,
  useFocusStore,
} from '@/stores/useFocusStore'
import type {
  ActiveFocusTimer,
  CancelFocusInput,
  FinishFocusInput,
  FocusSession,
  PauseFocusInput,
  StartBreakInput,
  StartFocusInput,
} from '@/types/focus'

const MIN_INTERRUPTION_MS = 1_000
const INTERRUPTION_DEDUPE_WINDOW_MS = 1_500
const PRESENCE_HEARTBEAT_MS = 60_000

export interface FocusRuntimeGuardState {
  starting: boolean
  active: boolean
  nativeBlockingActive: boolean
  wakeLockActive: boolean
  fullscreenActive: boolean
}

export interface UseFocusRuntimeOptions {
  /** Timestamp refresh cadence. Elapsed time itself is always derived from timestamps. */
  tickMs?: number
  onComplete?: (session: FocusSession) => void
  onShowToast?: (message: string) => void
}

export interface FocusRuntimeController {
  now: number
  activeTimer: ActiveFocusTimer | null
  elapsedMs: number
  remainingMs: number | null
  timerComplete: boolean
  transitioning: boolean
  guard: FocusRuntimeGuardState
  start: (input: StartFocusInput) => string | null
  startBreak: (input?: StartBreakInput) => string | null
  replaceWithBreak: (input?: StartBreakInput) => Promise<string | null>
  pause: (input?: PauseFocusInput) => boolean
  resume: (at?: number) => boolean
  finish: (input?: FinishFocusInput) => FocusSession | null
  cancel: (input?: CancelFocusInput) => FocusSession | null
}

interface GuardSlot {
  generation: number
  sessionId: string | null
  handle: FocusGuardHandle | null
  pending: Promise<void> | null
}

interface RecordedInterruption {
  sessionId: string
  startedAt: number
  endedAt: number
}

const EMPTY_GUARD: FocusRuntimeGuardState = {
  starting: false,
  active: false,
  nativeBlockingActive: false,
  wakeLockActive: false,
  fullscreenActive: false,
}

function completionMessage(session: FocusSession) {
  if (session.phase === 'short-break' || session.phase === 'long-break') {
    return session.completionReason === 'timer' ? 'Break complete. Ready for the next focused block?' : 'Break saved.'
  }
  return session.completionReason === 'timer' ? 'Focus block complete. Take a deliberate break.' : 'Focus session saved.'
}

/**
 * Owns the disposable runtime around the offline Focus store.
 * Call `start`/`resume` directly from the click handler so fullscreen retains
 * browser user activation. Do not proxy them through a later effect.
 */
export function useFocusRuntime(options: UseFocusRuntimeOptions = {}): FocusRuntimeController {
  const activeTimer = useFocusStore(state => state.activeTimer)
  const hasHydrated = useFocusStore(state => state.hasHydrated)
  const settings = useFocusStore(state => state.settings)
  const privacy = useFocusStore(state => state.privacy)
  const [now, setNow] = useState(() => Date.now())
  const [guard, setGuard] = useState<FocusRuntimeGuardState>(EMPTY_GUARD)
  const [transitioning, setTransitioning] = useState(false)

  const mountedRef = useRef(false)
  const onCompleteRef = useRef(options.onComplete)
  const onShowToastRef = useRef(options.onShowToast)
  const guardRef = useRef<GuardSlot>({ generation: 0, sessionId: null, handle: null, pending: null })
  const guardCleanupRef = useRef<Promise<void> | null>(null)
  const notificationGenerationRef = useRef(0)
  const notificationSessionRef = useRef<string | null>(null)
  const notificationEndsAtRef = useRef<number | null>(null)
  const notificationSoundRef = useRef<boolean | null>(null)
  const notificationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const completionIdsRef = useRef(new Set<string>())
  const completionInFlightRef = useRef<string | null>(null)
  const backgroundRef = useRef<{ sessionId: string; startedAt: number } | null>(null)
  const interruptionsRef = useRef<RecordedInterruption[]>([])
  const presenceGenerationRef = useRef(0)
  const presenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const presenceWasSharedRef = useRef(false)
  const presenceSignatureRef = useRef<string | null>(null)
  const observedTimerIdRef = useRef<string | null>(activeTimer?.id ?? null)

  useEffect(() => { onCompleteRef.current = options.onComplete }, [options.onComplete])
  useEffect(() => { onShowToastRef.current = options.onShowToast }, [options.onShowToast])

  const recordInterruptionOnce = useCallback((
    sessionId: string,
    startedAt: number,
    endedAt: number,
    reason: string,
  ) => {
    if (endedAt - startedAt < MIN_INTERRUPTION_MS) return
    const current = useFocusStore.getState().activeTimer
    if (!current || current.id !== sessionId || current.phase !== 'focus') return
    const duplicate = interruptionsRef.current.some(item => item.sessionId === sessionId &&
      startedAt <= item.endedAt + INTERRUPTION_DEDUPE_WINDOW_MS &&
      endedAt >= item.startedAt - INTERRUPTION_DEDUPE_WINDOW_MS)
    if (duplicate) return
    interruptionsRef.current = [...interruptionsRef.current.slice(-9), { sessionId, startedAt, endedAt }]
    useFocusStore.getState().recordInterruption({
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      reason,
    })
  }, [])

  const stopGuard = useCallback((sessionId?: string) => {
    const slot = guardRef.current
    if (sessionId && slot.sessionId && slot.sessionId !== sessionId) return Promise.resolve()
    const generation = slot.generation + 1
    const handle = slot.handle
    const pending = slot.pending
    guardRef.current = { generation, sessionId: null, handle: null, pending: null }
    if (mountedRef.current) {
      setGuard(EMPTY_GUARD)
      setTransitioning(Boolean(handle || pending))
    }
    const cleanup = Promise.all([
      handle?.stop().catch(() => undefined),
      pending?.catch(() => undefined),
    ]).then(() => undefined).finally(() => {
      if (guardCleanupRef.current === cleanup) guardCleanupRef.current = null
      if (mountedRef.current) setTransitioning(false)
    })
    guardCleanupRef.current = cleanup
    return cleanup
  }, [])

  const beginGuard = useCallback((timer: ActiveFocusTimer, explicitUserGesture: boolean) => {
    if (timer.phase !== 'focus' || timer.status !== 'running') return
    const current = guardRef.current
    if (current.sessionId === timer.id && (current.handle || current.pending)) return

    // A non-gesture restoration can safely wait for old native blocking to stop.
    // Explicit start/resume never waits before requesting fullscreen.
    if (!explicitUserGesture && guardCleanupRef.current) {
      const cleanup = guardCleanupRef.current
      void cleanup.then(() => {
        const latest = useFocusStore.getState().activeTimer
        if (mountedRef.current && latest?.id === timer.id && latest.status === 'running') beginGuard(latest, false)
      })
      return
    }

    const runtime = useFocusStore.getState()
    const generation = current.generation + 1
    guardRef.current = { generation, sessionId: timer.id, handle: null, pending: null }
    setGuard({ ...EMPTY_GUARD, starting: true })
    setTransitioning(true)

    // This invocation intentionally happens synchronously inside start/resume.
    const pending = startFocusGuard({
      sessionId: timer.id,
      keepAwake: runtime.settings.keepScreenAwake,
      requestFullscreen: explicitUserGesture && runtime.settings.fullscreenDuringFocus,
      enableAppBlocking: runtime.settings.focusShieldEnabled,
      onInterruption: (event: FocusInterruptionEvent) => {
        recordInterruptionOnce(timer.id, event.startedAt, event.endedAt, event.kind)
      },
    }).then(async handle => {
      const slot = guardRef.current
      const latest = useFocusStore.getState().activeTimer
      if (!mountedRef.current || slot.generation !== generation || slot.sessionId !== timer.id ||
          latest?.id !== timer.id || latest.status !== 'running') {
        await handle.stop().catch(() => undefined)
        return
      }
      guardRef.current = { ...slot, handle, pending: null }
      setGuard({
        starting: false,
        active: true,
        nativeBlockingActive: handle.nativeBlockingActive,
        wakeLockActive: handle.wakeLockActive,
        fullscreenActive: handle.fullscreenActive,
      })
      setTransitioning(false)
    }).catch(() => {
      const slot = guardRef.current
      if (slot.generation === generation && slot.sessionId === timer.id) {
        guardRef.current = { ...slot, pending: null }
        if (mountedRef.current) {
          setGuard(EMPTY_GUARD)
          setTransitioning(false)
        }
      }
    })
    guardRef.current = { ...guardRef.current, pending }
  }, [recordInterruptionOnce])

  const cancelNotification = useCallback((sessionId?: string) => {
    const id = sessionId ?? notificationSessionRef.current
    notificationGenerationRef.current++
    if (!id) return
    if (notificationSessionRef.current === id) notificationSessionRef.current = null
    notificationEndsAtRef.current = null
    notificationSoundRef.current = null
    notificationQueueRef.current = notificationQueueRef.current.catch(() => undefined)
      .then(() => cancelFocusCompletion(id))
  }, [])

  const scheduleNotification = useCallback((timer: ActiveFocusTimer, at = Date.now()) => {
    const state = useFocusStore.getState()
    if (!state.settings.notificationsEnabled || timer.status !== 'running' ||
        (timer.mode === 'stopwatch' && timer.phase === 'focus')) {
      cancelNotification(timer.id)
      return
    }
    const remaining = getActiveRemainingMs(timer, at)
    if (remaining === null || remaining <= 0) return
    const endsAt = at + remaining
    const soundEnabled = state.settings.soundsEnabled
    if (notificationSessionRef.current === timer.id && notificationEndsAtRef.current !== null &&
        Math.abs(notificationEndsAtRef.current - endsAt) < 1_000 &&
        notificationSoundRef.current === soundEnabled) return
    const subject = state.subjectTags.find(tag => tag.id === timer.subjectTagId)?.name ??
      (timer.phase === 'focus' ? 'Study session' : 'Break')
    const generation = ++notificationGenerationRef.current
    notificationSessionRef.current = timer.id
    notificationEndsAtRef.current = endsAt
    notificationSoundRef.current = soundEnabled
    // Serialisation prevents a slow schedule call from racing a pause/cancel
    // and leaving a stale native notification with the same numeric ID.
    notificationQueueRef.current = notificationQueueRef.current.catch(() => undefined).then(async () => {
      if (generation !== notificationGenerationRef.current) return
      await scheduleFocusCompletion({
        sessionId: timer.id,
        endsAt,
        subject,
        phase: timer.phase === 'focus' ? 'focus' : 'break',
        soundEnabled,
      })
    })
  }, [cancelNotification])

  const enqueuePresence = useCallback((timer: ActiveFocusTimer | null, force = false) => {
    const state = useFocusStore.getState()
    const shouldShare = state.privacy.shareLiveStatus
    const previouslyShared = presenceWasSharedRef.current
    presenceWasSharedRef.current = shouldShare && Boolean(timer)
    if (!shouldShare && !previouslyShared) return

    const tag = timer ? state.subjectTags.find(item => item.id === timer.subjectTagId) : null
    // Live status is already a separate opt-in. `friends` is still scoped by
    // RLS to accepted friends and shared-group peers; it never makes a timer
    // public, even when the broader profile itself is private.
    const visibility = 'friends' as const
    const signature = shouldShare && timer
      ? `${timer.id}:${timer.status}:${timer.phase}:${visibility}:${tag?.name ?? timer.topic}`
      : 'offline'
    if (!force && presenceSignatureRef.current === signature) return
    presenceSignatureRef.current = signature
    const generation = ++presenceGenerationRef.current
    presenceQueueRef.current = presenceQueueRef.current.catch(() => undefined).then(async () => {
      if (generation !== presenceGenerationRef.current) return
      if (!shouldShare || !timer) {
        await setFocusPresence({ status: 'offline', visibility: 'private', activeSessionId: null, focusStartedAt: null })
        return
      }
      await setFocusPresence({
        status: timer.status === 'paused' ? 'available' : timer.phase === 'focus' ? 'focusing' : 'break',
        visibility,
        // Local timer IDs are not UUIDs and cannot satisfy the server-session
        // foreign key. The sync adapter may attach a server UUID later.
        activeSessionId: null,
        message: tag?.name ?? timer.topic,
        // Reconstruct an effective start from focused elapsed time so a
        // pause does not inflate what group peers see as the live block.
        focusStartedAt: new Date(Date.now() - getActiveElapsedMs(timer, Date.now())).toISOString(),
      })
    }).then(() => undefined, () => undefined)
  }, [])

  const emitCompletionOnce = useCallback((session: FocusSession) => {
    if (completionIdsRef.current.has(session.id)) return
    completionIdsRef.current.add(session.id)
    const currentSettings = useFocusStore.getState().settings
    try { onCompleteRef.current?.(session) } catch { /* runtime cleanup must continue */ }
    try { onShowToastRef.current?.(completionMessage(session)) } catch { /* optional UI callback */ }
    if (session.completionReason === 'timer') {
      if (currentSettings.soundsEnabled && session.phase === 'focus') {
        // Timed breaks open the repeating, user-dismissible BreakAlarm. Playing
        // the one-shot completion chime too would stack two audio cues.
        playFocusCompletionSound('focus')
      }
      if (currentSettings.hapticsEnabled) void playFocusCompletionHaptic()
      if (currentSettings.notificationsEnabled) {
        void showFocusCompletion(
          session.subjectName ?? session.topic,
          session.phase === 'focus' ? 'focus' : 'break',
        )
      }
    }
  }, [])

  const activateRuntime = useCallback((timer: ActiveFocusTimer, explicitUserGesture: boolean) => {
    if (timer.status !== 'running') return
    if (timer.phase === 'focus') beginGuard(timer, explicitUserGesture)
    scheduleNotification(timer)
    enqueuePresence(timer)
  }, [beginGuard, enqueuePresence, scheduleNotification])

  const completeExpiredTimer = useCallback((at: number) => {
    const state = useFocusStore.getState()
    const timer = state.activeTimer
    if (!timer || !isActiveTimerComplete(timer, at) || completionInFlightRef.current === timer.id) return null
    completionInFlightRef.current = timer.id
    const session = state.reconcile(at)
    if (!session) {
      completionInFlightRef.current = null
      return null
    }
    cancelNotification(timer.id)
    void stopGuard(timer.id)
    emitCompletionOnce(session)
    completionInFlightRef.current = null
    const next = useFocusStore.getState().activeTimer
    if (next?.status === 'running') activateRuntime(next, false)
    else enqueuePresence(null)
    return session
  }, [activateRuntime, cancelNotification, emitCompletionOnce, enqueuePresence, stopGuard])

  const start = useCallback((input: StartFocusInput) => {
    if (guardCleanupRef.current) return null
    const id = useFocusStore.getState().start(input)
    const timer = useFocusStore.getState().activeTimer
    if (!id || !timer) return null
    setNow(input.at ?? Date.now())
    activateRuntime(timer, true)
    return id
  }, [activateRuntime])

  const startBreak = useCallback((input: StartBreakInput = {}) => {
    if (guardCleanupRef.current) return null
    const id = useFocusStore.getState().startBreak(input)
    const timer = useFocusStore.getState().activeTimer
    if (!id || !timer) return null
    setNow(input.at ?? Date.now())
    activateRuntime(timer, true)
    return id
  }, [activateRuntime])

  const replaceWithBreak = useCallback(async (input: StartBreakInput = {}) => {
    const current = useFocusStore.getState().activeTimer
    if (current) {
      useFocusStore.getState().cancel({
        at: input.at ?? Date.now(),
        reason: 'break-extension-replaced-auto-start',
        discard: true,
      })
      cancelNotification(current.id)
      await stopGuard(current.id)
      enqueuePresence(null)
    } else if (guardCleanupRef.current) {
      await guardCleanupRef.current.catch(() => undefined)
    }

    const id = useFocusStore.getState().startBreak(input)
    const timer = useFocusStore.getState().activeTimer
    if (!id || !timer) return null
    setNow(input.at ?? Date.now())
    activateRuntime(timer, true)
    return id
  }, [activateRuntime, cancelNotification, enqueuePresence, stopGuard])

  const pause = useCallback((input: PauseFocusInput = {}) => {
    const timer = useFocusStore.getState().activeTimer
    if (!timer) return false
    const paused = useFocusStore.getState().pause(input)
    if (!paused) return false
    setNow(input.at ?? Date.now())
    cancelNotification(timer.id)
    void stopGuard(timer.id)
    const latest = useFocusStore.getState().activeTimer
    enqueuePresence(latest)
    return true
  }, [cancelNotification, enqueuePresence, stopGuard])

  const resume = useCallback((at = Date.now()) => {
    if (guardCleanupRef.current) return false
    const resumed = useFocusStore.getState().resume(at)
    const timer = useFocusStore.getState().activeTimer
    if (!resumed || !timer) return false
    setNow(at)
    activateRuntime(timer, true)
    return true
  }, [activateRuntime])

  const finish = useCallback((input: FinishFocusInput = {}) => {
    const timer = useFocusStore.getState().activeTimer
    if (!timer) return null
    const session = useFocusStore.getState().finish(input)
    if (!session) return null
    setNow(input.at ?? Date.now())
    cancelNotification(timer.id)
    void stopGuard(timer.id)
    emitCompletionOnce(session)
    const next = useFocusStore.getState().activeTimer
    if (next?.status === 'running') activateRuntime(next, false)
    else enqueuePresence(null)
    return session
  }, [activateRuntime, cancelNotification, emitCompletionOnce, enqueuePresence, stopGuard])

  const cancel = useCallback((input: CancelFocusInput = {}) => {
    const timer = useFocusStore.getState().activeTimer
    if (!timer) return null
    const session = useFocusStore.getState().cancel(input)
    if (!session) return null
    setNow(input.at ?? Date.now())
    cancelNotification(timer.id)
    void stopGuard(timer.id)
    enqueuePresence(null)
    return session
  }, [cancelNotification, enqueuePresence, stopGuard])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const sessionId = guardRef.current.sessionId ?? undefined
      void stopGuard(sessionId)
      if (presenceWasSharedRef.current) enqueuePresence(null)
    }
  }, [enqueuePresence, stopGuard])

  useEffect(() => {
    if (!hasHydrated) return
    const at = Date.now()
    setNow(at)
    if (completeExpiredTimer(at)) return
    const timer = useFocusStore.getState().activeTimer
    if (timer?.status === 'running') activateRuntime(timer, false)
    else if (timer) enqueuePresence(timer)
  }, [activateRuntime, completeExpiredTimer, enqueuePresence, hasHydrated])

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== 'running') return
    const tickMs = Math.round(Math.min(2_000, Math.max(250, options.tickMs ?? 500)))
    const tick = () => {
      const at = Date.now()
      setNow(at)
      completeExpiredTimer(at)
    }
    const interval = window.setInterval(tick, tickMs)
    return () => window.clearInterval(interval)
  }, [activeTimer?.id, activeTimer?.status, completeExpiredTimer, options.tickMs])

  useEffect(() => {
    let disposed = false
    let removeListener: (() => Promise<void>) | null = null
    void App.addListener('appStateChange', state => {
      if (!state.isActive) {
        const timer = useFocusStore.getState().activeTimer
        if (timer?.status === 'running' && timer.phase === 'focus') {
          backgroundRef.current ??= { sessionId: timer.id, startedAt: Date.now() }
        }
        return
      }

      const at = Date.now()
      const hidden = backgroundRef.current
      backgroundRef.current = null
      if (hidden) recordInterruptionOnce(hidden.sessionId, hidden.startedAt, at, 'app-background')
      setNow(at)
      completeExpiredTimer(at)
    }).then(handle => {
      if (disposed) void handle.remove()
      else removeListener = () => handle.remove()
    }).catch(() => undefined)
    return () => {
      disposed = true
      if (removeListener) void removeListener()
    }
  }, [completeExpiredTimer, recordInterruptionOnce])

  useEffect(() => {
    const timer = useFocusStore.getState().activeTimer
    if (timer) enqueuePresence(timer)
    else if (presenceWasSharedRef.current) enqueuePresence(null)
  }, [activeTimer?.id, activeTimer?.phase, activeTimer?.status, enqueuePresence, privacy.shareLiveStatus, privacy.profileVisibility])

  // Group cards consider a presence stale after two minutes. Refresh the
  // server timestamp without touching React state so a long-running session
  // remains visibly live across friends and shared study groups.
  useEffect(() => {
    if (!hasHydrated || !activeTimer || !privacy.shareLiveStatus) return
    const heartbeat = () => {
      const state = useFocusStore.getState()
      if (!state.privacy.shareLiveStatus || !state.activeTimer) return
      enqueuePresence(state.activeTimer, true)
    }
    const interval = window.setInterval(heartbeat, PRESENCE_HEARTBEAT_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeTimer?.id, enqueuePresence, hasHydrated, privacy.shareLiveStatus])

  // Account resets or other external store actions may clear/replace a timer
  // without going through this controller. Release every disposable tied to
  // the old session so wake locks, fullscreen and notifications never leak.
  useEffect(() => {
    const previousId = observedTimerIdRef.current
    const nextId = activeTimer?.id ?? null
    observedTimerIdRef.current = nextId
    if (!previousId || previousId === nextId) return
    cancelNotification(previousId)
    void stopGuard(previousId)
  }, [activeTimer?.id, cancelNotification, stopGuard])

  useEffect(() => {
    const timer = useFocusStore.getState().activeTimer
    if (!timer || timer.status !== 'running') return
    scheduleNotification(timer)
  }, [activeTimer?.id, activeTimer?.status, scheduleNotification, settings.notificationsEnabled, settings.soundsEnabled])

  const elapsedMs = useMemo(() => getActiveElapsedMs(activeTimer, now), [activeTimer, now])
  const remainingMs = useMemo(() => getActiveRemainingMs(activeTimer, now), [activeTimer, now])
  const timerComplete = useMemo(() => isActiveTimerComplete(activeTimer, now), [activeTimer, now])

  return {
    now,
    activeTimer,
    elapsedMs,
    remainingMs,
    timerComplete,
    transitioning,
    guard,
    start,
    startBreak,
    replaceWithBreak,
    pause,
    resume,
    finish,
    cancel,
  }
}
