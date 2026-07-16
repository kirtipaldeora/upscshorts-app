import type { FocusSession } from '@/types/focus'

const EXIT_OUTBOX_KEY = 'penni.focus.exit-outbox.v1'
const MAX_PENDING_PER_ACCOUNT = 24

type ExitOutbox = Record<string, FocusSession[]>

function readOutbox(): ExitOutbox {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXIT_OUTBOX_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ExitOutbox : {}
  } catch {
    return {}
  }
}

function writeOutbox(outbox: ExitOutbox) {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(outbox).length) window.localStorage.setItem(EXIT_OUTBOX_KEY, JSON.stringify(outbox))
    else window.localStorage.removeItem(EXIT_OUTBOX_KEY)
  } catch { /* a blocked/full store must never prevent logout */ }
}

function validSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<FocusSession>
  return typeof row.id === 'string' && row.id.length >= 8 && row.status === 'completed' &&
    row.phase === 'focus' && typeof row.startedAt === 'number' && typeof row.endedAt === 'number' &&
    typeof row.elapsedMs === 'number' && Array.isArray(row.segments) && Array.isArray(row.interruptions)
}

/** Keeps a timed-out logout upload isolated to the account that earned it. */
export function queueFocusExitUpload(accountUserId: string | null | undefined, session: FocusSession | null) {
  if (!accountUserId || !session || !validSession(session)) return
  const outbox = readOutbox()
  const current = (Array.isArray(outbox[accountUserId]) ? outbox[accountUserId] : []).filter(validSession)
  outbox[accountUserId] = [...current.filter(item => item.id !== session.id), session].slice(-MAX_PENDING_PER_ACCOUNT)
  writeOutbox(outbox)
}

export function listFocusExitUploads(accountUserId: string | null | undefined) {
  if (!accountUserId) return []
  const outbox = readOutbox()
  return (Array.isArray(outbox[accountUserId]) ? outbox[accountUserId] : []).filter(validSession)
}

export function removeFocusExitUpload(accountUserId: string | null | undefined, sessionId: string) {
  if (!accountUserId || !sessionId) return
  const outbox = readOutbox()
  const next = (Array.isArray(outbox[accountUserId]) ? outbox[accountUserId] : [])
    .filter(item => validSession(item) && item.id !== sessionId)
  if (next.length) outbox[accountUserId] = next
  else delete outbox[accountUserId]
  writeOutbox(outbox)
}

export function clearFocusExitUploads(accountUserId: string | null | undefined) {
  if (!accountUserId) return
  const outbox = readOutbox()
  delete outbox[accountUserId]
  writeOutbox(outbox)
}
