export type FocusView = 'today' | 'analytics' | 'friends' | 'groups' | 'rankings' | 'settings'
export type FocusPeriod = 'day' | 'week' | 'month'
export type FocusPlatform = 'web' | 'ios' | 'android'
export type FocusTimerState = 'idle' | 'running' | 'paused'
export type FocusTimerMode = 'pomodoro' | 'stopwatch'
export type FocusPomodoroPhase = 'focus' | 'short-break' | 'long-break'
export type FocusFriendAction = 'add' | 'accept' | 'decline' | 'cancel' | 'remove' | 'block' | 'nudge'

export interface FocusProfile {
  id: string
  username?: string
  name: string
  initials: string
  avatarUrl?: string
  dailyGoalSeconds: number
  currentStreak: number
  bestStreak: number
  rank?: number
}

export interface FocusSubject {
  id: string
  label: string
  color: string
  goalSeconds: number
}

export interface FocusSubjectChoice extends FocusSubject {
  selected: boolean
  custom: boolean
  hasHistory: boolean
}

export interface FocusSessionRecord {
  id: string
  subjectId: string
  startedAt: number
  endedAt: number
  focusedSeconds: number
  interruptionCount: number
  mode: FocusTimerMode
  completed: boolean
}

export interface FocusActivityRecord {
  id: string
  subjectLabel: string
  subjectColor: string
  startedAt: number
  endedAt: number
  durationSeconds: number
  pausedSeconds: number
  pauseCount: number
  interruptionCount: number
  mode: FocusTimerMode
  phase: FocusPomodoroPhase
  outcome: 'completed' | 'stopped-early'
}

export interface FocusTimerSnapshot {
  mode: FocusTimerMode
  state: FocusTimerState
  phase: FocusPomodoroPhase
  selectedSubjectId: string
  plannedSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  startedAt?: number
}

export interface FocusPerson {
  id: string
  username?: string
  name: string
  initials: string
  avatarUrl?: string
  emailHint?: string
  phoneHint?: string
  isLive: boolean
  subject?: string
  liveSeconds?: number
  todaySeconds: number
  weeklySeconds: number
  monthlySeconds: number
  streak: number
  mutualCount?: number
}

export interface FocusFriendRequest {
  id: string
  person: FocusPerson
  direction: 'incoming' | 'outgoing'
}

export interface FocusGroup {
  id: string
  name: string
  description: string
  category: string
  privacy: 'public' | 'private'
  ownerName: string
  isOwner: boolean
  isMember: boolean
  canManage: boolean
  memberCount: number
  capacity: number
  liveCount: number
  weeklyGoalSeconds: number
  weeklySeconds: number
  rank?: number
  rules: string[]
  memberIds: string[]
}

export interface FocusGroupMessage {
  id: string
  groupId: string
  senderId: string
  senderName: string
  senderInitials: string
  senderAvatarUrl?: string
  text: string
  createdAt: number
}

export interface FocusGroupInviteNotice {
  id: string
  groupId: string
  groupName: string
  category: string
  inviterName: string
  message: string
  expiresAt: number
}

export interface FocusGroupJoinRequestNotice {
  id: string
  groupId: string
  groupName: string
  message: string
  createdAt: number
  person: FocusPerson
}

export interface FocusRankingEntry {
  person: FocusPerson
  daySeconds: number
  weekSeconds: number
  monthSeconds: number
}

export interface FocusPreferences {
  friendRequests: boolean
  groupInvites: boolean
  showLiveStatus: boolean
  shareFocusTime: boolean
  publicProfile: boolean
  focusShield: boolean
}

export interface FocusTimerSettings {
  focusSeconds: number
  shortBreakSeconds: number
  longBreakSeconds: number
  dailyGoalSeconds: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundEnabled: boolean
  completionNotifications: boolean
  keepScreenAwake: boolean
  fullscreenSessions: boolean
  strictMode: boolean
}

export interface FocusGroupDraft {
  name: string
  category: string
  description: string
  privacy: 'public' | 'private'
  joinPolicy: 'open' | 'approval' | 'invite-only'
  capacity: number
  weeklyGoalSeconds: number
  rules: string[]
}

export interface FocusScreenData {
  profile: FocusProfile
  /** Only explicitly selected subjects; used by the timer and Daily plan. */
  subjects: FocusSubject[]
  /** Selected plus historical subjects, so hiding one never erases analytics. */
  analyticsSubjects: FocusSubject[]
  /** Full user-managed library, including hidden built-in suggestions. */
  subjectChoices: FocusSubjectChoice[]
  subjectPlanConfigured: boolean
  sessions: FocusSessionRecord[]
  activityLog: FocusActivityRecord[]
  timer?: FocusTimerSnapshot
  friends: FocusPerson[]
  requests: FocusFriendRequest[]
  discoveries: FocusPerson[]
  groups: FocusGroup[]
  groupMembers: FocusPerson[]
  groupMessages: FocusGroupMessage[]
  groupInvites: FocusGroupInviteNotice[]
  groupJoinRequests: FocusGroupJoinRequestNotice[]
  rankings: FocusRankingEntry[]
  preferences: FocusPreferences
  timerSettings: FocusTimerSettings
}

export interface FocusSessionResult {
  subjectId: string
  mode: FocusTimerMode
  phase: FocusPomodoroPhase
  plannedSeconds: number
  elapsedSeconds: number
  startedAt: number
  endedAt: number
}

export interface FocusSearchRequest {
  query: string
  channel: 'username' | 'email' | 'phone'
}

export interface FocusInviteShare {
  id: string
  token: string
  url: string
  kind: 'friend' | 'group'
  groupId: string | null
  expiresAt: string
}

export interface FocusScreenProps {
  data?: FocusScreenData
  initialView?: FocusView
  platform?: FocusPlatform
  nativeFocusShieldAvailable?: boolean
  socialNotice?: string
  socialNoticeKind?: 'loading' | 'unavailable' | 'error'
  onClose?: () => void
  onTimerModeChange?: (mode: FocusTimerMode) => void
  onSubjectChange?: (subjectId: string) => void
  onSubjectSelectionChange?: (subjectId: string, selected: boolean) => boolean | void
  onSubjectCreate?: (name: string) => string | null
  onPomodoroPhaseChange?: (phase: FocusPomodoroPhase) => void
  onPomodoroLengthChange?: (seconds: number) => void
  onSessionStart?: (snapshot: FocusTimerSnapshot) => void
  onSessionPause?: (snapshot: FocusTimerSnapshot) => void
  onSessionResume?: (snapshot: FocusTimerSnapshot) => void
  onSessionFinish?: (result: FocusSessionResult) => void
  onSearchPeople?: (request: FocusSearchRequest) => Promise<FocusPerson[]> | FocusPerson[]
  onUsernameChange?: (username: string) => Promise<string> | string
  onCreateInviteLink?: (kind: 'friend' | 'group', groupId?: string) => Promise<FocusInviteShare>
  onRevokeInviteLink?: (inviteId: string) => Promise<boolean> | boolean
  onFriendAction?: (action: FocusFriendAction, personId: string, requestId?: string) => Promise<boolean> | boolean
  onOpenGroup?: (groupId: string) => Promise<void> | void
  onCreateGroup?: (draft: FocusGroupDraft) => Promise<string | null> | string | null
  onJoinGroup?: (groupId: string) => void
  onJoinGroupByCode?: (code: string) => void
  onLeaveGroup?: (groupId: string) => Promise<boolean> | boolean
  onInviteToGroup?: (groupId: string, exactContact: string) => Promise<boolean> | boolean
  onRespondGroupInvite?: (inviteId: string, accept: boolean) => Promise<boolean> | boolean
  onRespondGroupJoinRequest?: (requestId: string, accept: boolean) => Promise<boolean> | boolean
  onSendGroupMessage?: (groupId: string, text: string) => Promise<boolean> | boolean
  onGroupMemberAction?: (action: 'nudge' | 'remove' | 'block', groupId: string, personId: string) => Promise<boolean> | boolean
  onRankingScopeChange?: (period: FocusPeriod, groupId?: string) => void
  onPreferenceChange?: <K extends keyof FocusPreferences>(key: K, value: FocusPreferences[K]) => void
  onTimerSettingsChange?: <K extends keyof FocusTimerSettings>(key: K, value: FocusTimerSettings[K]) => void
  onFocusShieldAction?: (platform: FocusPlatform) => void
}

export const EMPTY_FOCUS_DATA: FocusScreenData = {
  profile: {
    id: '',
    name: 'UPSC Aspirant',
    initials: 'UA',
    dailyGoalSeconds: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  subjects: [],
  analyticsSubjects: [],
  subjectChoices: [],
  subjectPlanConfigured: false,
  sessions: [],
  activityLog: [],
  friends: [],
  requests: [],
  discoveries: [],
  groups: [],
  groupMembers: [],
  groupMessages: [],
  groupInvites: [],
  groupJoinRequests: [],
  rankings: [],
  preferences: {
    friendRequests: true,
    groupInvites: true,
    showLiveStatus: false,
    shareFocusTime: false,
    publicProfile: false,
    focusShield: false,
  },
  timerSettings: {
    focusSeconds: 1_500,
    shortBreakSeconds: 300,
    longBreakSeconds: 900,
    dailyGoalSeconds: 0,
    autoStartBreaks: false,
    autoStartFocus: false,
    soundEnabled: false,
    completionNotifications: false,
    keepScreenAwake: false,
    fullscreenSessions: false,
    strictMode: false,
  },
}
