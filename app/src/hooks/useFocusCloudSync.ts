import { useCallback, useEffect, useRef } from 'react'
import { listFocusExitUploads, removeFocusExitUpload } from '@/lib/focusExitOutbox'
import { syncLocalCompletedFocusSession } from '@/lib/focusSocialClient'
import { MIN_COUNTED_FOCUS_MS, useFocusStore } from '@/stores/useFocusStore'
import { useAuthStore } from '@/stores/useAuthStore'

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
            const result = await syncLocalCompletedFocusSession(session)
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
        // A logout network deadline may expire after the local account store
        // has already been isolated. Retry only the outbox owned by this same
        // authenticated user; the stable client ID keeps this idempotent.
        for (const session of listFocusExitUploads(userId)) {
          try {
            const result = await syncLocalCompletedFocusSession(session)
            if (!result.available || !result.data) break
            removeFocusExitUpload(userId, session.id)
          } catch (error) {
            onErrorRef.current?.(error instanceof Error ? error.message : 'A session saved during logout could not sync')
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
