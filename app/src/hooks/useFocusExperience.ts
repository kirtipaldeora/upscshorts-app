import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  FocusFriendAction,
  FocusGroup as ScreenFocusGroup,
  FocusGroupDraft,
  FocusGroupMessage as ScreenFocusGroupMessage,
  FocusPeriod as ScreenFocusPeriod,
  FocusPerson,
  FocusPlatform,
  FocusPreferences,
  FocusRankingEntry,
  FocusSearchRequest,
  FocusScreenData,
  FocusScreenProps,
  FocusSubjectChoice,
  FocusTimerSettings,
  FocusTimerSnapshot,
} from '@/components/focus/focusTypes'
import type { FocusRuntimeController } from '@/hooks/useFocusRuntime'
import { requestFocusNotificationPermission } from '@/lib/focusNotifications'
import {
  configureNativeFocusShield,
  getFocusShieldCapability,
  type FocusShieldCapability,
} from '@/lib/focusShield'
import {
  cancelFocusFriendRequest,
  createFocusGroup,
  findFocusProfile,
  getDeviceTimeZone,
  getFocusRanking,
  getFocusSocialAvailability,
  getMyFocusProfile,
  inviteFocusGroupByContact,
  joinOrRequestFocusGroup,
  leaveFocusGroup,
  listDiscoverableFocusGroups,
  listFocusFriendRequests,
  listFocusFriends,
  listFocusGroupInvites,
  listFocusGroupJoinRequests,
  listFocusGroupMembers,
  listFocusGroupMessages,
  listFocusGroups,
  listFocusPresence,
  removeFocusFriend,
  removeFocusGroupMember,
  respondFocusFriendRequest,
  respondFocusGroupInvite,
  respondFocusGroupJoinRequest,
  sendFocusFriendRequest,
  sendFocusGroupMessage,
  sendFocusNudge,
  setMyFocusUsername,
  setFocusBlock,
  subscribeToFocusGroupMessages,
  subscribeToFocusPresence,
  syncMyFocusContactHashes,
  upsertFocusProfile,
  type FocusFriend,
  type FocusFriendRequest as SocialFriendRequest,
  type FocusGroup as SocialFocusGroup,
  type FocusGroupInvite,
  type FocusGroupJoinRequest,
  type FocusGroupMember,
  type FocusGroupMessage,
  type FocusPeriod as SocialFocusPeriod,
  type FocusPresence,
  type FocusProfile as SocialFocusProfile,
  type FocusProfileMatch,
  type FocusRankingRow,
  type FocusResult,
  type FocusUnavailableReason,
} from '@/lib/focusSocialClient'
import { useAuthStore } from '@/stores/useAuthStore'
import { profileMascotUrl } from '@/components/auth/ProfileMascot'
import {
  DEFAULT_FOCUS_SUBJECT_TAGS,
  selectFocusDayStats,
  selectFocusMonthStats,
  selectFocusStreak,
  selectFocusWeekStats,
  useFocusStore,
} from '@/stores/useFocusStore'

const SECOND_MS = 1_000
const MINUTE_MS = 60_000
const REMOTE_PRESENCE_TTL_MS = 3 * 60 * MINUTE_MS
const GENERAL_SUBJECT_ID = 'focus-subject-untagged'
const BUILT_IN_SUBJECT_IDS = new Set(DEFAULT_FOCUS_SUBJECT_TAGS.map(subject => subject.id))
const CUSTOM_SUBJECT_COLORS = ['#8FA3BF', '#7CB8A5', '#A994D3', '#D59B72', '#719FC9', '#C382A5']

type RankingSets = Record<SocialFocusPeriod, FocusRankingRow[]>
type GroupMemberSets = Record<string, FocusGroupMember[]>
type GroupMessageSets = Record<string, FocusGroupMessage[]>
type GroupRankingSets = Record<string, RankingSets>

interface ProfileFlags {
  discoverable: boolean
  allowFriendRequests: boolean
  allowGroupInvites: boolean
  showInRankings: boolean
}

interface FocusSocialState {
  availability: 'ready' | FocusUnavailableReason
  loading: boolean
  error: string | null
  profile: SocialFocusProfile | null
  friends: FocusFriend[]
  requests: SocialFriendRequest[]
  presence: FocusPresence[]
  groups: SocialFocusGroup[]
  groupInvites: FocusGroupInvite[]
  groupJoinRequests: FocusGroupJoinRequest[]
  rankings: RankingSets
  groupMembers: GroupMemberSets
  groupMessages: GroupMessageSets
  groupRankings: GroupRankingSets
}

export interface UseFocusExperienceOptions {
  onShowToast?: (message: string) => void
}

export type FocusExperienceScreenProps = Omit<FocusScreenProps, 'onClose' | 'initialView'>

export interface FocusExperienceController {
  data: FocusScreenData
  screenProps: FocusExperienceScreenProps
  loading: boolean
  error: string | null
  socialAvailability: 'ready' | FocusUnavailableReason
  refresh: () => Promise<void>
}

function emptyRankings(): RankingSets {
  return { day: [], week: [], month: [] }
}

function emptySocialState(availability: FocusSocialState['availability'] = 'guest'): FocusSocialState {
  return {
    availability,
    loading: false,
    error: null,
    profile: null,
    friends: [],
    requests: [],
    presence: [],
    groups: [],
    groupInvites: [],
    groupJoinRequests: [],
    rankings: emptyRankings(),
    groupMembers: {},
    groupMessages: {},
    groupRankings: {},
  }
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'UA'
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words.at(-1)?.[0]}`).toUpperCase()
}

function seconds(milliseconds: number) {
  return Math.max(0, Math.round(milliseconds / SECOND_MS))
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function unavailableMessage(reason: FocusUnavailableReason) {
  if (reason === 'guest') return 'Sign in to use Focus friends, groups and rankings.'
  if (reason === 'offline') return 'You are offline. The timer still works, but social Focus features need a connection.'
  return 'Focus social features are not connected to a Supabase project in this build.'
}

function socialActionMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : ''
  if (/PGRST202|schema cache|could not find (?:the )?(?:function|table).*focus_/i.test(message)) {
    return 'Focus social setup is incomplete on the server. Apply the latest social database migrations, then try again.'
  }
  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return 'This signed-in account does not have permission to complete that action.'
  }
  return message || fallback
}

function resultData<T>(result: FocusResult<T>): T {
  if (!result.available) throw new Error(unavailableMessage(result.reason ?? 'offline'))
  return result.data
}

async function safeResult<T>(promise: Promise<FocusResult<T>>) {
  try {
    return { result: await promise, error: null as string | null }
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : 'The Focus service could not complete this request.',
    }
  }
}

function contactKind(value: string): 'email' | 'phone' | null {
  const contact = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return 'email'
  return /^\+?[1-9]\d{7,14}$/.test(contact.replace(/[\s()-]/g, '')) ? 'phone' : null
}

function mergeGroups(mine: SocialFocusGroup[], discoverable: SocialFocusGroup[]) {
  const byId = new Map<string, SocialFocusGroup>()
  mine.forEach(group => byId.set(group.id, group))
  discoverable.forEach(group => {
    if (!byId.has(group.id)) byId.set(group.id, group)
  })
  return [...byId.values()]
}

function mergeRankingSets(primary: RankingSets, additions: RankingSets[]) {
  const merged = emptyRankings()
  ;(['day', 'week', 'month'] as SocialFocusPeriod[]).forEach(period => {
    const byId = new Map<string, FocusRankingRow>()
    primary[period].forEach(row => byId.set(row.userId, row))
    additions.forEach(ranking => ranking[period].forEach(row => {
      if (!byId.has(row.userId)) byId.set(row.userId, row)
    }))
    merged[period] = [...byId.values()]
  })
  return merged
}

function rankingValue(rankings: RankingSets, period: SocialFocusPeriod, userId: string) {
  return rankings[period].find(row => row.userId === userId)?.totalSeconds ?? 0
}

function profileFlags(profile: SocialFocusProfile | null, fallback: ProfileFlags): ProfileFlags {
  if (!profile) return fallback
  return {
    discoverable: profile.discoverable,
    allowFriendRequests: profile.allowFriendRequests,
    allowGroupInvites: profile.allowGroupInvites,
    showInRankings: profile.showInRankings,
  }
}

/**
 * Adapts the persistent Focus domain and connected social service to the UI.
 * The runtime is injected so App can own exactly one lifecycle controller even
 * while users navigate away from the Focus screen.
 */
export function useFocusExperience(
  runtime: FocusRuntimeController,
  options: UseFocusExperienceOptions = {},
): FocusExperienceController {
  const user = useAuthStore(state => state.user)
  const authProfile = useAuthStore(state => state.profile)
  const isGuest = useAuthStore(state => state.isGuest)
  const authReady = useAuthStore(state => state.ready)

  const sessions = useFocusStore(state => state.sessions)
  const subjectTags = useFocusStore(state => state.subjectTags)
  const subjectPlanConfigured = useFocusStore(state => state.subjectPlanConfigured)
  const goals = useFocusStore(state => state.goals)
  const settings = useFocusStore(state => state.settings)
  const privacy = useFocusStore(state => state.privacy)
  const updateSettings = useFocusStore(state => state.updateSettings)
  const updatePrivacy = useFocusStore(state => state.updatePrivacy)
  const setDefaultDailyGoal = useFocusStore(state => state.setDefaultDailyGoal)
  const createSubjectTag = useFocusStore(state => state.createSubjectTag)
  const archiveSubjectTag = useFocusStore(state => state.archiveSubjectTag)
  const restoreSubjectTag = useFocusStore(state => state.restoreSubjectTag)

  const [social, setSocial] = useState<FocusSocialState>(() => emptySocialState())
  const [shieldCapability, setShieldCapability] = useState<FocusShieldCapability | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [idleMode, setIdleMode] = useState<FocusTimerSnapshot['mode']>('pomodoro')
  const [idlePhase, setIdlePhase] = useState<FocusTimerSnapshot['phase']>('focus')
  const [idleSubjectId, setIdleSubjectId] = useState(() =>
    useFocusStore.getState().subjectTags.find(tag => tag.archivedAt === null)?.id ?? '')
  const [idlePlannedSeconds, setIdlePlannedSeconds] = useState(() =>
    useFocusStore.getState().settings.pomodoroMinutes * 60)
  const [socialNow, setSocialNow] = useState(() => Date.now())

  const mountedRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const groupLoadGenerationRef = useRef(new Map<string, number>())
  const discoveryRelationshipsRef = useRef(new Map<string, FocusProfileMatch['relationship']>())
  const toastRef = useRef(options.onShowToast)
  const socialProfileRef = useRef<SocialFocusProfile | null>(null)
  const profileFlagsRef = useRef<ProfileFlags>({
    discoverable: privacy.discoverable,
    allowFriendRequests: privacy.discoverable,
    allowGroupInvites: privacy.allowStudyInvites,
    showInRankings: privacy.shareAggregateStats && privacy.profileVisibility === 'public',
  })
  const profileWriteQueueRef = useRef<Promise<void>>(Promise.resolve())
  const profileWriteGenerationRef = useRef(0)
  const identityRef = useRef({
    displayName: authProfile?.name || user?.name || 'UPSC Aspirant',
    avatarUrl: authProfile?.photoUrl || user?.avatarUrl || profileMascotUrl(authProfile?.mascotId),
  })

  useEffect(() => { toastRef.current = options.onShowToast }, [options.onShowToast])
  useEffect(() => { socialProfileRef.current = social.profile }, [social.profile])
  useEffect(() => {
    identityRef.current = {
      displayName: authProfile?.name || user?.name || 'UPSC Aspirant',
      avatarUrl: authProfile?.photoUrl || user?.avatarUrl || profileMascotUrl(authProfile?.mascotId),
    }
  }, [authProfile?.mascotId, authProfile?.name, authProfile?.photoUrl, user?.avatarUrl, user?.name])

  const showToast = useCallback((message: string) => {
    try { toastRef.current?.(message) } catch { /* optional host UI */ }
  }, [])

  const setActionError = useCallback((error: unknown, fallback: string) => {
    const message = socialActionMessage(error, fallback)
    if (mountedRef.current) setSocial(current => ({ ...current, error: message }))
    showToast(message)
    return message
  }, [showToast])

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current
    if (!authReady) return
    if (!user?.id || isGuest) {
      if (mountedRef.current && generation === refreshGenerationRef.current) {
        setSocial(emptySocialState('guest'))
      }
      return
    }

    if (mountedRef.current) setSocial(current => ({ ...current, loading: true, error: null }))
    let availability: Awaited<ReturnType<typeof getFocusSocialAvailability>>
    try {
      availability = await getFocusSocialAvailability()
    } catch (error) {
      if (mountedRef.current && generation === refreshGenerationRef.current) {
        setSocial(current => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Focus social features could not connect.',
        }))
      }
      return
    }

    if (generation !== refreshGenerationRef.current) return
    if (availability !== 'ready') {
      if (mountedRef.current) setSocial(emptySocialState(availability))
      return
    }

    const [profileRead, contactHashRead, friendsRead, requestsRead, presenceRead, groupsRead, discoverRead, invitesRead, joinRequestsRead, dayRead, weekRead, monthRead] = await Promise.all([
      safeResult(getMyFocusProfile()),
      // Existing accounts may predate the Focus migration. Re-syncing is
      // idempotent and is what makes exact email/phone group invites work.
      safeResult(syncMyFocusContactHashes()),
      safeResult(listFocusFriends()),
      safeResult(listFocusFriendRequests()),
      safeResult(listFocusPresence()),
      safeResult(listFocusGroups()),
      safeResult(listDiscoverableFocusGroups()),
      safeResult(listFocusGroupInvites()),
      safeResult(listFocusGroupJoinRequests()),
      safeResult(getFocusRanking('day')),
      safeResult(getFocusRanking('week')),
      safeResult(getFocusRanking('month')),
    ])
    if (generation !== refreshGenerationRef.current) return

    let nextProfile = profileRead.result?.available ? profileRead.result.data : null
    let firstError = [profileRead, contactHashRead, friendsRead, requestsRead, presenceRead, groupsRead, discoverRead, invitesRead, joinRequestsRead, dayRead, weekRead, monthRead]
      .map(read => read.error)
      .find(Boolean) ?? null

    if (!nextProfile && profileRead.result?.available) {
      const flags = profileFlagsRef.current
      const created = await safeResult(upsertFocusProfile({
        displayName: identityRef.current.displayName,
        avatarUrl: identityRef.current.avatarUrl,
        timezone: getDeviceTimeZone(),
        ...flags,
      }))
      if (generation !== refreshGenerationRef.current) return
      if (created.result?.available) nextProfile = created.result.data
      firstError ??= created.error
    }

    const unavailable = [profileRead, contactHashRead, friendsRead, requestsRead, presenceRead, groupsRead, discoverRead, invitesRead, joinRequestsRead, dayRead, weekRead, monthRead]
      .map(read => read.result)
      .find(result => result && !result.available)?.reason
    if (unavailable) {
      if (mountedRef.current) setSocial(emptySocialState(unavailable))
      return
    }

    if (nextProfile) {
      const localPrivacy = useFocusStore.getState().privacy
      const desiredRankingVisibility = localPrivacy.shareAggregateStats && localPrivacy.profileVisibility === 'public'
      const identityChanged = nextProfile.displayName !== identityRef.current.displayName || nextProfile.avatarUrl !== identityRef.current.avatarUrl
      if (nextProfile.showInRankings !== desiredRankingVisibility || identityChanged) {
        const rankingSafeProfile = await safeResult(upsertFocusProfile({
          displayName: identityRef.current.displayName,
          avatarUrl: identityRef.current.avatarUrl,
          headline: nextProfile.headline,
          timezone: nextProfile.timezone,
          discoverable: nextProfile.discoverable,
          allowFriendRequests: nextProfile.allowFriendRequests,
          allowGroupInvites: nextProfile.allowGroupInvites,
          showInRankings: desiredRankingVisibility,
        }))
        if (generation !== refreshGenerationRef.current) return
        if (rankingSafeProfile.result?.available && rankingSafeProfile.result.data) {
          nextProfile = rankingSafeProfile.result.data
        } else {
          firstError ??= rankingSafeProfile.error
        }
      }
      const flags = profileFlags(nextProfile, profileFlagsRef.current)
      profileFlagsRef.current = flags
      updatePrivacy({
        discoverable: flags.discoverable && flags.allowFriendRequests,
        allowStudyInvites: flags.allowGroupInvites,
      })
    }

    if (!mountedRef.current) return
    const refreshedGroups = groupsRead.result?.available && discoverRead.result?.available
      ? mergeGroups(groupsRead.result.data, discoverRead.result.data)
      : null
    const adminGroupIds = new Set((groupsRead.result?.available ? groupsRead.result.data : [])
      .filter(group => group.role === 'owner' || group.role === 'admin')
      .map(group => group.id))
    const adminJoinRequests = joinRequestsRead.result?.available
      ? joinRequestsRead.result.data.filter(request => adminGroupIds.has(request.groupId))
      : null
    setSocial(current => ({
      ...current,
      availability: 'ready',
      loading: false,
      error: firstError,
      profile: nextProfile,
      friends: friendsRead.result?.available ? friendsRead.result.data : current.friends,
      requests: requestsRead.result?.available ? requestsRead.result.data : current.requests,
      presence: presenceRead.result?.available ? presenceRead.result.data : current.presence,
      groups: refreshedGroups ?? current.groups,
      groupInvites: invitesRead.result?.available ? invitesRead.result.data : current.groupInvites,
      groupJoinRequests: adminJoinRequests ?? current.groupJoinRequests,
      rankings: {
        day: dayRead.result?.available ? dayRead.result.data : current.rankings.day,
        week: weekRead.result?.available ? weekRead.result.data : current.rankings.week,
        month: monthRead.result?.available ? monthRead.result.data : current.rankings.month,
      },
    }))
  }, [authReady, isGuest, updatePrivacy, user?.id])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    return () => {
      mountedRef.current = false
      refreshGenerationRef.current++
    }
  }, [refresh])

  useEffect(() => {
    const handleOnline = () => { void refresh() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refresh])

  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | null = null
    if (social.availability !== 'ready') return
    void subscribeToFocusPresence(presence => {
      if (!disposed && mountedRef.current) {
        setSocial(current => ({
          ...current,
          presence: [presence, ...current.presence.filter(item => item.userId !== presence.userId)],
        }))
      }
    }).then(stop => {
      if (disposed) stop()
      else unsubscribe = stop
    }).catch(() => undefined)
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [social.availability, user?.id])

  const livePresenceExpiry = useMemo(() => social.presence.reduce((latest, presence) =>
    presence.status === 'focusing'
      ? Math.max(latest, timestamp(presence.lastSeenAt) + REMOTE_PRESENCE_TTL_MS)
      : latest, 0), [social.presence])

  useEffect(() => {
    if (livePresenceExpiry <= Date.now()) return
    setSocialNow(Date.now())
    const interval = window.setInterval(() => {
      if (Date.now() > livePresenceExpiry) {
        window.clearInterval(interval)
        return
      }
      setSocialNow(Date.now())
    }, SECOND_MS)
    return () => window.clearInterval(interval)
  }, [livePresenceExpiry])

  useEffect(() => {
    const groupId = selectedGroupId
    if (!groupId || social.availability !== 'ready') return
    let disposed = false
    let unsubscribe: (() => void) | null = null
    void subscribeToFocusGroupMessages(groupId, message => {
      if (disposed || !mountedRef.current) return
      setSocial(current => {
        const existing = current.groupMessages[groupId] ?? []
        if (existing.some(item => item.id === message.id)) return current
        return {
          ...current,
          groupMessages: { ...current.groupMessages, [groupId]: [...existing, message] },
        }
      })
    }).then(stop => {
      if (disposed) stop()
      else unsubscribe = stop
    }).catch(() => undefined)
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [selectedGroupId, social.availability, user?.id])

  useEffect(() => {
    let disposed = false
    void getFocusShieldCapability().then(capability => {
      if (!disposed && mountedRef.current) setShieldCapability(capability)
    })
    return () => { disposed = true }
  }, [])

  const availableSubjects = useMemo(() => subjectTags.filter(tag => tag.archivedAt === null), [subjectTags])

  useEffect(() => {
    if (runtime.activeTimer) return
    if (idleSubjectId && !availableSubjects.some(subject => subject.id === idleSubjectId)) {
      setIdleSubjectId(availableSubjects[0]?.id ?? '')
    }
  }, [availableSubjects, idleSubjectId, runtime.activeTimer])

  useEffect(() => {
    if (runtime.activeTimer) return
    const planned = idlePhase === 'focus'
      ? settings.pomodoroMinutes * 60
      : idlePhase === 'short-break' ? settings.shortBreakMinutes * 60 : settings.longBreakMinutes * 60
    setIdlePlannedSeconds(planned)
  }, [idlePhase, runtime.activeTimer, settings.longBreakMinutes, settings.pomodoroMinutes, settings.shortBreakMinutes])

  const focusStateForStats = useMemo(() => useFocusStore.getState(), [goals, runtime.now, sessions, settings, subjectTags])
  const dayStats = useMemo(() => selectFocusDayStats(focusStateForStats, runtime.now, runtime.now), [focusStateForStats, runtime.now])
  const weekStats = useMemo(() => selectFocusWeekStats(focusStateForStats, runtime.now, runtime.now), [focusStateForStats, runtime.now])
  const monthStats = useMemo(() => selectFocusMonthStats(focusStateForStats, runtime.now, runtime.now), [focusStateForStats, runtime.now])
  const streak = useMemo(
    () => selectFocusStreak(useFocusStore.getState(), Date.now()),
    [sessions, settings.pomodoroMinutes],
  )

  const allRankings = useMemo(
    () => mergeRankingSets(social.rankings, Object.values(social.groupRankings)),
    [social.groupRankings, social.rankings],
  )
  const presenceById = useMemo(() => new Map(social.presence.map(item => [item.userId, item])), [social.presence])
  const socialProfilesById = useMemo(() => {
    const profiles = new Map<string, SocialFocusProfile>()
    if (social.profile) profiles.set(social.profile.userId, social.profile)
    social.friends.forEach(friend => profiles.set(friend.userId, friend.profile))
    social.requests.forEach(request => {
      if (request.otherProfile) profiles.set(request.otherProfile.userId, request.otherProfile)
    })
    social.groupInvites.forEach(invite => {
      if (invite.inviter) profiles.set(invite.inviter.userId, invite.inviter)
    })
    social.groupJoinRequests.forEach(request => {
      if (request.profile) profiles.set(request.requesterId, request.profile)
    })
    Object.values(social.groupMembers).flat().forEach(member => {
      if (member.profile) profiles.set(member.userId, member.profile)
    })
    return profiles
  }, [social.friends, social.groupInvites, social.groupJoinRequests, social.groupMembers, social.profile, social.requests])

  const personFor = useCallback((input: {
    id: string
    username?: string
    name: string
    avatarUrl?: string
    emailHint?: string
    phoneHint?: string
  }): FocusPerson => {
    const activityNow = Math.max(runtime.now, socialNow)
    const isSelf = input.id === user?.id
    const presence = presenceById.get(input.id)
    const remoteLive = Boolean(
      presence?.status === 'focusing' &&
      timestamp(presence.focusStartedAt) > 0 &&
      activityNow - timestamp(presence.lastSeenAt) <= REMOTE_PRESENCE_TTL_MS,
    )
    const localLive = Boolean(
      isSelf && privacy.shareLiveStatus &&
      runtime.activeTimer?.phase === 'focus' && runtime.activeTimer.status === 'running',
    )
    const localSubject = isSelf && runtime.activeTimer
      ? availableSubjects.find(subject => subject.id === runtime.activeTimer?.subjectTagId)?.name || runtime.activeTimer.topic
      : ''
    const liveStartedAt = remoteLive ? timestamp(presence?.focusStartedAt) : 0
    return {
      id: input.id,
      username: input.username || undefined,
      name: input.name || 'Penni member',
      initials: initials(input.name || 'Penni member'),
      avatarUrl: input.avatarUrl || undefined,
      emailHint: input.emailHint,
      phoneHint: input.phoneHint,
      isLive: localLive || remoteLive,
      subject: localLive ? (localSubject || 'Focus session') : remoteLive ? (presence?.message || 'Focus session') : undefined,
      liveSeconds: localLive ? seconds(runtime.elapsedMs) : remoteLive ? seconds(activityNow - liveStartedAt) : undefined,
      todaySeconds: isSelf ? seconds(dayStats.focusedMs) : rankingValue(allRankings, 'day', input.id),
      weeklySeconds: isSelf ? seconds(weekStats.focusedMs) : rankingValue(allRankings, 'week', input.id),
      monthlySeconds: isSelf ? seconds(monthStats.focusedMs) : rankingValue(allRankings, 'month', input.id),
      streak: isSelf ? streak.current : 0,
    }
  }, [allRankings, availableSubjects, dayStats.focusedMs, monthStats.focusedMs, presenceById, privacy.shareLiveStatus, runtime.activeTimer, runtime.elapsedMs, runtime.now, socialNow, streak.current, user?.id, weekStats.focusedMs])

  const profileName = social.profile?.displayName || authProfile?.name || user?.name || 'UPSC Aspirant'
  const screenProfile = useMemo(() => ({
    id: user?.id ?? '',
    username: social.profile?.username || undefined,
    name: profileName,
    initials: initials(profileName),
    avatarUrl: social.profile?.avatarUrl || authProfile?.photoUrl || user?.avatarUrl || profileMascotUrl(authProfile?.mascotId),
    dailyGoalSeconds: goals.default.targetMinutes * 60,
    currentStreak: streak.current,
    bestStreak: streak.longest,
    rank: social.rankings.week.find(row => row.userId === user?.id)?.rankPosition,
  }), [authProfile?.mascotId, authProfile?.photoUrl, goals.default.targetMinutes, profileName, social.profile?.avatarUrl, social.profile?.username, social.rankings.week, streak.current, streak.longest, user?.avatarUrl, user?.id])

  const historicalSubjectIds = useMemo(() => new Set(sessions.flatMap(session =>
    session.phase === 'focus' && session.subjectTagId ? [session.subjectTagId] : [])), [sessions])

  const subjectChoices = useMemo<FocusSubjectChoice[]>(() => subjectTags.map(subject => ({
    id: subject.id,
    label: subject.name,
    color: subject.color,
    goalSeconds: 0,
    selected: subject.archivedAt === null,
    custom: !BUILT_IN_SUBJECT_IDS.has(subject.id),
    hasHistory: historicalSubjectIds.has(subject.id),
  })), [historicalSubjectIds, subjectTags])

  const subjects = useMemo(() => subjectChoices
    .filter(subject => subject.selected)
    .map(subject => ({
      id: subject.id,
      label: subject.label,
      color: subject.color,
      // The domain has one daily goal, not fabricated per-subject targets.
      goalSeconds: 0,
    })), [subjectChoices])

  const analyticsSubjects = useMemo(() => {
    const retained = subjectChoices
      .filter(subject => subject.selected || subject.hasHistory)
      .map(subject => ({ id: subject.id, label: subject.label, color: subject.color, goalSeconds: 0 }))
    const hasUntaggedHistory = sessions.some(session => session.phase === 'focus' && !session.subjectTagId)
    return hasUntaggedHistory
      ? [...retained, { id: GENERAL_SUBJECT_ID, label: 'General Focus', color: '#8FA3BF', goalSeconds: 0 }]
      : retained
  }, [sessions, subjectChoices])

  const sessionRecords = useMemo(() => sessions
    .filter(session => session.phase === 'focus' && session.status === 'completed')
    .map(session => ({
      id: session.id,
      subjectId: session.subjectTagId ?? GENERAL_SUBJECT_ID,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      focusedSeconds: seconds(session.elapsedMs),
      interruptionCount: session.interruptions.length,
      mode: session.mode,
      completed: true,
    })), [sessions])

  const activityLog = useMemo(() => {
    const dayStart = new Date(runtime.now)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return sessions
      .filter(session => session.endedAt >= dayStart.getTime() && session.endedAt < dayEnd.getTime())
      .map(session => {
        const breakLabel = session.phase === 'short-break'
          ? 'Short break'
          : session.phase === 'long-break' ? 'Long break' : null
        const stoppedEarly = session.status === 'cancelled' || Boolean(
          session.plannedDurationMs && session.elapsedMs < session.plannedDurationMs,
        )
        return {
          id: session.id,
          subjectLabel: breakLabel || session.subjectName || session.topic || 'General Focus',
          subjectColor: session.subjectColor || (breakLabel ? '#66B99F' : '#8FA3BF'),
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds: seconds(session.elapsedMs),
          pausedSeconds: seconds(session.pausedMs),
          pauseCount: session.pauseCount,
          interruptionCount: session.interruptions.length,
          mode: session.mode,
          phase: session.phase,
          outcome: stoppedEarly ? 'stopped-early' as const : 'completed' as const,
        }
      })
      .sort((a, b) => b.endedAt - a.endedAt)
  }, [runtime.now, sessions])

  const timer = useMemo<FocusTimerSnapshot>(() => {
    const active = runtime.activeTimer
    if (!active) {
      return {
        mode: idleMode,
        state: 'idle',
        phase: idleMode === 'stopwatch' ? 'focus' : idlePhase,
        selectedSubjectId: idleSubjectId,
        plannedSeconds: idlePlannedSeconds,
        elapsedSeconds: 0,
        remainingSeconds: idleMode === 'pomodoro' ? idlePlannedSeconds : 0,
      }
    }
    const plannedSeconds = active.plannedDurationMs
      ? seconds(active.plannedDurationMs)
      : settings.pomodoroMinutes * 60
    return {
      mode: active.mode,
      state: active.status,
      phase: active.phase,
      selectedSubjectId: active.phase === 'focus'
        ? active.subjectTagId ?? ''
        : idleSubjectId || availableSubjects[0]?.id || '',
      plannedSeconds,
      elapsedSeconds: Math.max(0, Math.floor(runtime.elapsedMs / SECOND_MS)),
      remainingSeconds: runtime.remainingMs === null
        ? 0
        : Math.max(0, Math.ceil(runtime.remainingMs / SECOND_MS)),
      startedAt: active.startedAt,
    }
  }, [availableSubjects, idleMode, idlePhase, idlePlannedSeconds, idleSubjectId, runtime.activeTimer, runtime.elapsedMs, runtime.remainingMs, settings.pomodoroMinutes])

  const friends = useMemo(() => social.friends.map(friend => personFor({
    id: friend.userId,
    username: friend.profile.username,
    name: friend.profile.displayName,
    avatarUrl: friend.profile.avatarUrl,
  })), [personFor, social.friends])

  const requests = useMemo(() => social.requests.flatMap(request => {
    if (!request.otherProfile || !user?.id) return []
    return [{
      id: request.id,
      person: personFor({
        id: request.otherProfile.userId,
        username: request.otherProfile.username,
        name: request.otherProfile.displayName,
        avatarUrl: request.otherProfile.avatarUrl,
      }),
      direction: request.senderId === user.id ? 'outgoing' as const : 'incoming' as const,
    }]
  }), [personFor, social.requests, user?.id])

  const rankingEntries = useMemo(() => {
    const ids = new Set<string>()
    allRankings.week.forEach(row => ids.add(row.userId))
    allRankings.day.forEach(row => ids.add(row.userId))
    allRankings.month.forEach(row => ids.add(row.userId))
    return [...ids].map(id => {
      const rankingProfile = (['week', 'day', 'month'] as SocialFocusPeriod[])
        .map(period => allRankings[period].find(row => row.userId === id))
        .find(Boolean)
      const profile = socialProfilesById.get(id)
      const person = personFor({
        id,
        username: profile?.username,
        name: profile?.displayName || rankingProfile?.displayName || (id === user?.id ? profileName : 'Penni member'),
        avatarUrl: profile?.avatarUrl || rankingProfile?.avatarUrl,
      })
      return {
        person,
        daySeconds: person.todaySeconds,
        weekSeconds: person.weeklySeconds,
        monthSeconds: person.monthlySeconds,
      }
    })
  }, [allRankings, personFor, profileName, socialProfilesById, user?.id])

  const groupMembers = useMemo(() => {
    const byId = new Map<string, FocusPerson>()
    Object.values(social.groupMembers).flat().forEach(member => {
      const profile = member.profile
      byId.set(member.userId, personFor({
        id: member.userId,
        username: profile?.username,
        name: profile?.displayName || (member.userId === user?.id ? profileName : 'Group member'),
        avatarUrl: profile?.avatarUrl,
      }))
    })
    return [...byId.values()]
  }, [personFor, profileName, social.groupMembers, user?.id])

  const groups = useMemo<ScreenFocusGroup[]>(() => social.groups.map(group => {
    const members = social.groupMembers[group.id] ?? []
    const rankings = social.groupRankings[group.id]
    const weeklySeconds = rankings?.week.reduce((total, row) => total + row.totalSeconds, 0) ?? 0
    const owner = members.find(member => member.userId === group.ownerId)?.profile || socialProfilesById.get(group.ownerId)
    const liveCount = members.length
      ? members.filter(member => groupMembers.find(person => person.id === member.userId)?.isLive).length
      : group.liveCount
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      privacy: group.privacy,
      ownerName: owner?.displayName || (group.ownerId === user?.id ? profileName : 'Group admin'),
      isOwner: group.role === 'owner',
      isMember: group.isMember,
      canManage: group.role === 'owner' || group.role === 'admin',
      memberCount: group.memberCount,
      capacity: group.capacity,
      liveCount,
      weeklyGoalSeconds: group.weeklyGoalSeconds,
      weeklySeconds,
      rules: group.rules,
      memberIds: members.map(member => member.userId),
    }
  }), [groupMembers, profileName, social.groupMembers, social.groupRankings, social.groups, socialProfilesById, user?.id])

  const groupMessages = useMemo<ScreenFocusGroupMessage[]>(() => Object.values(social.groupMessages).flat().map(message => {
    const sender = socialProfilesById.get(message.senderId)
    const name = sender?.displayName || (message.senderId === user?.id ? profileName : 'Group member')
    return {
      id: message.id,
      groupId: message.groupId,
      senderId: message.senderId,
      senderName: name,
      senderInitials: initials(name),
      senderAvatarUrl: sender?.avatarUrl || undefined,
      text: message.body,
      createdAt: timestamp(message.createdAt),
    }
  }), [profileName, social.groupMessages, socialProfilesById, user?.id])

  const groupInvites = useMemo(() => social.groupInvites.map(invite => ({
    id: invite.id,
    groupId: invite.groupId,
    groupName: invite.group?.name || 'Study group',
    category: invite.group?.category || 'UPSC study',
    inviterName: invite.inviter?.displayName || 'Group admin',
    message: invite.message,
    expiresAt: timestamp(invite.expiresAt),
  })), [social.groupInvites])

  const groupJoinRequests = useMemo(() => social.groupJoinRequests.map(request => {
    const profile = request.profile
    const group = social.groups.find(item => item.id === request.groupId)
    return {
      id: request.id,
      groupId: request.groupId,
      groupName: group?.name || 'Study group',
      message: request.message,
      createdAt: timestamp(request.createdAt),
      person: personFor({
        id: request.requesterId,
        username: profile?.username,
        name: profile?.displayName || 'UPSC aspirant',
        avatarUrl: profile?.avatarUrl,
      }),
    }
  }), [personFor, social.groupJoinRequests, social.groups])

  const preferences = useMemo<FocusPreferences>(() => ({
    friendRequests: social.profile
      ? social.profile.discoverable && social.profile.allowFriendRequests
      : privacy.discoverable,
    groupInvites: social.profile?.allowGroupInvites ?? privacy.allowStudyInvites,
    showLiveStatus: privacy.shareLiveStatus,
    shareFocusTime: privacy.shareAggregateStats,
    publicProfile: privacy.profileVisibility === 'public',
    focusShield: settings.focusShieldEnabled,
  }), [privacy, settings.focusShieldEnabled, social.profile])

  const timerSettings = useMemo<FocusTimerSettings>(() => ({
    focusSeconds: settings.pomodoroMinutes * 60,
    shortBreakSeconds: settings.shortBreakMinutes * 60,
    longBreakSeconds: settings.longBreakMinutes * 60,
    dailyGoalSeconds: goals.default.targetMinutes * 60,
    autoStartBreaks: settings.autoStartBreaks,
    autoStartFocus: settings.autoStartFocus,
    soundEnabled: settings.soundsEnabled,
    completionNotifications: settings.notificationsEnabled,
    keepScreenAwake: settings.keepScreenAwake,
    fullscreenSessions: settings.fullscreenDuringFocus,
    strictMode: settings.strictMode,
  }), [goals.default.targetMinutes, settings])

  const data = useMemo<FocusScreenData>(() => ({
    profile: screenProfile,
    subjects,
    analyticsSubjects,
    subjectChoices,
    subjectPlanConfigured,
    sessions: sessionRecords,
    activityLog,
    timer,
    friends,
    requests,
    discoveries: [],
    groups,
    groupMembers,
    groupMessages,
    groupInvites,
    groupJoinRequests,
    rankings: rankingEntries,
    preferences,
    timerSettings,
  }), [activityLog, analyticsSubjects, friends, groupInvites, groupJoinRequests, groupMembers, groupMessages, groups, preferences, rankingEntries, requests, screenProfile, sessionRecords, subjectChoices, subjectPlanConfigured, subjects, timer, timerSettings])

  const enqueueProfileWrite = useCallback((flags: ProfileFlags) => {
    let resolveWrite: (profile: SocialFocusProfile) => void
    let rejectWrite: (error: unknown) => void
    const result = new Promise<SocialFocusProfile>((resolve, reject) => {
      resolveWrite = resolve
      rejectWrite = reject
    })
    profileWriteQueueRef.current = profileWriteQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const current = socialProfileRef.current
        const response = await upsertFocusProfile({
          displayName: current?.displayName || identityRef.current.displayName,
          avatarUrl: current?.avatarUrl || identityRef.current.avatarUrl,
          headline: current?.headline || '',
          timezone: current?.timezone || getDeviceTimeZone(),
          ...flags,
        })
        const profile = resultData(response)
        if (!profile) throw new Error('The Focus profile could not be updated.')
        resolveWrite(profile)
      } catch (error) {
        rejectWrite(error)
      }
    })
    return result
  }, [])

  const onPreferenceChange = useCallback(async <K extends keyof FocusPreferences>(
    key: K,
    value: FocusPreferences[K],
  ) => {
    const enabled = Boolean(value)
    if (key === 'showLiveStatus') {
      updatePrivacy({ shareLiveStatus: enabled })
      return
    }
    if (key === 'focusShield') {
      updateSettings({ focusShieldEnabled: enabled })
      return
    }

    const previous = { ...profileFlagsRef.current }
    const previousPrivacy = useFocusStore.getState().privacy
    const next = { ...previous }
    if (key === 'friendRequests') {
      next.discoverable = enabled
      next.allowFriendRequests = enabled
      updatePrivacy({ discoverable: enabled })
    } else if (key === 'groupInvites') {
      next.allowGroupInvites = enabled
      updatePrivacy({ allowStudyInvites: enabled })
    } else if (key === 'shareFocusTime') {
      updatePrivacy({ shareAggregateStats: enabled })
      next.showInRankings = enabled && previousPrivacy.profileVisibility === 'public'
    } else if (key === 'publicProfile') {
      updatePrivacy({ profileVisibility: enabled ? 'public' : 'private' })
      next.showInRankings = enabled && previousPrivacy.shareAggregateStats
    } else {
      return
    }

    profileFlagsRef.current = next
    setSocial(current => ({
      ...current,
      profile: current.profile ? {
        ...current.profile,
        discoverable: next.discoverable,
        allowFriendRequests: next.allowFriendRequests,
        allowGroupInvites: next.allowGroupInvites,
        showInRankings: next.showInRankings,
      } : current.profile,
    }))
    const generation = ++profileWriteGenerationRef.current
    try {
      const saved = await enqueueProfileWrite(next)
      if (mountedRef.current) setSocial(current => ({ ...current, profile: saved, error: null }))
    } catch (error) {
      if (generation === profileWriteGenerationRef.current) {
        profileFlagsRef.current = previous
        if (key === 'friendRequests') updatePrivacy({ discoverable: previous.discoverable && previous.allowFriendRequests })
        if (key === 'groupInvites') updatePrivacy({ allowStudyInvites: previous.allowGroupInvites })
        if (key === 'shareFocusTime') updatePrivacy({ shareAggregateStats: previousPrivacy.shareAggregateStats })
        if (key === 'publicProfile') updatePrivacy({ profileVisibility: previousPrivacy.profileVisibility })
        if (mountedRef.current) setSocial(current => ({
          ...current,
          profile: current.profile ? {
            ...current.profile,
            discoverable: previous.discoverable,
            allowFriendRequests: previous.allowFriendRequests,
            allowGroupInvites: previous.allowGroupInvites,
            showInRankings: previous.showInRankings,
          } : current.profile,
        }))
      }
      setActionError(error, 'The privacy setting could not be saved.')
    }
  }, [enqueueProfileWrite, setActionError, showToast, updatePrivacy, updateSettings])

  const onTimerSettingsChange = useCallback(async <K extends keyof FocusTimerSettings>(
    key: K,
    value: FocusTimerSettings[K],
  ) => {
    if (key === 'completionNotifications') {
      if (value) {
        const allowed = await requestFocusNotificationPermission()
        if (!allowed) {
          updateSettings({ notificationsEnabled: false })
          showToast('Notification permission was not granted. Completion notifications remain off.')
          return
        }
      }
      updateSettings({ notificationsEnabled: Boolean(value) })
      return
    }
    if (key === 'dailyGoalSeconds') {
      const targetMinutes = Math.max(1, Math.round(Number(value) / 60))
      setDefaultDailyGoal({ ...goals.default, targetMinutes })
      return
    }
    if (key === 'focusSeconds') updateSettings({ pomodoroMinutes: Math.max(1, Math.round(Number(value) / 60)) })
    if (key === 'shortBreakSeconds') updateSettings({ shortBreakMinutes: Math.max(1, Math.round(Number(value) / 60)) })
    if (key === 'longBreakSeconds') updateSettings({ longBreakMinutes: Math.max(1, Math.round(Number(value) / 60)) })
    if (key === 'autoStartBreaks') updateSettings({ autoStartBreaks: Boolean(value) })
    if (key === 'autoStartFocus') updateSettings({ autoStartFocus: Boolean(value) })
    if (key === 'soundEnabled') updateSettings({ soundsEnabled: Boolean(value) })
    if (key === 'keepScreenAwake') updateSettings({ keepScreenAwake: Boolean(value) })
    if (key === 'fullscreenSessions') updateSettings({ fullscreenDuringFocus: Boolean(value) })
    if (key === 'strictMode') updateSettings({ strictMode: Boolean(value) })
  }, [goals.default, setDefaultDailyGoal, showToast, updateSettings])

  const loadGroupData = useCallback(async (groupId: string) => {
    const generation = (groupLoadGenerationRef.current.get(groupId) ?? 0) + 1
    groupLoadGenerationRef.current.set(groupId, generation)
    const [membersRead, messagesRead, dayRead, weekRead, monthRead] = await Promise.all([
      safeResult(listFocusGroupMembers(groupId)),
      safeResult(listFocusGroupMessages(groupId)),
      safeResult(getFocusRanking('day', { groupId })),
      safeResult(getFocusRanking('week', { groupId })),
      safeResult(getFocusRanking('month', { groupId })),
    ])
    if (!mountedRef.current || groupLoadGenerationRef.current.get(groupId) !== generation) return false
    const failure = [membersRead, messagesRead, dayRead, weekRead, monthRead].map(read => read.error).find(Boolean)
    const unavailable = [membersRead, messagesRead, dayRead, weekRead, monthRead]
      .map(read => read.result)
      .find(result => result && !result.available)?.reason
    if (failure || unavailable) {
      setActionError(
        new Error(failure || unavailableMessage(unavailable ?? 'offline')),
        'The group room could not load.',
      )
    }
    setSocial(current => ({
      ...current,
      groupMembers: membersRead.result?.available
        ? { ...current.groupMembers, [groupId]: membersRead.result.data }
        : current.groupMembers,
      groupMessages: messagesRead.result?.available
        ? { ...current.groupMessages, [groupId]: messagesRead.result.data }
        : current.groupMessages,
      groupRankings: dayRead.result?.available && weekRead.result?.available && monthRead.result?.available
        ? { ...current.groupRankings, [groupId]: {
            day: dayRead.result.data,
            week: weekRead.result.data,
            month: monthRead.result.data,
          } }
        : current.groupRankings,
    }))
    return !failure && !unavailable
  }, [setActionError])

  const loadGroup = useCallback(async (groupId: string) => {
    if (!groupId) return
    setSelectedGroupId(groupId)
    await loadGroupData(groupId)
  }, [loadGroupData])

  const onSearchPeople = useCallback(async (request: FocusSearchRequest) => {
    try {
      const response = await findFocusProfile(request.channel, request.query)
      const match = resultData(response)
      if (!match || match.userId === user?.id) return []
      discoveryRelationshipsRef.current.set(match.userId, match.relationship)
      return [personFor({
        id: match.userId,
        username: match.username,
        name: match.displayName,
        avatarUrl: match.avatarUrl,
        emailHint: request.channel === 'email' ? 'Verified email match' : undefined,
        phoneHint: request.channel === 'phone' ? 'Verified phone match' : undefined,
      })]
    } catch (error) {
      const message = setActionError(error, 'The exact account lookup could not be completed.')
      throw new Error(message)
    }
  }, [personFor, setActionError, user?.id])

  const onUsernameChange = useCallback(async (username: string) => {
    try {
      const canonical = resultData(await setMyFocusUsername(username))
      if (!canonical) throw new Error('Your username could not be saved.')
      if (mountedRef.current) {
        setSocial(current => current.profile ? {
          ...current,
          error: null,
          profile: { ...current.profile, username: canonical, updatedAt: new Date().toISOString() },
        } : current)
      }
      if (!socialProfileRef.current) await refresh()
      showToast(`Username saved as @${canonical}.`)
      return canonical
    } catch (error) {
      const message = setActionError(error, 'Your username could not be saved.')
      throw new Error(message)
    }
  }, [refresh, setActionError, showToast])

  const onFriendAction = useCallback(async (action: FocusFriendAction, personId: string, requestId?: string) => {
    try {
      if (action === 'add') {
        const relationship = discoveryRelationshipsRef.current.get(personId)
        if (relationship === 'friend') { showToast('This person is already in your Focus circle.'); return false }
        if (relationship === 'incoming') { showToast('This person has already sent you a request. Review it below.'); return false }
        if (relationship === 'outgoing') { showToast('Your friend request is already pending.'); return false }
        const id = resultData(await sendFocusFriendRequest(personId))
        if (!id) throw new Error('The friend request could not be created.')
        showToast('Friend request sent.')
      } else if (action === 'accept' || action === 'decline') {
        const id = requestId ?? social.requests.find(request =>
          request.senderId === personId && request.status === 'pending')?.id
        if (!id) throw new Error('This friend request is no longer available.')
        const saved = resultData(await respondFocusFriendRequest(id, action === 'accept'))
        if (!saved) throw new Error('The friend request could not be updated.')
        showToast(action === 'accept' ? 'Friend added to your Focus circle.' : 'Friend request declined.')
      } else if (action === 'cancel') {
        const id = requestId ?? social.requests.find(request =>
          request.recipientId === personId && request.status === 'pending')?.id
        if (!id) throw new Error('This friend request is no longer available.')
        const saved = resultData(await cancelFocusFriendRequest(id))
        if (!saved) throw new Error('The sent request could not be cancelled.')
        showToast('Friend request cancelled.')
      } else if (action === 'remove') {
        const saved = resultData(await removeFocusFriend(personId))
        if (!saved) throw new Error('This friend could not be removed.')
        showToast('Friend removed from your Focus circle.')
      } else if (action === 'block') {
        const saved = resultData(await setFocusBlock(personId, true))
        if (!saved) throw new Error('This account could not be blocked.')
        showToast('Account blocked. Future lookup and requests are disabled between both accounts.')
      } else if (action === 'nudge') {
        const id = resultData(await sendFocusNudge(personId, { kind: 'encourage' }))
        if (!id) throw new Error('The nudge could not be sent.')
        showToast('Encouragement sent.')
        return true
      }
      await refresh()
      return true
    } catch (error) {
      setActionError(error, 'The friend action could not be completed.')
      return false
    }
  }, [refresh, setActionError, showToast, social.requests])

  const onCreateGroup = useCallback(async (draft: FocusGroupDraft) => {
    if (draft.privacy === 'private' && draft.joinPolicy === 'open') {
      showToast('A private group cannot use open joining. Choose admin approval or invite only.')
      return null
    }
    try {
      const id = resultData(await createFocusGroup({
        name: draft.name,
        description: draft.description,
        privacy: draft.privacy,
        category: draft.category,
        rules: draft.rules,
        weeklyGoalSeconds: draft.weeklyGoalSeconds,
        capacity: draft.capacity,
        joinPolicy: draft.joinPolicy === 'approval' ? 'request' : draft.joinPolicy === 'invite-only' ? 'invite' : 'open',
      }))
      if (!id) throw new Error('The study group could not be created.')
      setSelectedGroupId(id)
      showToast('Study group created.')
      await refresh()
      return id
    } catch (error) {
      const message = setActionError(error, 'The study group could not be created.')
      throw new Error(message)
    }
  }, [refresh, setActionError, showToast])

  const onJoinGroup = useCallback(async (groupId: string) => {
    if (!groupId) return
    try {
      const status = resultData(await joinOrRequestFocusGroup(groupId))
      if (!status) throw new Error('The group request could not be created.')
      showToast(status === 'joined' || status === 'member' ? 'You are now in the study group.' : 'Your request is waiting for an admin.')
      await refresh()
    } catch (error) {
      setActionError(error, 'The group request could not be completed.')
    }
  }, [refresh, setActionError, showToast])

  const onLeaveGroup = useCallback(async (groupId: string) => {
    try {
      const saved = resultData(await leaveFocusGroup(groupId))
      if (!saved) throw new Error('The study group could not be left.')
      setSelectedGroupId(null)
      showToast('You left the study group.')
      await refresh()
      return true
    } catch (error) {
      setActionError(error, 'The study group could not be left.')
      return false
    }
  }, [refresh, setActionError, showToast])

  const onInviteToGroup = useCallback(async (groupId: string, exactContact: string) => {
    const kind = contactKind(exactContact)
    if (!kind) {
      showToast('Enter a complete email address or full phone number with country code.')
      return false
    }
    try {
      // The server performs the exact hash lookup and invitation atomically so
      // this flow never reveals whether or which profile matched the contact.
      const id = resultData(await inviteFocusGroupByContact(groupId, kind, exactContact))
      if (!id) throw new Error('The group invitation could not be created.')
      showToast('Group invitation sent.')
      return true
    } catch (error) {
      const message = setActionError(error, 'The group invitation could not be sent.')
      throw new Error(message)
    }
  }, [setActionError, showToast])

  const onRespondGroupInvite = useCallback(async (inviteId: string, accept: boolean) => {
    const invite = social.groupInvites.find(item => item.id === inviteId)
    if (!invite) {
      showToast('This group invitation is no longer available.')
      return false
    }
    try {
      const saved = resultData(await respondFocusGroupInvite(inviteId, accept))
      if (!saved) throw new Error('The group invitation could not be updated.')
      showToast(accept ? `Joined ${invite.group?.name || 'the study group'}.` : 'Group invitation declined.')
      await refresh()
      return true
    } catch (error) {
      setActionError(error, 'The group invitation could not be updated.')
      return false
    }
  }, [refresh, setActionError, showToast, social.groupInvites])

  const onRespondGroupJoinRequest = useCallback(async (requestId: string, accept: boolean) => {
    const request = social.groupJoinRequests.find(item => item.id === requestId)
    if (!request) {
      showToast('This join request is no longer available.')
      return false
    }
    try {
      const saved = resultData(await respondFocusGroupJoinRequest(requestId, accept))
      if (!saved) throw new Error('The join request could not be updated.')
      showToast(accept ? 'Member approved and added to the group.' : 'Join request declined.')
      await refresh()
      if (accept && selectedGroupId === request.groupId) await loadGroupData(request.groupId)
      return true
    } catch (error) {
      setActionError(error, 'The join request could not be updated.')
      return false
    }
  }, [loadGroupData, refresh, selectedGroupId, setActionError, showToast, social.groupJoinRequests])

  const onSendGroupMessage = useCallback(async (groupId: string, text: string) => {
    const body = text.trim()
    if (!body) return false
    try {
      const message = resultData(await sendFocusGroupMessage(groupId, body))
      if (!message) throw new Error('The group message could not be sent.')
      if (mountedRef.current) setSocial(current => {
        const existing = current.groupMessages[groupId] ?? []
        return existing.some(item => item.id === message.id) ? current : {
          ...current,
          groupMessages: { ...current.groupMessages, [groupId]: [...existing, message] },
        }
      })
      return true
    } catch (error) {
      setActionError(error, 'The group message could not be sent.')
      return false
    }
  }, [setActionError])

  const onGroupMemberAction = useCallback(async (
    action: 'nudge' | 'remove' | 'block',
    groupId: string,
    personId: string,
  ) => {
    if (personId === user?.id) { showToast('You cannot use this action on your own account.'); return false }
    let membershipChanged = false
    try {
      if (action === 'nudge') {
        const id = resultData(await sendFocusNudge(personId, { kind: 'encourage', groupId }))
        if (!id) throw new Error('The nudge could not be sent.')
        showToast('Encouragement sent.')
        return true
      }
      if (action === 'remove') {
        const saved = resultData(await removeFocusGroupMember(groupId, personId))
        if (!saved) throw new Error('The member could not be removed.')
        membershipChanged = true
        if (mountedRef.current) setSocial(current => ({
          ...current,
          groupMembers: {
            ...current.groupMembers,
            [groupId]: (current.groupMembers[groupId] ?? []).filter(member => member.userId !== personId),
          },
        }))
        showToast('Member removed from the group.')
      } else {
        const removed = resultData(await removeFocusGroupMember(groupId, personId))
        if (!removed) throw new Error('The member could not be removed before blocking.')
        membershipChanged = true
        if (mountedRef.current) setSocial(current => ({
          ...current,
          groupMembers: {
            ...current.groupMembers,
            [groupId]: (current.groupMembers[groupId] ?? []).filter(member => member.userId !== personId),
          },
        }))
        const blocked = resultData(await setFocusBlock(personId, true))
        if (!blocked) throw new Error('The member was removed, but the account could not be blocked. You can retry from Friends if the account is still visible there.')
        showToast('Member removed and account blocked.')
      }
      return true
    } catch (error) {
      setActionError(error, 'The group member action could not be completed.')
      return false
    } finally {
      if (membershipChanged) {
        // Removing a member and blocking them are two server operations. Always
        // reload after the first succeeds so a later failure cannot leave a
        // removed member visible in the room.
        await refresh()
        await loadGroup(groupId)
      }
    }
  }, [loadGroup, refresh, setActionError, showToast, user?.id])

  const onRankingScopeChange = useCallback(async (period: ScreenFocusPeriod, groupId?: string) => {
    try {
      const rows = resultData(await getFocusRanking(period, { groupId: groupId ?? null }))
      if (!mountedRef.current) return
      setSocial(current => groupId ? {
        ...current,
        groupRankings: {
          ...current.groupRankings,
          [groupId]: { ...(current.groupRankings[groupId] ?? emptyRankings()), [period]: rows },
        },
      } : {
        ...current,
        rankings: { ...current.rankings, [period]: rows },
      })
    } catch (error) {
      setActionError(error, 'The ranking could not be refreshed.')
    }
  }, [setActionError])

  const onFocusShieldAction = useCallback(async (platform: FocusPlatform) => {
    if (platform === 'web') {
      const capability = shieldCapability ?? await getFocusShieldCapability()
      setShieldCapability(capability)
      showToast(capability.detail)
      return
    }
    const capability = await configureNativeFocusShield()
    if (mountedRef.current) setShieldCapability(capability)
    showToast(capability.detail)
  }, [shieldCapability, showToast])

  const onSubjectSelectionChange = useCallback((subjectId: string, selected: boolean) => {
    const current = useFocusStore.getState().subjectTags.find(subject => subject.id === subjectId)
    if (!current) {
      showToast('This subject is no longer available.')
      return false
    }
    if ((current.archivedAt === null) === selected) return true
    const changed = selected ? restoreSubjectTag(subjectId) : archiveSubjectTag(subjectId)
    if (!changed) {
      showToast(runtime.activeTimer?.subjectTagId === subjectId
        ? 'Finish the active timer before hiding its subject.'
        : 'This subject could not be updated.')
      return false
    }
    if (selected) {
      setIdleSubjectId(subjectId)
    } else if (idleSubjectId === subjectId) {
      const next = useFocusStore.getState().subjectTags.find(subject => subject.archivedAt === null)
      setIdleSubjectId(next?.id ?? '')
    }
    return true
  }, [archiveSubjectTag, idleSubjectId, restoreSubjectTag, runtime.activeTimer?.subjectTagId, showToast])

  const onSubjectCreate = useCallback((name: string) => {
    const customCount = subjectTags.filter(subject => !BUILT_IN_SUBJECT_IDS.has(subject.id)).length
    const id = createSubjectTag(name, CUSTOM_SUBJECT_COLORS[customCount % CUSTOM_SUBJECT_COLORS.length])
    if (!id) {
      showToast('Enter a unique subject name.')
      return null
    }
    setIdleSubjectId(id)
    return id
  }, [createSubjectTag, showToast, subjectTags])

  const screenProps = useMemo<FocusExperienceScreenProps>(() => ({
    data,
    platform: shieldCapability?.platform,
    nativeFocusShieldAvailable: shieldCapability?.appBlockingAvailable ?? false,
    onTimerModeChange: mode => {
      if (runtime.activeTimer) return
      setIdleMode(mode)
      if (mode === 'stopwatch') setIdlePhase('focus')
    },
    onSubjectChange: subjectId => {
      if (!runtime.activeTimer) setIdleSubjectId(subjectId)
    },
    onSubjectSelectionChange,
    onSubjectCreate,
    onPomodoroPhaseChange: phase => {
      if (runtime.activeTimer) return
      setIdlePhase(phase)
      const next = phase === 'focus'
        ? settings.pomodoroMinutes * 60
        : phase === 'short-break' ? settings.shortBreakMinutes * 60 : settings.longBreakMinutes * 60
      setIdlePlannedSeconds(next)
    },
    onPomodoroLengthChange: planned => {
      if (!runtime.activeTimer) setIdlePlannedSeconds(planned)
    },
    onSessionStart: snapshot => {
      const at = snapshot.startedAt ?? Date.now()
      const breakKind = snapshot.phase === 'long-break'
        ? 'long-break' as const
        : snapshot.phase === 'short-break' ? 'short-break' as const : null
      const id = snapshot.mode === 'pomodoro' && breakKind
        ? runtime.startBreak({ kind: breakKind, plannedDurationMs: snapshot.plannedSeconds * SECOND_MS, at })
        : runtime.start({
            mode: snapshot.mode,
            subjectTagId: snapshot.selectedSubjectId && snapshot.selectedSubjectId !== GENERAL_SUBJECT_ID
              ? snapshot.selectedSubjectId
              : null,
            plannedDurationMs: snapshot.mode === 'pomodoro' ? snapshot.plannedSeconds * SECOND_MS : null,
            at,
          })
      if (!id) showToast('A Focus session is already active or still closing. Try again in a moment.')
    },
    onSessionPause: () => {
      if (!runtime.pause({ at: Date.now(), reason: 'manual-pause' })) showToast('This Focus session could not be paused.')
    },
    onSessionResume: () => {
      if (!runtime.resume(Date.now())) showToast('This Focus session is still closing. Try resume again in a moment.')
    },
    onSessionFinish: () => {
      if (!runtime.finish({ at: Date.now(), reason: 'manual' })) showToast('There is no active Focus session to save.')
    },
    onSearchPeople,
    onUsernameChange,
    onFriendAction,
    onOpenGroup: loadGroup,
    onCreateGroup,
    onJoinGroup,
    // Invite codes are intentionally omitted: the backend supports targeted
    // account invitations, not arbitrary codes.
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
  }), [data, loadGroup, onCreateGroup, onFocusShieldAction, onFriendAction, onGroupMemberAction, onInviteToGroup, onJoinGroup, onLeaveGroup, onPreferenceChange, onRankingScopeChange, onRespondGroupInvite, onRespondGroupJoinRequest, onSearchPeople, onSendGroupMessage, onSubjectCreate, onSubjectSelectionChange, onTimerSettingsChange, onUsernameChange, runtime, settings.longBreakMinutes, settings.pomodoroMinutes, settings.shortBreakMinutes, shieldCapability?.appBlockingAvailable, shieldCapability?.platform, showToast])

  return {
    data,
    screenProps,
    loading: social.loading,
    error: social.error,
    socialAvailability: social.availability,
    refresh,
  }
}
