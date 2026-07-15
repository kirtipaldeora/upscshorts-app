import { useCallback, useEffect, useRef } from 'react'
import { syncCompletedFocusSession } from '@/lib/focusSocialClient'
import { MIN_COUNTED_FOCUS_MS, useFocusStore } from '@/stores/useFocusStore'
import { useAuthStore } from '@/stores/useAuthStore'
import type { FocusSession } from '@/types/focus'

function interruptionDurationMs(session: FocusSession) {
  return session.interruptions.reduce((sum, interruption) => {
    if (interruption.durationMs !== null) return sum + interruption.durationMs
    if (interruption.endedAt !== null) return sum + Math.max(0, interruption.endedAt - interruption.startedAt)
    return sum
  }, 0)
}

async function uploadSession(session: FocusSession) {
  return syncCompletedFocusSession({
    clientSessionId: session.id,
    // Local subject tags are stable strings, while cloud categories are UUIDs.
    // Preserve the subject snapshot in the label until a category mapping exists.
    categoryId: null,
    label: session.subjectName || session.topic || 'Focus session',
    note: session.note,
    mode: session.mode,
    phase: session.phase,
    plannedSeconds: session.plannedDurationMs ? Math.round(session.plannedDurationMs / 1_000) : null,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(session.endedAt).toISOString(),
    durationSeconds: Math.round(session.elapsedMs / 1_000),
    pausedSeconds: Math.round(session.pausedMs / 1_000),
    pauseCount: session.pauseCount,
    interruptionCount: session.interruptions.length,
    interruptionSeconds: Math.round(interruptionDurationMs(session) / 1_000),
    completionReason: session.completionReason === 'timer' ? 'timer' : 'manual',
  })
}

/** Uploads completed local sessions idempotently whenever authentication/network return. */
export function useFocusCloudSync(onError?: (message: string) => void) {
  const userId = useAuthStore(state => state.user?.id)
  const isGuest = useAuthStore(state => state.isGuest)
  const sessions = useFocusStore(state => state.sessions)
  const syncingRef = useRef(false)
  const rerunRef = useRef(false)
  const onErrorRef = useRef(onError)

  useEffect(() => { onErrorRef.current = onError }, [onError])

  const syncNow = useCallback(async () => {
    if (!userId || isGuest) return
    if (syncingRef.current) {
      rerunRef.current = true
      return
    }
    syncingRef.current = true
    try {
      do {
        rerunRef.current = false
        const pending = useFocusStore.getState().sessions.filter(session =>
          session.status === 'completed' && session.sync.syncedAt === null)
        for (const session of pending) {
          if (session.phase === 'focus' && session.elapsedMs < MIN_COUNTED_FOCUS_MS) {
            useFocusStore.getState().markSessionSynced(
              session.id,
              'local:below-counting-threshold',
              Date.now(),
              session.sync.revision,
            )
            continue
          }
          try {
            const result = await uploadSession(session)
            if (!result.available || !result.data) break
            useFocusStore.getState().markSessionSynced(
              session.id,
              result.data.id,
              Date.now(),
              session.sync.revision,
            )
          } catch (error) {
            onErrorRef.current?.(error instanceof Error ? error.message : 'Focus history could not sync')
            break
          }
        }
      } while (rerunRef.current)
    } finally {
      syncingRef.current = false
    }
  }, [isGuest, userId])

  useEffect(() => { void syncNow() }, [sessions, syncNow])
  useEffect(() => {
    const handleOnline = () => { void syncNow() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncNow])

  return syncNow
}
