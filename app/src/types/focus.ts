export type FocusTimerMode = 'pomodoro' | 'stopwatch'

export type FocusPhase = 'focus' | 'short-break' | 'long-break'

export type FocusTimerStatus = 'running' | 'paused'

export type FocusSessionStatus = 'completed' | 'cancelled'

export type FocusCompletionReason = 'manual' | 'timer' | 'cancelled'

export type FocusProfileVisibility = 'private' | 'followers' | 'public'

export type FocusWeekStart = 0 | 1

export interface FocusRunSegment {
  startedAt: number
  endedAt: number | null
}

export interface CompletedFocusRunSegment {
  startedAt: number
  endedAt: number
}

export interface FocusInterruption {
  id: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  reason?: string
}

export interface FocusSessionSyncMetadata {
  serverId: string | null
  syncedAt: number | null
  revision: number
}

export interface FocusSubjectTag {
  id: string
  name: string
  color: string
  createdAt: number
  archivedAt: number | null
}

export interface ActiveFocusTimer {
  id: string
  mode: FocusTimerMode
  phase: FocusPhase
  status: FocusTimerStatus
  subjectTagId: string | null
  topic: string
  plannedDurationMs: number | null
  startedAt: number
  pausedAt: number | null
  segments: FocusRunSegment[]
  interruptions: FocusInterruption[]
  pauseCount: number
}

export interface FocusSession {
  id: string
  mode: FocusTimerMode
  phase: FocusPhase
  status: FocusSessionStatus
  completionReason: FocusCompletionReason
  subjectTagId: string | null
  /** Snapshot keeps historical labels meaningful if a subject is renamed later. */
  subjectName: string | null
  subjectColor: string | null
  topic: string
  note: string
  plannedDurationMs: number | null
  elapsedMs: number
  pausedMs: number
  pauseCount: number
  startedAt: number
  endedAt: number
  segments: CompletedFocusRunSegment[]
  interruptions: FocusInterruption[]
  sync: FocusSessionSyncMetadata
}

export interface DailyFocusGoal {
  targetMinutes: number
  targetSessions: number | null
}

export interface FocusGoals {
  default: DailyFocusGoal
  /** Local ISO date (YYYY-MM-DD) -> an optional one-day override. */
  byDate: Record<string, DailyFocusGoal>
}

export interface FocusSettings {
  pomodoroMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundsEnabled: boolean
  notificationsEnabled: boolean
  hapticsEnabled: boolean
  keepScreenAwake: boolean
  focusShieldEnabled: boolean
  fullscreenDuringFocus: boolean
  strictMode: boolean
  weekStartsOn: FocusWeekStart
}

export interface FocusPrivacyPreferences {
  profileVisibility: FocusProfileVisibility
  shareLiveStatus: boolean
  shareAggregateStats: boolean
  appearInRankings: boolean
  discoverable: boolean
  allowStudyInvites: boolean
}

export interface StartFocusInput {
  mode: FocusTimerMode
  subjectTagId?: string | null
  topic?: string
  /** Pomodoro defaults to settings. Stopwatch may optionally use a target. */
  plannedDurationMs?: number | null
  at?: number
}

export interface StartBreakInput {
  kind?: 'short-break' | 'long-break' | 'recommended'
  plannedDurationMs?: number
  at?: number
}

export interface PauseFocusInput {
  at?: number
  reason?: string
  countAsInterruption?: boolean
}

export interface FinishFocusInput {
  at?: number
  note?: string
  reason?: Exclude<FocusCompletionReason, 'cancelled'>
}

export interface CancelFocusInput {
  at?: number
  reason?: string
  /** When true, return the cancelled record but do not add it to history. */
  discard?: boolean
}

export interface RecordFocusInterruptionInput {
  at?: number
  startedAt?: number
  endedAt?: number
  durationMs?: number
  reason?: string
}

export interface FocusSubjectStats {
  subjectTagId: string | null
  subjectName: string
  color: string | null
  focusedMs: number
  sessionCount: number
}

export interface FocusPeriodStats {
  from: number
  to: number
  focusedMs: number
  breakMs: number
  completedSessions: number
  completedPomodoros: number
  cancelledSessions: number
  interruptionCount: number
  interruptionMs: number
  pausedMs: number
  averageSessionMs: number
  longestSessionMs: number
  bySubject: FocusSubjectStats[]
}

export interface FocusGoalProgress {
  date: string
  goal: DailyFocusGoal
  focusedMinutes: number
  completedSessions: number
  progress: number
  met: boolean
}

export interface FocusStreakStats {
  current: number
  longest: number
  currentStart: string | null
  currentEnd: string | null
  longestStart: string | null
  longestEnd: string | null
}

export interface FocusHeatmapCell {
  date: string
  focusedMinutes: number
  sessionCount: number
  goalMinutes: number
  progress: number
  metGoal: boolean
  /** 0 has no focus; 1-4 are increasing shares of that day's goal. */
  level: 0 | 1 | 2 | 3 | 4
}

export interface FocusDateRange {
  from: number
  to: number
}
