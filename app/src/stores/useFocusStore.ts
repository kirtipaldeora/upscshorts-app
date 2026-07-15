import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type {
  ActiveFocusTimer,
  CancelFocusInput,
  CompletedFocusRunSegment,
  DailyFocusGoal,
  FinishFocusInput,
  FocusDateRange,
  FocusGoalProgress,
  FocusGoals,
  FocusHeatmapCell,
  FocusInterruption,
  FocusPeriodStats,
  FocusPhase,
  FocusPrivacyPreferences,
  FocusRunSegment,
  FocusSession,
  FocusSettings,
  FocusStreakStats,
  FocusSubjectStats,
  FocusSubjectTag,
  PauseFocusInput,
  RecordFocusInterruptionInput,
  StartBreakInput,
  StartFocusInput,
} from '@/types/focus'

const STORAGE_KEY = 'penni.focus.v1'
const STORAGE_VERSION = 4
const UNSELECTED_SUBJECT_AT = 1
const MINUTE_MS = 60_000
const MAX_HISTORY = 10_000
/** Tiny development/test runs remain inspectable in history but never affect real study statistics. */
export const MIN_COUNTED_FOCUS_MS = 5_000

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundsEnabled: true,
  notificationsEnabled: false,
  hapticsEnabled: true,
  keepScreenAwake: false,
  focusShieldEnabled: false,
  fullscreenDuringFocus: false,
  strictMode: false,
  weekStartsOn: 1,
}

export const DEFAULT_FOCUS_PRIVACY: FocusPrivacyPreferences = {
  profileVisibility: 'private',
  shareLiveStatus: false,
  shareAggregateStats: false,
  discoverable: false,
  allowStudyInvites: false,
}

export const DEFAULT_DAILY_FOCUS_GOAL: DailyFocusGoal = {
  targetMinutes: 120,
  targetSessions: null,
}

export const DEFAULT_FOCUS_SUBJECT_TAGS: FocusSubjectTag[] = [
  ['polity', 'Polity', '#F0A3A3'],
  ['economy', 'Economy', '#E8C48C'],
  ['history', 'History & Culture', '#D7A98C'],
  ['geography', 'Geography', '#89B9E4'],
  ['environment', 'Environment', '#96D4AC'],
  ['science-tech', 'Science & Tech', '#C4ABE8'],
  ['current-affairs', 'Current Affairs', '#92CBD8'],
  ['csat', 'CSAT', '#93D6CE'],
  ['optional', 'Optional', '#EBA8CF'],
].map(([id, name, color]) => ({
  id: `focus-subject-${id}`,
  name,
  color,
  createdAt: 0,
  // Built-ins are suggestions, not an assumed study plan. Users explicitly
  // restore only the subjects they want in their timer and Daily plan.
  archivedAt: UNSELECTED_SUBJECT_AT,
}))

const DEFAULT_FOCUS_SUBJECT_IDS = new Set(DEFAULT_FOCUS_SUBJECT_TAGS.map(subject => subject.id))

interface FocusPersistedState {
  activeTimer: ActiveFocusTimer | null
  sessions: FocusSession[]
  subjectTags: FocusSubjectTag[]
  subjectPlanConfigured: boolean
  goals: FocusGoals
  settings: FocusSettings
  privacy: FocusPrivacyPreferences
  pomodorosSinceLongBreak: number
}

export interface FocusStore extends FocusPersistedState {
  hasHydrated: boolean

  start: (input: StartFocusInput) => string | null
  startBreak: (input?: StartBreakInput) => string | null
  pause: (input?: PauseFocusInput) => boolean
  resume: (at?: number) => boolean
  finish: (input?: FinishFocusInput) => FocusSession | null
  cancel: (input?: CancelFocusInput) => FocusSession | null
  recordInterruption: (input?: RecordFocusInterruptionInput) => boolean
  endInterruption: (id: string, endedAt?: number) => boolean
  reconcile: (at?: number) => FocusSession | null

  createSubjectTag: (name: string, color?: string) => string | null
  updateSubjectTag: (id: string, patch: Partial<Pick<FocusSubjectTag, 'name' | 'color'>>) => boolean
  archiveSubjectTag: (id: string, at?: number) => boolean
  restoreSubjectTag: (id: string) => boolean

  setDefaultDailyGoal: (goal: DailyFocusGoal) => void
  setDailyGoal: (date: string, goal: DailyFocusGoal) => boolean
  clearDailyGoal: (date: string) => void
  updateSettings: (patch: Partial<FocusSettings>) => void
  updatePrivacy: (patch: Partial<FocusPrivacyPreferences>) => void

  updateSessionNote: (id: string, note: string) => boolean
  markSessionSynced: (id: string, serverId: string, syncedAt?: number, expectedRevision?: number) => boolean
  deleteSession: (id: string) => void
  clearHistory: () => void
  resetFocusData: () => void
  markHydrated: (value: boolean) => void
}

const memoryStorage = new Map<string, string>()
const volatileStorageKeys = new Set<string>()

/** Falls back to memory when localStorage is unavailable, full or privacy-blocked. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    if (volatileStorageKeys.has(name)) return memoryStorage.get(name) ?? null
    try {
      if (typeof window !== 'undefined') {
        const value = window.localStorage.getItem(name)
        if (value !== null) {
          memoryStorage.set(name, value)
          return value
        }
      }
    } catch { /* use the in-memory fallback */ }
    return memoryStorage.get(name) ?? null
  },
  setItem: (name, value) => {
    memoryStorage.set(name, value)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(name, value)
        volatileStorageKeys.delete(name)
      }
    } catch {
      volatileStorageKeys.add(name)
    }
  },
  removeItem: (name) => {
    memoryStorage.delete(name)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(name)
        volatileStorageKeys.delete(name)
      }
    } catch {
      volatileStorageKeys.add(name)
    }
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeTimestamp(value: unknown, fallback = Date.now()) {
  return Math.max(0, Math.round(finite(value, fallback)))
}

function positiveDuration(value: unknown): number | null {
  const duration = finite(value, 0)
  return duration > 0 ? Math.round(duration) : null
}

function makeId(prefix: string) {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`
  } catch { /* use fallback */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isFocusPhase(value: unknown): value is FocusPhase {
  return value === 'focus' || value === 'short-break' || value === 'long-break'
}

function normalizeGoal(value: unknown): DailyFocusGoal {
  const record = isRecord(value) ? value : {}
  const requestedSessions = finite(record.targetSessions, 0)
  const targetSessions = requestedSessions > 0 ? Math.round(clamp(requestedSessions, 1, 100)) : null
  return {
    targetMinutes: Math.round(clamp(finite(record.targetMinutes, DEFAULT_DAILY_FOCUS_GOAL.targetMinutes), 1, 1_440)),
    targetSessions,
  }
}

function normalizeSettings(value: unknown): FocusSettings {
  const record = isRecord(value) ? value : {}
  return {
    pomodoroMinutes: Math.round(clamp(finite(record.pomodoroMinutes, 25), 1, 240)),
    shortBreakMinutes: Math.round(clamp(finite(record.shortBreakMinutes, 5), 1, 60)),
    longBreakMinutes: Math.round(clamp(finite(record.longBreakMinutes, 15), 1, 120)),
    longBreakEvery: Math.round(clamp(finite(record.longBreakEvery, 4), 1, 12)),
    autoStartBreaks: record.autoStartBreaks === true,
    autoStartFocus: record.autoStartFocus === true,
    soundsEnabled: record.soundsEnabled !== false,
    notificationsEnabled: record.notificationsEnabled === true,
    hapticsEnabled: record.hapticsEnabled !== false,
    keepScreenAwake: record.keepScreenAwake === true,
    focusShieldEnabled: record.focusShieldEnabled === true,
    fullscreenDuringFocus: record.fullscreenDuringFocus === true,
    strictMode: record.strictMode === true,
    weekStartsOn: record.weekStartsOn === 0 ? 0 : 1,
  }
}

function normalizePrivacy(value: unknown): FocusPrivacyPreferences {
  const record = isRecord(value) ? value : {}
  const profileVisibility = record.profileVisibility === 'followers' || record.profileVisibility === 'public'
    ? record.profileVisibility
    : 'private'
  return {
    profileVisibility,
    shareLiveStatus: record.shareLiveStatus === true,
    shareAggregateStats: record.shareAggregateStats === true,
    discoverable: record.discoverable === true,
    allowStudyInvites: record.allowStudyInvites === true,
  }
}

function normalizeSubjectTag(value: unknown): FocusSubjectTag | null {
  if (!isRecord(value)) return null
  const id = cleanText(value.id, 100)
  const name = cleanText(value.name, 50)
  if (!id || !name) return null
  return {
    id,
    name,
    color: cleanText(value.color, 32) || '#8FA3BF',
    createdAt: safeTimestamp(value.createdAt, 0),
    archivedAt: value.archivedAt === null || value.archivedAt === undefined
      ? null
      : safeTimestamp(value.archivedAt),
  }
}

function normalizeInterruption(value: unknown): FocusInterruption | null {
  if (!isRecord(value)) return null
  const startedAt = safeTimestamp(value.startedAt ?? value.at, 0)
  if (!startedAt) return null
  const explicitEnd = value.endedAt === null || value.endedAt === undefined
    ? null
    : Math.max(startedAt, safeTimestamp(value.endedAt, startedAt))
  const explicitDuration = positiveDuration(value.durationMs)
  const durationMs = explicitEnd !== null ? explicitEnd - startedAt : explicitDuration
  const endedAt = explicitEnd ?? (durationMs !== null ? startedAt + durationMs : null)
  return {
    id: cleanText(value.id, 100) || makeId('focus-interruption'),
    startedAt,
    endedAt,
    durationMs,
    reason: cleanText(value.reason, 160) || undefined,
  }
}

function normalizeCompletedSegment(value: unknown): CompletedFocusRunSegment | null {
  if (!isRecord(value)) return null
  const startedAt = safeTimestamp(value.startedAt, 0)
  const endedAt = safeTimestamp(value.endedAt, 0)
  if (!startedAt || endedAt <= startedAt) return null
  return { startedAt, endedAt }
}

function normalizeSession(value: unknown): FocusSession | null {
  if (!isRecord(value)) return null
  const id = cleanText(value.id, 100)
  const startedAt = safeTimestamp(value.startedAt, 0)
  const endedAt = safeTimestamp(value.endedAt, 0)
  if (!id || !startedAt || endedAt < startedAt || !isFocusPhase(value.phase)) return null
  const segments = Array.isArray(value.segments)
    ? value.segments.map(normalizeCompletedSegment).filter((item): item is CompletedFocusRunSegment => Boolean(item))
    : []
  const elapsedFromSegments = segments.reduce((sum, item) => sum + item.endedAt - item.startedAt, 0)
  const elapsedMs = elapsedFromSegments || Math.max(0, Math.round(finite(value.elapsedMs, 0)))
  const pausedMs = Math.max(0, Math.round(finite(value.pausedMs, Math.max(0, endedAt - startedAt - elapsedMs))))
  const lastSegmentEnd = segments.at(-1)?.endedAt ?? startedAt
  const inferredPauseCount = Math.max(0, segments.length - 1) + (pausedMs > 0 && endedAt > lastSegmentEnd ? 1 : 0)
  const status = value.status === 'cancelled' ? 'cancelled' : 'completed'
  const completionReason = status === 'cancelled'
    ? 'cancelled'
    : value.completionReason === 'timer' ? 'timer' : 'manual'
  return {
    id,
    mode: value.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
    phase: value.phase,
    status,
    completionReason,
    subjectTagId: typeof value.subjectTagId === 'string' ? value.subjectTagId : null,
    subjectName: typeof value.subjectName === 'string' ? value.subjectName : null,
    subjectColor: typeof value.subjectColor === 'string' ? value.subjectColor : null,
    topic: cleanText(value.topic, 120),
    note: cleanText(value.note, 500),
    plannedDurationMs: positiveDuration(value.plannedDurationMs),
    elapsedMs,
    pausedMs,
    pauseCount: Math.max(0, Math.round(finite(value.pauseCount, inferredPauseCount))),
    startedAt,
    endedAt,
    segments,
    interruptions: Array.isArray(value.interruptions)
      ? value.interruptions.map(normalizeInterruption).filter((item): item is FocusInterruption => Boolean(item))
      : [],
    sync: isRecord(value.sync) ? {
      serverId: typeof value.sync.serverId === 'string' ? cleanText(value.sync.serverId, 160) : null,
      syncedAt: value.sync.syncedAt === null || value.sync.syncedAt === undefined ? null : safeTimestamp(value.sync.syncedAt),
      revision: Math.max(1, Math.round(finite(value.sync.revision, 1))),
    } : { serverId: null, syncedAt: null, revision: 1 },
  }
}

function normalizeActiveTimer(value: unknown): ActiveFocusTimer | null {
  if (!isRecord(value) || !isFocusPhase(value.phase)) return null
  const id = cleanText(value.id, 100)
  const startedAt = safeTimestamp(value.startedAt, 0)
  if (!id || !startedAt) return null
  const status = value.status === 'paused' ? 'paused' : 'running'
  const segments: FocusRunSegment[] = Array.isArray(value.segments)
    ? value.segments.flatMap(segment => {
        if (!isRecord(segment)) return []
        const segmentStart = safeTimestamp(segment.startedAt, 0)
        const segmentEnd = segment.endedAt === null || segment.endedAt === undefined
          ? null
          : safeTimestamp(segment.endedAt, 0)
        if (!segmentStart || (segmentEnd !== null && segmentEnd <= segmentStart)) return []
        return [{ startedAt: segmentStart, endedAt: segmentEnd }]
      })
    : []
  const openIndex = segments.findIndex(segment => segment.endedAt === null)
  const safeSegments = openIndex < 0 ? segments : segments.slice(0, openIndex + 1)
  if (status === 'running' && !safeSegments.some(segment => segment.endedAt === null)) return null
  if (status === 'paused' && safeSegments.some(segment => segment.endedAt === null)) return null
  return {
    id,
    mode: value.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
    phase: value.phase,
    status,
    subjectTagId: typeof value.subjectTagId === 'string' ? value.subjectTagId : null,
    topic: cleanText(value.topic, 120),
    plannedDurationMs: positiveDuration(value.plannedDurationMs),
    startedAt,
    pausedAt: status === 'paused' ? safeTimestamp(value.pausedAt, startedAt) : null,
    segments: safeSegments,
    interruptions: Array.isArray(value.interruptions)
      ? value.interruptions.map(normalizeInterruption).filter((item): item is FocusInterruption => Boolean(item))
      : [],
    pauseCount: Math.max(0, Math.round(finite(
      value.pauseCount,
      Math.max(0, safeSegments.length - 1) + (status === 'paused' ? 1 : 0),
    ))),
  }
}

function hardStopsAtPlan(timer: Pick<ActiveFocusTimer, 'mode' | 'phase'>) {
  return timer.mode === 'pomodoro' || timer.phase !== 'focus'
}

function rawActiveElapsedMs(timer: ActiveFocusTimer, at: number) {
  return timer.segments.reduce((sum, segment) => {
    const end = segment.endedAt ?? at
    return sum + Math.max(0, end - segment.startedAt)
  }, 0)
}

/** Timestamp-derived; call with the UI's current tick instead of incrementing store counters. */
export function getActiveElapsedMs(timer: ActiveFocusTimer | null, at = Date.now()) {
  if (!timer) return 0
  const elapsed = rawActiveElapsedMs(timer, Math.max(timer.startedAt, at))
  return hardStopsAtPlan(timer) && timer.plannedDurationMs !== null
    ? Math.min(elapsed, timer.plannedDurationMs)
    : elapsed
}

export function getActiveRemainingMs(timer: ActiveFocusTimer | null, at = Date.now()) {
  if (!timer?.plannedDurationMs) return null
  return Math.max(0, timer.plannedDurationMs - getActiveElapsedMs(timer, at))
}

export function isActiveTimerComplete(timer: ActiveFocusTimer | null, at = Date.now()) {
  return Boolean(timer?.plannedDurationMs && hardStopsAtPlan(timer) && rawActiveElapsedMs(timer, at) >= timer.plannedDurationMs)
}

function plannedCompletionAt(timer: ActiveFocusTimer, at: number) {
  if (!timer.plannedDurationMs || !hardStopsAtPlan(timer)) return null
  let elapsed = 0
  for (const segment of timer.segments) {
    const end = Math.min(segment.endedAt ?? at, at)
    const duration = Math.max(0, end - segment.startedAt)
    if (elapsed + duration >= timer.plannedDurationMs) {
      return segment.startedAt + (timer.plannedDurationMs - elapsed)
    }
    elapsed += duration
  }
  return null
}

function completeSegments(timer: ActiveFocusTimer, requestedEnd: number) {
  let remaining = hardStopsAtPlan(timer) && timer.plannedDurationMs !== null
    ? timer.plannedDurationMs
    : Number.POSITIVE_INFINITY
  const completed: CompletedFocusRunSegment[] = []
  for (const segment of timer.segments) {
    if (remaining <= 0) break
    const possibleEnd = Math.min(segment.endedAt ?? requestedEnd, requestedEnd)
    const available = Math.max(0, possibleEnd - segment.startedAt)
    const duration = Math.min(available, remaining)
    if (duration > 0) completed.push({ startedAt: segment.startedAt, endedAt: segment.startedAt + duration })
    remaining -= duration
  }
  return completed
}

function elapsedFromSegments(segments: CompletedFocusRunSegment[]) {
  return segments.reduce((sum, segment) => sum + segment.endedAt - segment.startedAt, 0)
}

function newActiveTimer(input: {
  mode: ActiveFocusTimer['mode']
  phase: ActiveFocusTimer['phase']
  subjectTagId?: string | null
  topic?: string
  plannedDurationMs?: number | null
  at: number
}): ActiveFocusTimer {
  return {
    id: makeId('focus-timer'),
    mode: input.mode,
    phase: input.phase,
    status: 'running',
    subjectTagId: input.subjectTagId ?? null,
    topic: cleanText(input.topic, 120),
    plannedDurationMs: positiveDuration(input.plannedDurationMs),
    startedAt: input.at,
    pausedAt: null,
    segments: [{ startedAt: input.at, endedAt: null }],
    interruptions: [],
    pauseCount: 0,
  }
}

function appendHistory(sessions: FocusSession[], session: FocusSession) {
  return [...sessions, session].slice(-MAX_HISTORY)
}

function closeActiveTimer(
  timer: ActiveFocusTimer,
  tags: FocusSubjectTag[],
  input: { at: number; status: FocusSession['status']; reason: FocusSession['completionReason']; note?: string },
) {
  const completionAt = plannedCompletionAt(timer, input.at)
  const endedAt = completionAt !== null && completionAt <= input.at ? completionAt : Math.max(timer.startedAt, input.at)
  const segments = completeSegments(timer, endedAt)
  const elapsedMs = elapsedFromSegments(segments)
  const subject = tags.find(tag => tag.id === timer.subjectTagId)
  const interruptions = timer.interruptions
    .filter(item => item.startedAt <= endedAt)
    .map(item => {
      const interruptionEnd = Math.min(item.endedAt ?? endedAt, endedAt)
      return {
      ...item,
        endedAt: interruptionEnd,
        durationMs: Math.max(0, interruptionEnd - item.startedAt),
      }
    })
  const session: FocusSession = {
    id: timer.id,
    mode: timer.mode,
    phase: timer.phase,
    status: input.status,
    completionReason: input.reason,
    subjectTagId: timer.subjectTagId,
    subjectName: subject?.name ?? null,
    subjectColor: subject?.color ?? null,
    topic: timer.topic,
    note: cleanText(input.note, 500),
    plannedDurationMs: timer.plannedDurationMs,
    elapsedMs,
    pausedMs: Math.max(0, endedAt - timer.startedAt - elapsedMs),
    pauseCount: timer.pauseCount,
    startedAt: timer.startedAt,
    endedAt,
    segments,
    interruptions,
    sync: { serverId: null, syncedAt: null, revision: 1 },
  }
  return session
}

function localDateString(value: number | Date) {
  const date = typeof value === 'number' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return localDateString(date) === value ? date : null
}

function rangeForDay(anchor: number | Date = Date.now()): FocusDateRange {
  const date = typeof anchor === 'number' ? new Date(anchor) : new Date(anchor)
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return { from, to: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() }
}

export function getFocusDayRange(anchor: number | Date = Date.now()) {
  return rangeForDay(anchor)
}

export function getFocusWeekRange(anchor: number | Date = Date.now(), weekStartsOn: 0 | 1 = 1) {
  const date = typeof anchor === 'number' ? new Date(anchor) : new Date(anchor)
  const day = date.getDay()
  const delta = (day - weekStartsOn + 7) % 7
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - delta)
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  return { from, to: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getTime() }
}

export function getFocusMonthRange(anchor: number | Date = Date.now()) {
  const date = typeof anchor === 'number' ? new Date(anchor) : new Date(anchor)
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
  }
}

function segmentOverlap(segment: CompletedFocusRunSegment, range: FocusDateRange) {
  return Math.max(0, Math.min(segment.endedAt, range.to) - Math.max(segment.startedAt, range.from))
}

function statsForRange(state: FocusStore, range: FocusDateRange, at: number): FocusPeriodStats {
  let focusedMs = 0
  let breakMs = 0
  let completedSessions = 0
  let completedPomodoros = 0
  let cancelledSessions = 0
  let interruptionCount = 0
  let interruptionMs = 0
  let pausedMs = 0
  let longestSessionMs = 0
  let durationTotal = 0
  const subjects = new Map<string, FocusSubjectStats>()

  state.sessions.forEach(session => {
    const endedInRange = session.endedAt >= range.from && session.endedAt < range.to
    if (session.status === 'cancelled') {
      if (endedInRange && session.phase === 'focus') cancelledSessions++
      return
    }
    if (session.phase === 'focus' && session.elapsedMs < MIN_COUNTED_FOCUS_MS) return
    const overlapped = session.segments.reduce((sum, segment) => sum + segmentOverlap(segment, range), 0)
    if (session.phase === 'focus') {
      focusedMs += overlapped
      if (overlapped > 0) {
        const key = session.subjectTagId ?? 'untagged'
        const current = subjects.get(key) ?? {
          subjectTagId: session.subjectTagId,
          subjectName: session.subjectName ?? 'Untagged',
          color: session.subjectColor,
          focusedMs: 0,
          sessionCount: 0,
        }
        current.focusedMs += overlapped
        if (endedInRange) current.sessionCount++
        subjects.set(key, current)
      }
      if (endedInRange) {
        completedSessions++
        durationTotal += session.elapsedMs
        longestSessionMs = Math.max(longestSessionMs, session.elapsedMs)
        if (session.mode === 'pomodoro' && session.plannedDurationMs && session.elapsedMs >= session.plannedDurationMs) {
          completedPomodoros++
        }
      }
    } else {
      breakMs += overlapped
    }
    if (endedInRange) pausedMs += session.pausedMs
    session.interruptions.forEach(item => {
      if (item.startedAt >= range.from && item.startedAt < range.to) interruptionCount++
      if (item.endedAt !== null) {
        interruptionMs += Math.max(0, Math.min(item.endedAt, range.to) - Math.max(item.startedAt, range.from))
      }
    })
  })

  if (state.activeTimer) {
    const activeSegments = completeSegments(state.activeTimer, Math.max(state.activeTimer.startedAt, at))
    const overlapped = activeSegments.reduce((sum, segment) => sum + segmentOverlap(segment, range), 0)
    if (state.activeTimer.phase === 'focus') {
      focusedMs += overlapped
      if (overlapped > 0) {
        const tag = state.subjectTags.find(item => item.id === state.activeTimer?.subjectTagId)
        const key = state.activeTimer.subjectTagId ?? 'untagged'
        const current = subjects.get(key) ?? {
          subjectTagId: state.activeTimer.subjectTagId,
          subjectName: tag?.name ?? 'Untagged',
          color: tag?.color ?? null,
          focusedMs: 0,
          sessionCount: 0,
        }
        current.focusedMs += overlapped
        subjects.set(key, current)
      }
    } else {
      breakMs += overlapped
    }
    state.activeTimer.interruptions.forEach(item => {
      if (item.startedAt >= range.from && item.startedAt < range.to) interruptionCount++
      const end = item.endedAt ?? at
      interruptionMs += Math.max(0, Math.min(end, range.to) - Math.max(item.startedAt, range.from))
    })
  }

  return {
    from: range.from,
    to: range.to,
    focusedMs,
    breakMs,
    completedSessions,
    completedPomodoros,
    cancelledSessions,
    interruptionCount,
    interruptionMs,
    pausedMs,
    averageSessionMs: completedSessions ? Math.round(durationTotal / completedSessions) : 0,
    longestSessionMs,
    bySubject: [...subjects.values()].sort((a, b) => b.focusedMs - a.focusedMs),
  }
}

export function selectFocusDayStats(state: FocusStore, anchor: number | Date = Date.now(), at = Date.now()) {
  return statsForRange(state, getFocusDayRange(anchor), at)
}

export function selectFocusWeekStats(state: FocusStore, anchor: number | Date = Date.now(), at = Date.now()) {
  return statsForRange(state, getFocusWeekRange(anchor, state.settings.weekStartsOn), at)
}

export function selectFocusMonthStats(state: FocusStore, anchor: number | Date = Date.now(), at = Date.now()) {
  return statsForRange(state, getFocusMonthRange(anchor), at)
}

export function getDailyFocusGoal(state: Pick<FocusStore, 'goals'>, date: string) {
  return state.goals.byDate[date] ?? state.goals.default
}

export function selectFocusGoalProgress(state: FocusStore, date = localDateString(Date.now()), at = Date.now()): FocusGoalProgress {
  const parsed = parseLocalDate(date) ?? new Date(at)
  const stats = selectFocusDayStats(state, parsed, at)
  const goal = getDailyFocusGoal(state, localDateString(parsed))
  const focusedMinutes = stats.focusedMs / MINUTE_MS
  const minutesProgress = focusedMinutes / goal.targetMinutes
  const sessionsProgress = goal.targetSessions ? stats.completedSessions / goal.targetSessions : Number.POSITIVE_INFINITY
  const progress = goal.targetSessions ? Math.min(minutesProgress, sessionsProgress) : minutesProgress
  return {
    date: localDateString(parsed),
    goal,
    focusedMinutes,
    completedSessions: stats.completedSessions,
    progress,
    met: minutesProgress >= 1 && (!goal.targetSessions || sessionsProgress >= 1),
  }
}

export function selectFocusCalendarHeatmap(
  state: FocusStore,
  options: { days?: number; endAt?: number } = {},
): FocusHeatmapCell[] {
  const days = Math.round(clamp(options.days ?? 365, 1, 1_500))
  const end = rangeForDay(options.endAt ?? Date.now()).from
  const first = new Date(end)
  first.setDate(first.getDate() - days + 1)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index)
    const dateString = localDateString(date)
    const result = selectFocusGoalProgress(state, dateString, options.endAt ?? Date.now())
    const level: FocusHeatmapCell['level'] = result.focusedMinutes <= 0
      ? 0
      : result.progress >= 1 ? 4 : result.progress >= 0.66 ? 3 : result.progress >= 0.33 ? 2 : 1
    return {
      date: dateString,
      focusedMinutes: result.focusedMinutes,
      sessionCount: result.completedSessions,
      goalMinutes: result.goal.targetMinutes,
      progress: result.progress,
      metGoal: result.met,
      level,
    }
  })
}

export function selectFocusStreak(state: FocusStore, at = Date.now()): FocusStreakStats {
  const qualifyingMs = Math.min(25, state.settings.pomodoroMinutes) * MINUTE_MS
  const qualifyingDates = new Set(state.sessions
    .filter(session => session.status === 'completed' && session.phase === 'focus' && session.elapsedMs >= qualifyingMs)
    .map(session => localDateString(session.endedAt)))
  if (!qualifyingDates.size) {
    return { current: 0, longest: 0, currentStart: null, currentEnd: null, longestStart: null, longestEnd: null }
  }
  const sortedDates = [...qualifyingDates].sort()
  const first = parseLocalDate(sortedDates[0])!
  const today = new Date(at)
  const finalDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let longest = 0
  let longestStart: string | null = null
  let longestEnd: string | null = null
  let run = 0
  let runStart: string | null = null
  for (let day = new Date(first); day <= finalDay; day.setDate(day.getDate() + 1)) {
    const date = localDateString(day)
    if (qualifyingDates.has(date)) {
      if (!run) runStart = date
      run++
      if (run > longest) {
        longest = run
        longestStart = runStart
        longestEnd = date
      }
    } else {
      run = 0
      runStart = null
    }
  }

  let cursor = new Date(finalDay)
  if (!qualifyingDates.has(localDateString(cursor))) cursor.setDate(cursor.getDate() - 1)
  let current = 0
  let currentStart: string | null = null
  let currentEnd: string | null = null
  while (qualifyingDates.has(localDateString(cursor))) {
    const date = localDateString(cursor)
    current++
    currentStart = date
    currentEnd ??= date
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, longest, currentStart, currentEnd, longestStart, longestEnd }
}

function initialData(): FocusPersistedState {
  return {
    activeTimer: null,
    sessions: [],
    subjectTags: DEFAULT_FOCUS_SUBJECT_TAGS.map(tag => ({ ...tag })),
    subjectPlanConfigured: false,
    goals: { default: { ...DEFAULT_DAILY_FOCUS_GOAL }, byDate: {} },
    settings: { ...DEFAULT_FOCUS_SETTINGS },
    privacy: { ...DEFAULT_FOCUS_PRIVACY },
    pomodorosSinceLongBreak: 0,
  }
}

function mergeSubjectLibrary(subjects: FocusSubjectTag[]) {
  const byId = new Map(subjects.map(subject => [subject.id, subject]))
  const defaults = DEFAULT_FOCUS_SUBJECT_TAGS.map(subject => ({ ...(byId.get(subject.id) ?? subject) }))
  const custom = subjects.filter(subject => !DEFAULT_FOCUS_SUBJECT_IDS.has(subject.id))
  return [...defaults, ...custom]
}

function normalizePersisted(value: unknown): FocusPersistedState {
  const record = isRecord(value) ? value : {}
  const subjects = Array.isArray(record.subjectTags)
    ? record.subjectTags.map(normalizeSubjectTag).filter((item): item is FocusSubjectTag => Boolean(item))
    : []
  const subjectTags = mergeSubjectLibrary(subjects)
  const goalRecord = isRecord(record.goals) ? record.goals : {}
  const dateGoals = isRecord(goalRecord.byDate)
    ? Object.fromEntries(Object.entries(goalRecord.byDate)
        .filter(([date]) => Boolean(parseLocalDate(date)))
        .map(([date, goal]) => [date, normalizeGoal(goal)]))
    : {}
  const activeTimer = normalizeActiveTimer(record.activeTimer)
  const sessions = Array.isArray(record.sessions)
    ? record.sessions.map(normalizeSession).filter((item): item is FocusSession => Boolean(item)).slice(-MAX_HISTORY)
    : []
  return {
    activeTimer,
    sessions,
    subjectTags,
    subjectPlanConfigured: record.subjectPlanConfigured === true,
    goals: { default: normalizeGoal(goalRecord.default), byDate: dateGoals },
    settings: normalizeSettings(record.settings),
    privacy: normalizePrivacy(record.privacy),
    pomodorosSinceLongBreak: Math.round(clamp(finite(record.pomodorosSinceLongBreak, 0), 0, 100)),
  }
}

function migratePersisted(value: unknown, fromVersion: number) {
  const normalized = normalizePersisted(value)
  let subjectTags = normalized.subjectTags

  if (fromVersion < 2) {
    const previouslyUsedBuiltIns = new Set(normalized.sessions.flatMap(session =>
      session.phase === 'focus' && session.subjectTagId ? [session.subjectTagId] : []))
    if (normalized.activeTimer?.phase === 'focus' && normalized.activeTimer.subjectTagId) {
      previouslyUsedBuiltIns.add(normalized.activeTimer.subjectTagId)
    }

    subjectTags = normalized.subjectTags.map(subject => {
      if (normalized.activeTimer?.subjectTagId === subject.id) return { ...subject, archivedAt: null }
      if (!DEFAULT_FOCUS_SUBJECT_IDS.has(subject.id)) return subject
      return {
        ...subject,
        archivedAt: previouslyUsedBuiltIns.has(subject.id)
          ? null
          : subject.archivedAt ?? UNSELECTED_SUBJECT_AT,
      }
    })
  }

  return {
    ...normalized,
    subjectTags,
    subjectPlanConfigured: fromVersion >= 3
      ? normalized.subjectPlanConfigured
      : subjectTags.some(subject => subject.archivedAt === null),
  }
}

export const useFocusStore = create<FocusStore>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hasHydrated: false,

      start: (input) => {
        if (get().activeTimer) return null
        const at = safeTimestamp(input.at)
        const settings = get().settings
        const subjectTagId = input.subjectTagId?.trim() || null
        const subjectExists = subjectTagId
          ? get().subjectTags.some(tag => tag.id === subjectTagId && tag.archivedAt === null)
          : true
        if (!subjectExists) return null
        const plannedDurationMs = input.mode === 'pomodoro'
          ? positiveDuration(input.plannedDurationMs) ?? settings.pomodoroMinutes * MINUTE_MS
          : positiveDuration(input.plannedDurationMs)
        const timer = newActiveTimer({
          mode: input.mode,
          phase: 'focus',
          subjectTagId,
          topic: input.topic,
          plannedDurationMs,
          at,
        })
        set({ activeTimer: timer })
        return timer.id
      },

      startBreak: (input = {}) => {
        if (get().activeTimer) return null
        const state = get()
        const kind = input.kind === 'recommended' || !input.kind
          ? state.pomodorosSinceLongBreak >= state.settings.longBreakEvery ? 'long-break' : 'short-break'
          : input.kind
        const plannedDurationMs = positiveDuration(input.plannedDurationMs) ??
          (kind === 'long-break' ? state.settings.longBreakMinutes : state.settings.shortBreakMinutes) * MINUTE_MS
        const timer = newActiveTimer({
          mode: 'pomodoro',
          phase: kind,
          plannedDurationMs,
          at: safeTimestamp(input.at),
        })
        set({ activeTimer: timer })
        return timer.id
      },

      pause: (input = {}) => {
        const timer = get().activeTimer
        if (!timer || timer.status !== 'running') return false
        const open = timer.segments[timer.segments.length - 1]
        if (!open || open.endedAt !== null) return false
        const at = Math.max(open.startedAt, safeTimestamp(input.at))
        const interruptions = input.countAsInterruption
          ? [...timer.interruptions, {
              id: makeId('focus-interruption'),
              startedAt: at,
              endedAt: null,
              durationMs: null,
              reason: cleanText(input.reason, 160) || undefined,
            }]
          : timer.interruptions
        set({
          activeTimer: {
            ...timer,
            status: 'paused',
            pausedAt: at,
            segments: [...timer.segments.slice(0, -1), { ...open, endedAt: at }],
            interruptions,
            pauseCount: timer.pauseCount + 1,
          },
        })
        return true
      },

      resume: (value) => {
        const timer = get().activeTimer
        if (!timer || timer.status !== 'paused') return false
        const at = Math.max(timer.pausedAt ?? timer.startedAt, safeTimestamp(value))
        const awaitingBreakAlarmDismissal = timer.segments.length === 0 && timer.pauseCount === 0
        const interruptions = timer.interruptions.map(item => item.endedAt === null ? {
          ...item,
          endedAt: at,
          durationMs: Math.max(0, at - item.startedAt),
        } : item)
        set({
          activeTimer: {
            ...timer,
            // A focus block prepared behind the break alarm has not truly
            // started yet. Anchor it to the user's swipe instead of counting
            // time spent reading the alarm as paused study time.
            startedAt: awaitingBreakAlarmDismissal ? at : timer.startedAt,
            status: 'running',
            pausedAt: null,
            segments: [...timer.segments, { startedAt: at, endedAt: null }],
            interruptions,
          },
        })
        return true
      },

      finish: (input = {}) => {
        const state = get()
        const timer = state.activeTimer
        if (!timer) return null
        const requestedAt = Math.max(timer.startedAt, safeTimestamp(input.at))
        const session = closeActiveTimer(timer, state.subjectTags, {
          at: requestedAt,
          status: 'completed',
          reason: input.reason === 'timer' ? 'timer' : 'manual',
          note: input.note,
        })
        const fullPomodoro = session.phase === 'focus' && session.mode === 'pomodoro' &&
          Boolean(session.plannedDurationMs && session.elapsedMs >= session.plannedDurationMs)
        let cycle = state.pomodorosSinceLongBreak
        if (fullPomodoro) cycle++
        if (session.phase === 'long-break' && session.plannedDurationMs && session.elapsedMs >= session.plannedDurationMs) cycle = 0

        let nextTimer: ActiveFocusTimer | null = null
        if (fullPomodoro && state.settings.autoStartBreaks) {
          const phase = cycle >= state.settings.longBreakEvery ? 'long-break' : 'short-break'
          nextTimer = newActiveTimer({
            mode: 'pomodoro',
            phase,
            plannedDurationMs: (phase === 'long-break' ? state.settings.longBreakMinutes : state.settings.shortBreakMinutes) * MINUTE_MS,
            at: requestedAt,
          })
        } else if (session.phase !== 'focus' && session.plannedDurationMs &&
          session.elapsedMs >= session.plannedDurationMs && state.settings.autoStartFocus) {
          const previousFocus = [...state.sessions].reverse().find(item => item.phase === 'focus' && item.status === 'completed')
          const selectedSubjectId = previousFocus
            ? previousFocus.subjectTagId && state.subjectTags.some(tag =>
                tag.id === previousFocus.subjectTagId && tag.archivedAt === null)
              ? previousFocus.subjectTagId
              : null
            : state.subjectTags.find(tag => tag.archivedAt === null)?.id ?? null
          nextTimer = newActiveTimer({
            mode: 'pomodoro',
            phase: 'focus',
            subjectTagId: selectedSubjectId,
            topic: previousFocus?.topic ?? '',
            plannedDurationMs: state.settings.pomodoroMinutes * MINUTE_MS,
            at: requestedAt,
          })
          // A timed break ends on an actionable alarm. Prepare the next block,
          // but do not count focus time until the learner swipes the alarm away.
          if (session.completionReason === 'timer') {
            nextTimer = {
              ...nextTimer,
              status: 'paused',
              pausedAt: requestedAt,
              segments: [],
            }
          }
        }
        set({
          activeTimer: nextTimer,
          sessions: appendHistory(state.sessions, session),
          pomodorosSinceLongBreak: cycle,
        })
        return session
      },

      cancel: (input = {}) => {
        const state = get()
        const timer = state.activeTimer
        if (!timer) return null
        const session = closeActiveTimer(timer, state.subjectTags, {
          at: Math.max(timer.startedAt, safeTimestamp(input.at)),
          status: 'cancelled',
          reason: 'cancelled',
          note: input.reason,
        })
        set({
          activeTimer: null,
          sessions: input.discard ? state.sessions : appendHistory(state.sessions, session),
        })
        return session
      },

      recordInterruption: (input = {}) => {
        const timer = get().activeTimer
        if (!timer) return false
        const startedAt = Math.max(timer.startedAt, safeTimestamp(input.startedAt ?? input.at))
        const suppliedEnd = input.endedAt === undefined ? null : Math.max(startedAt, safeTimestamp(input.endedAt))
        const suppliedDuration = positiveDuration(input.durationMs)
        const endedAt = suppliedEnd ?? (suppliedDuration !== null ? startedAt + suppliedDuration : null)
        set({
          activeTimer: {
            ...timer,
            interruptions: [...timer.interruptions, {
              id: makeId('focus-interruption'),
              startedAt,
              endedAt,
              durationMs: endedAt === null ? null : endedAt - startedAt,
              reason: cleanText(input.reason, 160) || undefined,
            }],
          },
        })
        return true
      },

      endInterruption: (id, value) => {
        const timer = get().activeTimer
        const interruption = timer?.interruptions.find(item => item.id === id)
        if (!timer || !interruption || interruption.endedAt !== null) return false
        const endedAt = Math.max(interruption.startedAt, safeTimestamp(value))
        set({
          activeTimer: {
            ...timer,
            interruptions: timer.interruptions.map(item => item.id === id ? {
              ...item,
              endedAt,
              durationMs: endedAt - item.startedAt,
            } : item),
          },
        })
        return true
      },

      reconcile: (value) => {
        const at = safeTimestamp(value)
        return isActiveTimerComplete(get().activeTimer, at)
          ? get().finish({ at, reason: 'timer' })
          : null
      },

      createSubjectTag: (rawName, rawColor = '#8FA3BF') => {
        const name = cleanText(rawName, 50)
        if (!name) return null
        const existing = get().subjectTags.find(tag => tag.name.toLowerCase() === name.toLowerCase())
        if (existing) {
          if (existing.archivedAt === null) return null
          const duplicateSelected = get().subjectTags.some(tag => tag.id !== existing.id &&
            tag.name.toLowerCase() === name.toLowerCase() && tag.archivedAt === null)
          if (duplicateSelected) return null
          set(state => ({
            subjectTags: state.subjectTags.map(tag => tag.id === existing.id ? { ...tag, archivedAt: null } : tag),
            subjectPlanConfigured: true,
          }))
          return existing.id
        }
        const id = makeId('focus-subject')
        const tag: FocusSubjectTag = {
          id,
          name,
          color: cleanText(rawColor, 32) || '#8FA3BF',
          createdAt: Date.now(),
          archivedAt: null,
        }
        set(state => ({ subjectTags: [...state.subjectTags, tag], subjectPlanConfigured: true }))
        return id
      },

      updateSubjectTag: (id, patch) => {
        const current = get().subjectTags.find(tag => tag.id === id)
        if (!current) return false
        const name = patch.name === undefined ? current.name : cleanText(patch.name, 50)
        if (!name || get().subjectTags.some(tag => tag.id !== id && tag.name.toLowerCase() === name.toLowerCase() && tag.archivedAt === null)) return false
        set(state => ({
          subjectTags: state.subjectTags.map(tag => tag.id === id ? {
            ...tag,
            name,
            color: patch.color === undefined ? tag.color : cleanText(patch.color, 32) || tag.color,
          } : tag),
        }))
        return true
      },

      archiveSubjectTag: (id, value) => {
        if (!get().subjectTags.some(tag => tag.id === id && tag.archivedAt === null)) return false
        if (get().activeTimer?.phase === 'focus' && get().activeTimer?.subjectTagId === id) return false
        set(state => ({
          subjectTags: state.subjectTags.map(tag => tag.id === id ? { ...tag, archivedAt: safeTimestamp(value) } : tag),
          subjectPlanConfigured: true,
        }))
        return true
      },

      restoreSubjectTag: (id) => {
        const current = get().subjectTags.find(tag => tag.id === id)
        if (!current || current.archivedAt === null || get().subjectTags.some(tag => tag.id !== id && tag.name.toLowerCase() === current.name.toLowerCase() && tag.archivedAt === null)) return false
        set(state => ({
          subjectTags: state.subjectTags.map(tag => tag.id === id ? { ...tag, archivedAt: null } : tag),
          subjectPlanConfigured: true,
        }))
        return true
      },

      setDefaultDailyGoal: (goal) => set(state => ({ goals: { ...state.goals, default: normalizeGoal(goal) } })),

      setDailyGoal: (date, goal) => {
        if (!parseLocalDate(date)) return false
        set(state => ({ goals: { ...state.goals, byDate: { ...state.goals.byDate, [date]: normalizeGoal(goal) } } }))
        return true
      },

      clearDailyGoal: (date) => set(state => {
        const byDate = { ...state.goals.byDate }
        delete byDate[date]
        return { goals: { ...state.goals, byDate } }
      }),

      updateSettings: (patch) => set(state => ({ settings: normalizeSettings({ ...state.settings, ...patch }) })),
      updatePrivacy: (patch) => set(state => ({ privacy: normalizePrivacy({ ...state.privacy, ...patch }) })),

      updateSessionNote: (id, note) => {
        if (!get().sessions.some(session => session.id === id)) return false
        set(state => ({
          sessions: state.sessions.map(session => session.id === id ? {
            ...session,
            note: cleanText(note, 500),
            sync: { ...session.sync, syncedAt: null, revision: session.sync.revision + 1 },
          } : session),
        }))
        return true
      },

      markSessionSynced: (id, rawServerId, value, expectedRevision) => {
        const serverId = cleanText(rawServerId, 160)
        const current = get().sessions.find(session => session.id === id)
        if (!serverId || !current ||
          (expectedRevision !== undefined && current.sync.revision !== expectedRevision)) return false
        set(state => ({
          sessions: state.sessions.map(session => session.id === id ? {
            ...session,
            sync: { ...session.sync, serverId, syncedAt: safeTimestamp(value) },
          } : session),
        }))
        return true
      },

      deleteSession: (id) => set(state => ({ sessions: state.sessions.filter(session => session.id !== id) })),
      clearHistory: () => set({ sessions: [], pomodorosSinceLongBreak: 0 }),
      resetFocusData: () => set(state => ({ ...initialData(), hasHydrated: state.hasHydrated })),
      markHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state): FocusPersistedState => ({
        activeTimer: state.activeTimer,
        sessions: state.sessions,
        subjectTags: state.subjectTags,
        subjectPlanConfigured: state.subjectPlanConfigured,
        goals: state.goals,
        settings: state.settings,
        privacy: state.privacy,
        pomodorosSinceLongBreak: state.pomodorosSinceLongBreak,
      }),
      migrate: (persisted, version) => migratePersisted(persisted, version),
      merge: (persisted, current) => ({ ...current, ...normalizePersisted(persisted) }),
      onRehydrateStorage: () => (state) => state?.markHydrated(true),
    },
  ),
)
