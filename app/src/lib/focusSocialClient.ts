import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/authClient'
import type {
  FocusCompletionReason,
  FocusPhase,
  FocusTimerMode,
} from '@/types/focus'

export type FocusUnavailableReason = 'unconfigured' | 'guest' | 'offline'
export type FocusPeriod = 'day' | 'week' | 'month'
export type FocusContactKind = 'email' | 'phone'
export type FocusLookupKind = FocusContactKind | 'username'
export type FocusSessionStatus = 'active' | 'completed' | 'cancelled'
export type FocusPresenceStatus = 'offline' | 'available' | 'focusing' | 'break'
export type FocusPresenceVisibility = 'private' | 'friends' | 'groups'
export type FocusNudgeKind = 'focus' | 'break' | 'resume' | 'encourage'
export type FocusRelationship = 'none' | 'friend' | 'incoming' | 'outgoing'
export type FocusInviteLinkKind = 'friend' | 'group'

export interface FocusResult<T> {
  data: T
  available: boolean
  reason?: FocusUnavailableReason
}

export interface FocusProfile {
  userId: string
  username: string
  displayName: string
  avatarUrl: string
  headline: string
  timezone: string
  discoverable: boolean
  allowFriendRequests: boolean
  allowGroupInvites: boolean
  showInRankings: boolean
  createdAt: string
  updatedAt: string
}

export interface FocusProfileInput {
  displayName: string
  username?: string
  avatarUrl?: string
  headline?: string
  timezone?: string
  discoverable?: boolean
  allowFriendRequests?: boolean
  allowGroupInvites?: boolean
  showInRankings?: boolean
}

export interface FocusProfileMatch {
  userId: string
  username: string
  displayName: string
  avatarUrl: string
  headline: string
  relationship: FocusRelationship
}

export interface FocusInviteLink {
  id: string
  token: string
  kind: FocusInviteLinkKind
  groupId: string | null
  expiresAt: string
}

export interface FocusInvitePreview {
  id: string
  kind: FocusInviteLinkKind
  inviterId: string
  inviterUsername: string
  inviterDisplayName: string
  inviterAvatarUrl: string
  relationship: FocusRelationship | 'self'
  groupId: string | null
  groupName: string
  groupCategory: string
  groupPrivacy: 'public' | 'private' | ''
  groupMemberCount: number
  groupCapacity: number
  viewerIsMember: boolean
  expiresAt: string
}

export interface FocusCategory {
  id: string
  userId: string | null
  name: string
  color: string
  icon: string
  sortOrder: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface FocusCategoryInput {
  name: string
  color?: string
  icon?: string
  sortOrder?: number
}

export interface FocusSession {
  id: string
  userId: string
  clientSessionId: string
  categoryId: string | null
  label: string
  note: string
  mode: FocusTimerMode
  phase: FocusPhase
  plannedSeconds: number | null
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  pausedSeconds: number
  pauseCount: number
  interruptionCount: number
  interruptionSeconds: number
  status: FocusSessionStatus
  completionReason: FocusCompletionReason | null
  createdAt: string
  updatedAt: string
}

export interface FocusSessionInput {
  clientSessionId: string
  categoryId?: string | null
  label?: string
  note?: string
  mode: FocusTimerMode
  phase: FocusPhase
  plannedSeconds?: number | null
  startedAt?: string
}

export interface CompletedFocusSessionInput extends FocusSessionInput {
  startedAt: string
  endedAt: string
  durationSeconds: number
  pausedSeconds?: number
  pauseCount?: number
  interruptionCount?: number
  interruptionSeconds?: number
  completionReason?: Exclude<FocusCompletionReason, 'cancelled'>
}

export interface FocusSessionCompletionInput {
  endedAt?: string
  durationSeconds: number
  pausedSeconds?: number
  pauseCount?: number
  interruptionCount?: number
  interruptionSeconds?: number
  note?: string
  completionReason?: Exclude<FocusCompletionReason, 'cancelled'>
}

export interface FocusFriendRequest {
  id: string
  senderId: string
  recipientId: string
  message: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  respondedAt: string | null
  otherProfile?: FocusProfile
}

export interface FocusFriend {
  userId: string
  friendsSince: string
  profile: FocusProfile
}

export interface FocusBlock {
  userId: string
  createdAt: string
}

export interface FocusGroup {
  id: string
  ownerId: string
  name: string
  description: string
  privacy: 'public' | 'private'
  category: string
  rules: string[]
  weeklyGoalSeconds: number
  capacity: number
  joinPolicy: 'open' | 'request' | 'invite'
  memberCount: number
  liveCount: number
  isMember: boolean
  createdAt: string
  updatedAt: string
  role?: 'owner' | 'admin' | 'member'
}

export interface FocusGroupInput {
  name: string
  description?: string
  privacy?: 'public' | 'private'
  category?: string
  rules?: string[]
  weeklyGoalSeconds?: number
  capacity?: number
  joinPolicy?: 'open' | 'request' | 'invite'
}

export interface FocusGroupMember {
  groupId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  notificationsEnabled: boolean
  joinedAt: string
  profile?: FocusProfile
}

export interface FocusGroupInvite {
  id: string
  groupId: string
  inviterId: string
  inviteeId: string
  message: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'
  expiresAt: string
  createdAt: string
  respondedAt: string | null
  group?: FocusGroup
  inviter?: FocusProfile
}

export interface FocusGroupJoinRequest {
  id: string
  groupId: string
  requesterId: string
  message: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  respondedAt: string | null
  profile?: FocusProfile
}

export interface FocusGroupMessage {
  id: string
  groupId: string
  senderId: string
  body: string
  createdAt: string
  profile?: FocusProfile
}

export interface FocusNudge {
  id: string
  senderId: string
  recipientId: string
  groupId: string | null
  kind: FocusNudgeKind
  message: string
  sentAt: string
  readAt: string | null
  expiresAt: string
}

export interface FocusPresence {
  userId: string
  status: FocusPresenceStatus
  visibility: FocusPresenceVisibility
  activeSessionId: string | null
  message: string
  focusStartedAt: string | null
  lastSeenAt: string
  updatedAt: string
}

export interface FocusRankingRow {
  userId: string
  displayName: string
  avatarUrl: string
  totalSeconds: number
  sessionCount: number
  rankPosition: number
  periodStart: string
  periodEnd: string
}

interface FocusContext {
  supabase: SupabaseClient
  userId: string
}

type DbRow = Record<string, unknown>

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function unavailable<T>(data: T, reason: FocusUnavailableReason): FocusResult<T> {
  return { data, available: false, reason }
}

function ready<T>(data: T): FocusResult<T> {
  return { data, available: true }
}

function isNetworkError(error: unknown) {
  if (isOffline()) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /failed to fetch|network|offline|load failed/i.test(message)
}

function throwOnError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const message = error.message || 'Focus service request failed'
  if (error.code === 'PGRST202' || /schema cache/i.test(message) && /focus/i.test(message)) {
    throw new Error('Focus social setup is incomplete on the connected server. Apply the latest Supabase migrations, then retry.')
  }
  throw new Error(message)
}

function throwOnAccountLookupError(error: { message?: string } | null, feature = 'Friend lookup') {
  if (!error) return
  const message = error.message || ''
  if (/column reference ["']?user_id["']? is ambiguous/i.test(message)) {
    throw new Error(`${feature} is being updated on the connected server. Please try again shortly.`)
  }
  if (/schema cache|could not find the function|does not exist|undefined function/i.test(message)) {
    throw new Error(`${feature} needs the latest Focus service update. Please try again after it is connected.`)
  }
  throwOnError(error)
}

async function focusContext(): Promise<FocusContext | FocusUnavailableReason> {
  if (isOffline()) return 'offline'
  const supabase = getSupabase()
  if (!supabase) return 'unconfigured'
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    if (isNetworkError(error)) return 'offline'
    throw error
  }
  const userId = data.session?.user.id
  return userId ? { supabase, userId } : 'guest'
}

async function withFocus<T>(fallback: T, operation: (context: FocusContext) => Promise<T>): Promise<FocusResult<T>> {
  const context = await focusContext()
  if (typeof context === 'string') return unavailable(fallback, context)
  try {
    return ready(await operation(context))
  } catch (error) {
    if (isNetworkError(error)) return unavailable(fallback, 'offline')
    throw error
  }
}

function text(row: DbRow, key: string) {
  return typeof row[key] === 'string' ? row[key] as string : ''
}

function nullableText(row: DbRow, key: string) {
  return typeof row[key] === 'string' ? row[key] as string : null
}

function numberValue(row: DbRow, key: string) {
  const value = Number(row[key] ?? 0)
  return Number.isFinite(value) ? value : 0
}

function profileFromRow(value: unknown): FocusProfile {
  const row = value as DbRow
  return {
    userId: text(row, 'user_id'),
    username: text(row, 'username'),
    displayName: text(row, 'display_name'),
    avatarUrl: text(row, 'avatar_url'),
    headline: text(row, 'headline'),
    timezone: text(row, 'timezone') || 'Asia/Kolkata',
    discoverable: row.discoverable === true,
    allowFriendRequests: row.allow_friend_requests !== false,
    allowGroupInvites: row.allow_group_invites !== false,
    showInRankings: row.show_in_rankings !== false,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }
}

function categoryFromRow(value: unknown): FocusCategory {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    userId: nullableText(row, 'user_id'),
    name: text(row, 'name'),
    color: text(row, 'color'),
    icon: text(row, 'icon'),
    sortOrder: numberValue(row, 'sort_order'),
    isArchived: row.is_archived === true,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }
}

function sessionFromRow(value: unknown): FocusSession {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    userId: text(row, 'user_id'),
    clientSessionId: text(row, 'client_session_id'),
    categoryId: nullableText(row, 'category_id'),
    label: text(row, 'label'),
    note: text(row, 'note'),
    mode: text(row, 'mode') as FocusTimerMode,
    phase: text(row, 'phase') as FocusPhase,
    plannedSeconds: row.planned_seconds === null || row.planned_seconds === undefined
      ? null
      : numberValue(row, 'planned_seconds'),
    startedAt: text(row, 'started_at'),
    endedAt: nullableText(row, 'ended_at'),
    durationSeconds: numberValue(row, 'duration_seconds'),
    pausedSeconds: numberValue(row, 'paused_seconds'),
    pauseCount: numberValue(row, 'pause_count'),
    interruptionCount: numberValue(row, 'interruption_count'),
    interruptionSeconds: numberValue(row, 'interruption_seconds'),
    status: text(row, 'status') as FocusSessionStatus,
    completionReason: nullableText(row, 'completion_reason') as FocusCompletionReason | null,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }
}

function friendRequestFromRow(value: unknown): FocusFriendRequest {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    senderId: text(row, 'sender_id'),
    recipientId: text(row, 'recipient_id'),
    message: text(row, 'message'),
    status: text(row, 'status') as FocusFriendRequest['status'],
    createdAt: text(row, 'created_at'),
    respondedAt: nullableText(row, 'responded_at'),
  }
}

function groupFromRow(value: unknown): FocusGroup {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    ownerId: text(row, 'owner_id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    privacy: text(row, 'privacy') as FocusGroup['privacy'],
    category: text(row, 'category'),
    rules: Array.isArray(row.rules) ? row.rules.filter(value => typeof value === 'string') as string[] : [],
    weeklyGoalSeconds: numberValue(row, 'weekly_goal_seconds'),
    capacity: numberValue(row, 'capacity'),
    joinPolicy: text(row, 'join_policy') as FocusGroup['joinPolicy'],
    memberCount: numberValue(row, 'member_count'),
    liveCount: numberValue(row, 'live_count'),
    isMember: row.is_member === true,
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
    role: nullableText(row, 'caller_role') as FocusGroup['role'],
  }
}

function groupMemberFromRow(value: unknown): FocusGroupMember {
  const row = value as DbRow
  return {
    groupId: text(row, 'group_id'),
    userId: text(row, 'user_id'),
    role: text(row, 'role') as FocusGroupMember['role'],
    notificationsEnabled: row.notifications_enabled !== false,
    joinedAt: text(row, 'joined_at'),
  }
}

function groupInviteFromRow(value: unknown): FocusGroupInvite {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    groupId: text(row, 'group_id'),
    inviterId: text(row, 'inviter_id'),
    inviteeId: text(row, 'invitee_id'),
    message: text(row, 'message'),
    status: text(row, 'status') as FocusGroupInvite['status'],
    expiresAt: text(row, 'expires_at'),
    createdAt: text(row, 'created_at'),
    respondedAt: nullableText(row, 'responded_at'),
  }
}

function groupJoinRequestFromRow(value: unknown): FocusGroupJoinRequest {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    groupId: text(row, 'group_id'),
    requesterId: text(row, 'requester_id'),
    message: text(row, 'message'),
    status: text(row, 'status') as FocusGroupJoinRequest['status'],
    createdAt: text(row, 'created_at'),
    respondedAt: nullableText(row, 'responded_at'),
  }
}

function groupMessageFromRow(value: unknown): FocusGroupMessage {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    groupId: text(row, 'group_id'),
    senderId: text(row, 'sender_id'),
    body: text(row, 'body'),
    createdAt: text(row, 'created_at'),
  }
}

function nudgeFromRow(value: unknown): FocusNudge {
  const row = value as DbRow
  return {
    id: text(row, 'id'),
    senderId: text(row, 'sender_id'),
    recipientId: text(row, 'recipient_id'),
    groupId: nullableText(row, 'group_id'),
    kind: text(row, 'kind') as FocusNudgeKind,
    message: text(row, 'message'),
    sentAt: text(row, 'sent_at'),
    readAt: nullableText(row, 'read_at'),
    expiresAt: text(row, 'expires_at'),
  }
}

function presenceFromRow(value: unknown): FocusPresence {
  const row = value as DbRow
  return {
    userId: text(row, 'user_id'),
    status: text(row, 'status') as FocusPresenceStatus,
    visibility: text(row, 'visibility') as FocusPresenceVisibility,
    activeSessionId: nullableText(row, 'active_session_id'),
    message: text(row, 'message'),
    focusStartedAt: nullableText(row, 'focus_started_at'),
    lastSeenAt: text(row, 'last_seen_at'),
    updatedAt: text(row, 'updated_at'),
  }
}

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  } catch {
    return 'Asia/Kolkata'
  }
}

/** Normalisation must stay byte-for-byte compatible with migration 0006. */
export function normalizeFocusContact(kind: FocusContactKind, value: string) {
  if (kind === 'email') {
    const normalized = value.trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) throw new Error('Enter a valid email address')
    return normalized
  }
  let digits = value.replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length < 8 || digits.length > 15) throw new Error('Enter a valid phone number')
  return digits
}

/** Canonical public handle shared by settings and exact-match discovery. */
export function normalizeFocusUsername(value: string) {
  let normalized = value.trim().toLowerCase()
  if (normalized.startsWith('@')) normalized = normalized.slice(1)
  if (
    normalized.length < 3
    || normalized.length > 24
    || !/^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(normalized)
    || /[._]{2}/.test(normalized)
  ) {
    throw new Error('Use 3-24 lowercase letters, numbers, dots or underscores; separators cannot touch or appear at either end.')
  }
  if (/^(admin|administrator|support|penni|official|moderator|system)/.test(normalized)) {
    throw new Error('That username is reserved. Please choose another.')
  }
  return normalized
}

/** The raw contact never leaves the device; only this namespaced hash reaches the RPC. */
export async function hashFocusContact(kind: FocusContactKind, value: string) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Secure contact lookup is unavailable on this device')
  const bytes = new TextEncoder().encode(`${kind}:${normalizeFocusContact(kind, value)}`)
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function getFocusSocialAvailability(): Promise<FocusUnavailableReason | 'ready'> {
  const context = await focusContext()
  return typeof context === 'string' ? context : 'ready'
}

export function getMyFocusProfile() {
  return withFocus<FocusProfile | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_profiles').select('*').eq('user_id', userId).maybeSingle()
    throwOnError(error)
    return data ? profileFromRow(data) : null
  })
}

export function upsertFocusProfile(input: FocusProfileInput) {
  return withFocus<FocusProfile | null>(null, async ({ supabase, userId }) => {
    // Only send fields the caller intentionally supplied. PostgreSQL defaults
    // handle first-time inserts; omitted fields must retain existing privacy
    // choices on subsequent upserts.
    const row: DbRow = {
      user_id: userId,
      display_name: input.displayName.trim(),
    }
    if (input.username !== undefined) row.username = normalizeFocusUsername(input.username)
    if (input.avatarUrl !== undefined) row.avatar_url = input.avatarUrl
    if (input.headline !== undefined) row.headline = input.headline
    if (input.timezone !== undefined) row.timezone = input.timezone
    if (input.discoverable !== undefined) row.discoverable = input.discoverable
    if (input.allowFriendRequests !== undefined) row.allow_friend_requests = input.allowFriendRequests
    if (input.allowGroupInvites !== undefined) row.allow_group_invites = input.allowGroupInvites
    if (input.showInRankings !== undefined) row.show_in_rankings = input.showInRankings
    const { data, error } = await supabase.from('focus_profiles').upsert(row).select('*').single()
    throwOnError(error)
    const { error: hashError } = await supabase.rpc('sync_my_focus_contact_hashes')
    throwOnError(hashError)
    return profileFromRow(data)
  })
}

export function syncMyFocusContactHashes() {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('sync_my_focus_contact_hashes')
    throwOnError(error)
    return true
  })
}

export function setMyFocusUsername(username: string) {
  return withFocus('', async ({ supabase }) => {
    const canonical = normalizeFocusUsername(username)
    const { data, error } = await supabase.rpc('set_my_focus_username', { p_username: canonical })
    throwOnAccountLookupError(error, 'Username setup')
    return typeof data === 'string' ? data : canonical
  })
}

/**
 * Checks a handle without claiming it. `available: false` on the returned
 * FocusResult means the service itself is unavailable; `data: false` with an
 * available service means another user already owns the handle.
 */
export function isFocusUsernameAvailable(username: string) {
  return withFocus(false, async ({ supabase }) => {
    const canonical = normalizeFocusUsername(username)
    const { data, error } = await supabase.rpc('is_focus_username_available', {
      p_username: canonical,
    })
    throwOnAccountLookupError(error, 'Username availability')
    return data === true
  })
}

export async function findFocusProfile(kind: FocusLookupKind, value: string) {
  if (kind === 'username') return findFocusProfileByUsername(value)
  const contactHash = await hashFocusContact(kind, value)
  return findFocusProfileByHash(kind, contactHash)
}

export function findFocusProfileByUsername(username: string) {
  return withFocus<FocusProfileMatch | null>(null, async ({ supabase }) => {
    const canonical = normalizeFocusUsername(username)
    const { data, error } = await supabase.rpc('find_focus_profile_by_username', {
      p_username: canonical,
    })
    throwOnAccountLookupError(error)
    const row = Array.isArray(data) ? data[0] as DbRow | undefined : undefined
    if (!row) return null
    return {
      userId: text(row, 'user_id'),
      username: text(row, 'username'),
      displayName: text(row, 'display_name'),
      avatarUrl: text(row, 'avatar_url'),
      headline: text(row, 'headline'),
      relationship: text(row, 'relationship') as FocusRelationship,
    }
  })
}

export function findFocusProfileByHash(kind: FocusContactKind, contactHash: string) {
  return withFocus<FocusProfileMatch | null>(null, async ({ supabase }) => {
    if (!/^[0-9a-f]{64}$/.test(contactHash)) throw new Error('Invalid contact hash')
    const { data, error } = await supabase.rpc('find_focus_profile_by_hash', {
      p_contact_kind: kind,
      p_contact_hash: contactHash,
    })
    throwOnAccountLookupError(error)
    const row = Array.isArray(data) ? data[0] as DbRow | undefined : undefined
    if (!row) return null
    return {
      userId: text(row, 'user_id'),
      username: text(row, 'username'),
      displayName: text(row, 'display_name'),
      avatarUrl: text(row, 'avatar_url'),
      headline: text(row, 'headline'),
      relationship: text(row, 'relationship') as FocusRelationship,
    }
  })
}

export function listFocusCategories(includeArchived = false) {
  return withFocus<FocusCategory[]>([], async ({ supabase }) => {
    let query = supabase.from('focus_categories').select('*').order('sort_order').order('name')
    if (!includeArchived) query = query.eq('is_archived', false)
    const { data, error } = await query
    throwOnError(error)
    return (data ?? []).map(categoryFromRow)
  })
}

export function createFocusCategory(input: FocusCategoryInput) {
  return withFocus<FocusCategory | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_categories').insert({
      user_id: userId,
      name: input.name.trim(),
      color: input.color ?? '#7C8CFF',
      icon: input.icon ?? 'clock',
      sort_order: input.sortOrder ?? 100,
    }).select('*').single()
    throwOnError(error)
    return categoryFromRow(data)
  })
}

export function updateFocusCategory(categoryId: string, patch: Partial<FocusCategoryInput> & { isArchived?: boolean }) {
  return withFocus<FocusCategory | null>(null, async ({ supabase }) => {
    const changes: DbRow = {}
    if (patch.name !== undefined) changes.name = patch.name.trim()
    if (patch.color !== undefined) changes.color = patch.color
    if (patch.icon !== undefined) changes.icon = patch.icon
    if (patch.sortOrder !== undefined) changes.sort_order = patch.sortOrder
    if (patch.isArchived !== undefined) changes.is_archived = patch.isArchived
    const { data, error } = await supabase.from('focus_categories').update(changes).eq('id', categoryId).select('*').single()
    throwOnError(error)
    return categoryFromRow(data)
  })
}

export function startFocusSession(input: FocusSessionInput) {
  return withFocus<FocusSession | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_sessions').insert({
      user_id: userId,
      client_session_id: input.clientSessionId,
      category_id: input.categoryId ?? null,
      label: (input.label ?? '').trim().slice(0, 120),
      note: (input.note ?? '').trim().slice(0, 500),
      mode: input.mode,
      phase: input.phase,
      planned_seconds: input.plannedSeconds ?? null,
      started_at: input.startedAt ?? new Date().toISOString(),
      status: 'active',
    }).select('*').single()
    throwOnError(error)
    return sessionFromRow(data)
  })
}

export function completeFocusSession(sessionId: string, input: FocusSessionCompletionInput) {
  return withFocus<FocusSession | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.from('focus_sessions').update({
      status: 'completed',
      ended_at: input.endedAt ?? new Date().toISOString(),
      duration_seconds: Math.round(input.durationSeconds),
      paused_seconds: Math.round(input.pausedSeconds ?? 0),
      pause_count: Math.round(input.pauseCount ?? 0),
      interruption_count: Math.round(input.interruptionCount ?? 0),
      interruption_seconds: Math.round(input.interruptionSeconds ?? 0),
      note: (input.note ?? '').trim().slice(0, 500),
      completion_reason: input.completionReason ?? 'manual',
    }).eq('id', sessionId).eq('status', 'active').select('*').single()
    throwOnError(error)
    return sessionFromRow(data)
  })
}

/** Idempotently uploads a completed local timer using its stable client ID. */
export function syncCompletedFocusSession(input: CompletedFocusSessionInput) {
  return withFocus<FocusSession | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_sessions').upsert({
      user_id: userId,
      client_session_id: input.clientSessionId,
      category_id: input.categoryId ?? null,
      label: (input.label ?? '').trim().slice(0, 120),
      note: (input.note ?? '').trim().slice(0, 500),
      mode: input.mode,
      phase: input.phase,
      planned_seconds: input.plannedSeconds ?? null,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      duration_seconds: Math.round(input.durationSeconds),
      paused_seconds: Math.round(input.pausedSeconds ?? 0),
      pause_count: Math.round(input.pauseCount ?? 0),
      interruption_count: Math.round(input.interruptionCount ?? 0),
      interruption_seconds: Math.round(input.interruptionSeconds ?? 0),
      completion_reason: input.completionReason ?? 'manual',
      status: 'completed',
    }, { onConflict: 'user_id,client_session_id' }).select('*').single()
    throwOnError(error)
    return sessionFromRow(data)
  })
}

export function cancelFocusSession(sessionId: string) {
  return withFocus<FocusSession | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.from('focus_sessions').update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('status', 'active').select('*').single()
    throwOnError(error)
    return sessionFromRow(data)
  })
}

export function getActiveFocusSession() {
  return withFocus<FocusSession | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_sessions').select('*')
      .eq('user_id', userId).eq('status', 'active').maybeSingle()
    throwOnError(error)
    return data ? sessionFromRow(data) : null
  })
}

export function listFocusSessions(options: { from?: string; to?: string; limit?: number } = {}) {
  return withFocus<FocusSession[]>([], async ({ supabase, userId }) => {
    let query = supabase.from('focus_sessions').select('*').eq('user_id', userId)
      .order('started_at', { ascending: false }).limit(Math.min(Math.max(options.limit ?? 100, 1), 500))
    if (options.from) query = query.gte('started_at', options.from)
    if (options.to) query = query.lt('started_at', options.to)
    const { data, error } = await query
    throwOnError(error)
    return (data ?? []).map(sessionFromRow)
  })
}

export function sendFocusFriendRequest(recipientId: string, message = '') {
  return withFocus<string | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('send_focus_friend_request', {
      p_recipient_id: recipientId,
      p_message: message,
    })
    throwOnError(error)
    return typeof data === 'string' ? data : null
  })
}

export function respondFocusFriendRequest(requestId: string, accept: boolean) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('respond_focus_friend_request', {
      p_request_id: requestId,
      p_accept: accept,
    })
    throwOnError(error)
    return true
  })
}

export function cancelFocusFriendRequest(requestId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('cancel_focus_friend_request', { p_request_id: requestId })
    throwOnError(error)
    return true
  })
}

export function listFocusFriendRequests(status: FocusFriendRequest['status'] = 'pending') {
  return withFocus<FocusFriendRequest[]>([], async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_friend_requests').select('*')
      .eq('status', status).order('created_at', { ascending: false })
    throwOnError(error)
    const requests = (data ?? []).map(friendRequestFromRow)
    const ids = [...new Set(requests.map(request => request.senderId === userId ? request.recipientId : request.senderId))]
    if (!ids.length) return requests
    const { data: profiles, error: profileError } = await supabase.from('focus_profiles').select('*').in('user_id', ids)
    throwOnError(profileError)
    const byId = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return requests.map(request => ({
      ...request,
      otherProfile: byId.get(request.senderId === userId ? request.recipientId : request.senderId),
    }))
  })
}

export function listFocusFriends() {
  return withFocus<FocusFriend[]>([], async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_friendships').select('*').order('created_at', { ascending: false })
    throwOnError(error)
    const rows = (data ?? []) as DbRow[]
    const friendIds = rows.map(row => text(row, 'user_low') === userId ? text(row, 'user_high') : text(row, 'user_low'))
    if (!friendIds.length) return []
    const { data: profiles, error: profileError } = await supabase.from('focus_profiles').select('*').in('user_id', friendIds)
    throwOnError(profileError)
    const byId = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return rows.flatMap(row => {
      const friendId = text(row, 'user_low') === userId ? text(row, 'user_high') : text(row, 'user_low')
      const profile = byId.get(friendId)
      return profile ? [{ userId: friendId, friendsSince: text(row, 'created_at'), profile }] : []
    })
  })
}

export function removeFocusFriend(userId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('remove_focus_friend', { p_user_id: userId })
    throwOnError(error)
    return true
  })
}

export function setFocusBlock(userId: string, blocked = true) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('set_focus_block', { p_user_id: userId, p_blocked: blocked })
    throwOnError(error)
    return true
  })
}

export function listFocusBlocks() {
  return withFocus<FocusBlock[]>([], async ({ supabase }) => {
    const { data, error } = await supabase.from('focus_blocks').select('blocked_id,created_at').order('created_at', { ascending: false })
    throwOnError(error)
    return ((data ?? []) as DbRow[]).map(row => ({ userId: text(row, 'blocked_id'), createdAt: text(row, 'created_at') }))
  })
}

export function createFocusGroup(input: FocusGroupInput) {
  return withFocus<string | null>(null, async ({ supabase }) => {
    const privacy = input.privacy ?? 'private'
    const { data, error } = await supabase.rpc('create_focus_group', {
      p_name: input.name,
      p_description: input.description ?? '',
      p_privacy: privacy,
      p_category: input.category ?? 'General UPSC',
      p_rules: input.rules ?? [],
      p_weekly_goal_seconds: input.weeklyGoalSeconds ?? 126000,
      p_capacity: input.capacity ?? 50,
      p_join_policy: input.joinPolicy ?? (privacy === 'public' ? 'request' : 'invite'),
    })
    throwOnError(error)
    return typeof data === 'string' ? data : null
  })
}

export function listDiscoverableFocusGroups(options: { category?: string; limit?: number } = {}) {
  return withFocus<FocusGroup[]>([], async ({ supabase }) => {
    const { data, error } = await supabase.rpc('list_focus_groups', {
      p_scope: 'discover',
      p_category: options.category ?? null,
      p_limit: Math.min(Math.max(options.limit ?? 50, 1), 100),
    })
    throwOnError(error)
    return (data ?? []).map(groupFromRow)
  })
}

export function listFocusGroups() {
  return withFocus<FocusGroup[]>([], async ({ supabase }) => {
    const { data, error } = await supabase.rpc('list_focus_groups', {
      p_scope: 'mine',
      p_category: null,
      p_limit: 100,
    })
    throwOnError(error)
    return (data ?? []).map(groupFromRow)
  })
}

export function updateFocusGroup(groupId: string, patch: Partial<Omit<FocusGroupInput, 'name'>> & { name?: string }) {
  return withFocus<FocusGroup | null>(null, async ({ supabase }) => {
    const changes: DbRow = {}
    if (patch.name !== undefined) changes.name = patch.name.trim()
    if (patch.description !== undefined) changes.description = patch.description
    if (patch.privacy !== undefined) changes.privacy = patch.privacy
    if (patch.category !== undefined) changes.category = patch.category.trim()
    if (patch.rules !== undefined) changes.rules = patch.rules
    if (patch.weeklyGoalSeconds !== undefined) changes.weekly_goal_seconds = patch.weeklyGoalSeconds
    if (patch.capacity !== undefined) changes.capacity = patch.capacity
    if (patch.joinPolicy !== undefined) changes.join_policy = patch.joinPolicy
    const { data, error } = await supabase.from('focus_groups').update(changes).eq('id', groupId).select('*').single()
    throwOnError(error)
    return groupFromRow(data)
  })
}

export function deleteFocusGroup(groupId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.from('focus_groups').delete().eq('id', groupId)
    throwOnError(error)
    return true
  })
}

export function listFocusGroupMembers(groupId: string) {
  return withFocus<FocusGroupMember[]>([], async ({ supabase }) => {
    const { data, error } = await supabase.from('focus_group_members').select('*')
      .eq('group_id', groupId).order('joined_at')
    throwOnError(error)
    const members = (data ?? []).map(groupMemberFromRow)
    if (!members.length) return []
    const { data: profiles, error: profileError } = await supabase.from('focus_profiles').select('*')
      .in('user_id', members.map(member => member.userId))
    throwOnError(profileError)
    const byId = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return members.map(member => ({ ...member, profile: byId.get(member.userId) }))
  })
}

export function inviteFocusGroup(groupId: string, inviteeId: string, message = '') {
  return withFocus<string | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('invite_focus_group', {
      p_group_id: groupId,
      p_invitee_id: inviteeId,
      p_message: message,
    })
    throwOnError(error)
    return typeof data === 'string' ? data : null
  })
}

/** Invites by exact contact without revealing whether or which profile matched. */
export async function inviteFocusGroupByContact(
  groupId: string,
  kind: FocusContactKind,
  contact: string,
  message = '',
) {
  const contactHash = await hashFocusContact(kind, contact)
  return inviteFocusGroupByHash(groupId, kind, contactHash, message)
}

export function inviteFocusGroupByHash(
  groupId: string,
  kind: FocusContactKind,
  contactHash: string,
  message = '',
) {
  return withFocus<string | null>(null, async ({ supabase }) => {
    if (!/^[0-9a-f]{64}$/.test(contactHash)) throw new Error('Invalid contact hash')
    const { data, error } = await supabase.rpc('invite_focus_group_by_hash', {
      p_group_id: groupId,
      p_contact_kind: kind,
      p_contact_hash: contactHash,
      p_message: message,
    })
    throwOnError(error)
    return typeof data === 'string' ? data : null
  })
}

export function createFocusInviteLink(kind: FocusInviteLinkKind, groupId?: string | null) {
  return withFocus<FocusInviteLink | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('create_focus_invite_link', {
      p_kind: kind,
      p_group_id: kind === 'group' ? groupId ?? null : null,
      p_expires_hours: 168,
    })
    throwOnAccountLookupError(error, 'QR invitations')
    const row = Array.isArray(data) ? data[0] as DbRow | undefined : undefined
    if (!row) return null
    return {
      id: text(row, 'invite_id'),
      token: text(row, 'invite_token'),
      kind: text(row, 'invite_kind') as FocusInviteLinkKind,
      groupId: nullableText(row, 'invite_group_id'),
      expiresAt: text(row, 'invite_expires_at'),
    }
  })
}

export function resolveFocusInviteLink(token: string) {
  return withFocus<FocusInvitePreview | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('resolve_focus_invite_link', { p_token: token.trim() })
    throwOnAccountLookupError(error, 'QR invitations')
    const row = Array.isArray(data) ? data[0] as DbRow | undefined : undefined
    if (!row) return null
    return {
      id: text(row, 'invite_id'),
      kind: text(row, 'invite_kind') as FocusInviteLinkKind,
      inviterId: text(row, 'inviter_id'),
      inviterUsername: text(row, 'inviter_username'),
      inviterDisplayName: text(row, 'inviter_display_name'),
      inviterAvatarUrl: text(row, 'inviter_avatar_url'),
      relationship: text(row, 'relationship') as FocusInvitePreview['relationship'],
      groupId: nullableText(row, 'invite_group_id'),
      groupName: text(row, 'group_name'),
      groupCategory: text(row, 'group_category'),
      groupPrivacy: text(row, 'group_privacy') as FocusInvitePreview['groupPrivacy'],
      groupMemberCount: numberValue(row, 'group_member_count'),
      groupCapacity: numberValue(row, 'group_capacity'),
      viewerIsMember: row.viewer_is_member === true,
      expiresAt: text(row, 'invite_expires_at'),
    }
  })
}

export function acceptFocusInviteLink(token: string) {
  return withFocus<string | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('accept_focus_invite_link', { p_token: token.trim() })
    throwOnAccountLookupError(error, 'QR invitations')
    return typeof data === 'string' ? data : null
  })
}

export function revokeFocusInviteLink(inviteId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('revoke_focus_invite_link', { p_invite_id: inviteId })
    throwOnAccountLookupError(error, 'QR invitations')
    return data === true
  })
}

export function listFocusGroupInvites() {
  return withFocus<FocusGroupInvite[]>([], async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_group_invites').select('*')
      // Admins can read invitations they sent, so explicitly constrain this
      // recipient inbox instead of relying on RLS to imply direction.
      .eq('invitee_id', userId).eq('status', 'pending').gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    throwOnError(error)
    const invites = (data ?? []).map(groupInviteFromRow)
    if (!invites.length) return []
    const { data: groups, error: groupError } = await supabase.from('focus_groups').select('*')
      .in('id', [...new Set(invites.map(invite => invite.groupId))])
    throwOnError(groupError)
    const byId = new Map((groups ?? []).map(row => {
      const group = groupFromRow(row)
      return [group.id, group] as const
    }))
    const inviterIds = [...new Set(invites.map(invite => invite.inviterId))]
    const { data: profiles, error: profileError } = inviterIds.length
      ? await supabase.from('focus_profiles').select('*').in('user_id', inviterIds)
      : { data: [], error: null }
    throwOnError(profileError)
    const profilesById = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return invites.map(invite => ({
      ...invite,
      group: byId.get(invite.groupId),
      inviter: profilesById.get(invite.inviterId),
    }))
  })
}

export function joinOrRequestFocusGroup(groupId: string, message = '') {
  return withFocus<'member' | 'joined' | 'pending' | 'requested' | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('request_or_join_focus_group', {
      p_group_id: groupId,
      p_message: message,
    })
    throwOnError(error)
    return ['member', 'joined', 'pending', 'requested'].includes(String(data))
      ? data as 'member' | 'joined' | 'pending' | 'requested'
      : null
  })
}

export function listFocusGroupJoinRequests(groupId?: string) {
  return withFocus<FocusGroupJoinRequest[]>([], async ({ supabase }) => {
    let query = supabase.from('focus_group_join_requests').select('*')
      .eq('status', 'pending').order('created_at', { ascending: false })
    if (groupId) query = query.eq('group_id', groupId)
    const { data, error } = await query
    throwOnError(error)
    const requests = (data ?? []).map(groupJoinRequestFromRow)
    if (!requests.length) return []
    const { data: profiles, error: profileError } = await supabase.from('focus_profiles').select('*')
      .in('user_id', [...new Set(requests.map(request => request.requesterId))])
    throwOnError(profileError)
    const byId = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return requests.map(request => ({ ...request, profile: byId.get(request.requesterId) }))
  })
}

export function respondFocusGroupJoinRequest(requestId: string, accept: boolean) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('respond_focus_group_join_request', {
      p_request_id: requestId,
      p_accept: accept,
    })
    throwOnError(error)
    return true
  })
}

export function cancelFocusGroupJoinRequest(requestId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('cancel_focus_group_join_request', { p_request_id: requestId })
    throwOnError(error)
    return true
  })
}

export function respondFocusGroupInvite(inviteId: string, accept: boolean) {
  return withFocus(false, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('respond_focus_group_invite', { p_invite_id: inviteId, p_accept: accept })
    throwOnError(error)
    if (data === 'expired') throw new Error('This group invitation has expired.')
    return true
  })
}

export function leaveFocusGroup(groupId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('leave_focus_group', { p_group_id: groupId })
    throwOnError(error)
    return true
  })
}

export function removeFocusGroupMember(groupId: string, userId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.rpc('remove_focus_group_member', { p_group_id: groupId, p_user_id: userId })
    throwOnError(error)
    return true
  })
}

export function listFocusGroupMessages(groupId: string, options: { before?: string; limit?: number } = {}) {
  return withFocus<FocusGroupMessage[]>([], async ({ supabase }) => {
    let query = supabase.from('focus_group_messages').select('*').eq('group_id', groupId)
      .order('created_at', { ascending: false }).limit(Math.min(Math.max(options.limit ?? 50, 1), 100))
    if (options.before) query = query.lt('created_at', options.before)
    const { data, error } = await query
    throwOnError(error)
    const messages = (data ?? []).map(groupMessageFromRow)
    if (!messages.length) return []
    const { data: profiles, error: profileError } = await supabase.from('focus_profiles').select('*')
      .in('user_id', [...new Set(messages.map(message => message.senderId))])
    throwOnError(profileError)
    const byId = new Map((profiles ?? []).map(row => {
      const profile = profileFromRow(row)
      return [profile.userId, profile] as const
    }))
    return messages.map(message => ({ ...message, profile: byId.get(message.senderId) })).reverse()
  })
}

export function sendFocusGroupMessage(groupId: string, body: string) {
  return withFocus<FocusGroupMessage | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_group_messages').insert({
      group_id: groupId,
      sender_id: userId,
      body: body.trim(),
    }).select('*').single()
    throwOnError(error)
    return groupMessageFromRow(data)
  })
}

export function deleteFocusGroupMessage(messageId: string) {
  return withFocus(false, async ({ supabase }) => {
    const { error } = await supabase.from('focus_group_messages').delete().eq('id', messageId)
    throwOnError(error)
    return true
  })
}

/** Realtime chat subscription; RLS emits rows only to current group members. */
export async function subscribeToFocusGroupMessages(
  groupId: string,
  onMessage: (message: FocusGroupMessage) => void,
): Promise<() => void> {
  const context = await focusContext()
  if (typeof context === 'string') return () => undefined
  const channel = context.supabase
    .channel(`focus-group-chat-${groupId}-${context.userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'focus_group_messages',
      filter: `group_id=eq.${groupId}`,
    }, payload => onMessage(groupMessageFromRow(payload.new)))
    .subscribe()
  return () => { void context.supabase.removeChannel(channel) }
}

export function sendFocusNudge(recipientId: string, options: { kind?: FocusNudgeKind; message?: string; groupId?: string | null } = {}) {
  return withFocus<string | null>(null, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('send_focus_nudge', {
      p_recipient_id: recipientId,
      p_kind: options.kind ?? 'focus',
      p_message: options.message ?? '',
      p_group_id: options.groupId ?? null,
    })
    throwOnError(error)
    return typeof data === 'string' ? data : null
  })
}

export function listFocusNudges(options: { unreadOnly?: boolean; limit?: number } = {}) {
  return withFocus<FocusNudge[]>([], async ({ supabase, userId }) => {
    let query = supabase.from('focus_nudges').select('*').eq('recipient_id', userId)
      .gt('expires_at', new Date().toISOString()).order('sent_at', { ascending: false })
      .limit(Math.min(Math.max(options.limit ?? 50, 1), 100))
    if (options.unreadOnly) query = query.is('read_at', null)
    const { data, error } = await query
    throwOnError(error)
    return (data ?? []).map(nudgeFromRow)
  })
}

export function markFocusNudgesRead(nudgeId?: string) {
  return withFocus(0, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('mark_focus_nudges_read', { p_nudge_id: nudgeId ?? null })
    throwOnError(error)
    return Number(data ?? 0)
  })
}

export function setFocusPresence(input: {
  status: FocusPresenceStatus
  visibility?: FocusPresenceVisibility
  activeSessionId?: string | null
  message?: string
  focusStartedAt?: string | null
}) {
  return withFocus<FocusPresence | null>(null, async ({ supabase, userId }) => {
    const { data, error } = await supabase.from('focus_presence').upsert({
      user_id: userId,
      status: input.status,
      visibility: input.visibility ?? 'friends',
      active_session_id: input.activeSessionId ?? null,
      message: (input.message ?? '').slice(0, 80),
      focus_started_at: input.focusStartedAt ?? (input.status === 'focusing' ? new Date().toISOString() : null),
      last_seen_at: new Date().toISOString(),
    }).select('*').single()
    throwOnError(error)
    return presenceFromRow(data)
  })
}

export function listFocusPresence() {
  return withFocus<FocusPresence[]>([], async ({ supabase }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('focus_presence').select('*')
      .gte('last_seen_at', since).order('last_seen_at', { ascending: false })
    throwOnError(error)
    return (data ?? []).map(presenceFromRow)
  })
}

export function getFocusRanking(period: FocusPeriod, options: { timezone?: string; groupId?: string | null } = {}) {
  return withFocus<FocusRankingRow[]>([], async ({ supabase }) => {
    const { data, error } = await supabase.rpc('focus_ranking', {
      p_period: period,
      p_timezone: options.timezone ?? getDeviceTimeZone(),
      p_group_id: options.groupId ?? null,
    })
    throwOnError(error)
    return ((data ?? []) as DbRow[]).map(row => ({
      userId: text(row, 'user_id'),
      displayName: text(row, 'display_name'),
      avatarUrl: text(row, 'avatar_url'),
      totalSeconds: numberValue(row, 'total_seconds'),
      sessionCount: numberValue(row, 'session_count'),
      rankPosition: numberValue(row, 'rank_position'),
      periodStart: text(row, 'period_start'),
      periodEnd: text(row, 'period_end'),
    }))
  })
}

/** Returns a no-op unsubscribe for guests, offline devices and local previews. */
export async function subscribeToFocusPresence(onChange: (presence: FocusPresence) => void): Promise<() => void> {
  const context = await focusContext()
  if (typeof context === 'string') return () => undefined
  const channel = context.supabase
    .channel(`focus-presence-${context.userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'focus_presence' }, payload => {
      const row = payload.new as DbRow
      if (row && row.user_id) onChange(presenceFromRow(row))
    })
    .subscribe()
  return () => { void context.supabase.removeChannel(channel) }
}
