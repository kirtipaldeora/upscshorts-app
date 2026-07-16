import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faBan, faBullseye, faCheck, faCircleNotch, faCommentDots, faCrown, faGlobe, faLock,
  faPaperPlane, faPlus, faTrash, faTrophy, faUserPlus, faUsers, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type {
  FocusGroup,
  FocusGroupDraft,
  FocusGroupInviteNotice,
  FocusGroupJoinRequestNotice,
  FocusGroupMessage,
  FocusInviteShare,
  FocusPerson,
  FocusProfile,
  FocusRankingEntry,
} from './focusTypes'
import { compactFocusTime, FocusAvatar, FocusProgress, FocusSectionHeading } from './FocusPrimitives'
import { FocusInviteSheet } from './FocusInviteSheet'
import { FocusLivePeopleGrid, FocusPersonDetails } from './FocusPersonDetails'

type GroupTab = 'room' | 'members' | 'rank' | 'chat'
type GroupSheet =
  | { kind: 'create'; restoreFocusTo: HTMLElement }
  | { kind: 'join'; restoreFocusTo: HTMLElement }
  | { kind: 'invite'; groupId: string; restoreFocusTo: HTMLElement }

interface FocusGroupsProps {
  profile: FocusProfile
  groups: FocusGroup[]
  groupInvites: FocusGroupInviteNotice[]
  groupJoinRequests: FocusGroupJoinRequestNotice[]
  people: FocusPerson[]
  messages: FocusGroupMessage[]
  rankings: FocusRankingEntry[]
  onOpenGroup: (groupId: string) => void | Promise<void>
  onCreateGroup: (draft: FocusGroupDraft) => string | null | Promise<string | null>
  onJoinGroup: (groupId: string) => void
  onJoinGroupByCode?: (code: string) => void
  onLeaveGroup: (groupId: string) => boolean | Promise<boolean>
  onCreateInviteLink?: (kind: 'friend' | 'group', groupId?: string) => Promise<FocusInviteShare>
  onInviteToGroup: (groupId: string, exactContact: string) => boolean | Promise<boolean>
  onRespondGroupInvite: (inviteId: string, accept: boolean) => boolean | Promise<boolean>
  onRespondGroupJoinRequest: (requestId: string, accept: boolean) => boolean | Promise<boolean>
  onSendMessage: (groupId: string, text: string) => boolean | Promise<boolean>
  onMemberAction: (action: 'nudge' | 'remove' | 'block', groupId: string, personId: string) => boolean | Promise<boolean>
}

export function FocusGroups(props: FocusGroupsProps) {
  const {
    profile, groups, groupInvites = [], groupJoinRequests = [], people, messages, rankings,
    onOpenGroup, onCreateGroup, onJoinGroup, onJoinGroupByCode, onLeaveGroup,
    onCreateInviteLink, onInviteToGroup, onRespondGroupInvite, onRespondGroupJoinRequest, onSendMessage, onMemberAction,
  } = props
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [tab, setTab] = useState<GroupTab>('room')
  const [sheet, setSheet] = useState<GroupSheet | null>(null)
  const selectedGroup = groups.find(group => group.id === selectedGroupId)
  const rankedGroups = groups.filter(group => typeof group.rank === 'number')
  const bestRank = rankedGroups.length ? Math.min(...rankedGroups.map(group => group.rank as number)) : null

  function openGroup(group: FocusGroup) {
    setSelectedGroupId(group.id)
    setTab('room')
    onOpenGroup(group.id)
  }

  return (
    <>
      {selectedGroup ? (
        <FocusGroupDetail
          profile={profile}
          group={selectedGroup}
          people={people}
          messages={messages}
          rankings={rankings}
          joinRequests={groupJoinRequests}
          tab={tab}
          onTab={setTab}
          onBack={() => setSelectedGroupId(null)}
          onLeave={async groupId => {
            const left = await onLeaveGroup(groupId)
            if (left) setSelectedGroupId(null)
            return left
          }}
          onInvite={(groupId, restoreFocusTo) => setSheet({ kind: 'invite', groupId, restoreFocusTo })}
          onRespondJoinRequest={onRespondGroupJoinRequest}
          onSendMessage={onSendMessage}
          onMemberAction={onMemberAction}
        />
      ) : (
        <div className="focus-view focus-groups-view">
          <FocusSectionHeading
            eyebrow="Study groups"
            title="Rooms built around real routines."
            detail="Join a live room, compare consistency, and keep group visibility under your control."
            action={<button className="focus-primary-small" onClick={event => setSheet({ kind: 'create', restoreFocusTo: event.currentTarget })}><FontAwesomeIcon icon={faPlus} /> Create group</button>}
          />
          {groupInvites.length > 0 && <GroupInviteNotices invites={groupInvites} onRespond={onRespondGroupInvite} />}
          <section className="focus-group-overview">
            <div><FontAwesomeIcon icon={faUsers} /><span>Your groups</span><b>{groups.filter(group => group.isMember).length}</b></div>
            <div><FontAwesomeIcon icon={faBullseye} /><span>Focusing now</span><b>{groups.reduce((sum, group) => sum + group.liveCount, 0)}</b></div>
            <div><FontAwesomeIcon icon={faTrophy} /><span>Best group rank</span><b>{bestRank ? `#${bestRank}` : '—'}</b></div>
          </section>

          {groups.length ? (
            <div className="focus-group-grid">{groups.map(group => {
              const progress = Math.round(group.weeklySeconds / Math.max(group.weeklyGoalSeconds, 1) * 100)
              return <article className="focus-group-card" key={group.id}>
                <button className="focus-group-card-main" disabled={!group.isMember} onClick={() => openGroup(group)} aria-label={group.isMember ? `Open ${group.name}` : `${group.name}; request membership below`}>
                  <div className="focus-group-card-top"><i><FontAwesomeIcon icon={group.privacy === 'private' ? faLock : faGlobe} /></i><span>{group.category}</span><em>{group.liveCount} live</em></div>
                  <h3>{group.name}</h3><p>{group.description}</p>
                  <div className="focus-group-card-meta"><span><b>{group.memberCount}/{group.capacity}</b> members</span><span><b>{group.rank ? `#${group.rank}` : '—'}</b> this week</span></div>
                  <div className="focus-group-goal"><span><b>Weekly room target</b><em>{progress}%</em></span><FocusProgress value={progress} /></div>
                </button>
                <div className="focus-group-card-foot"><span>{group.isMember ? `Led by ${group.ownerName}` : `${group.privacy} room`}</span>{group.isMember ? <button onClick={() => openGroup(group)}>Open room</button> : <button onClick={() => onJoinGroup(group.id)}>Request to join</button>}</div>
              </article>
            })}</div>
          ) : (
            <section className="focus-groups-empty">
              <FontAwesomeIcon icon={faUsers} /><span>No study groups yet</span><h3>Create a private room or join with an invite.</h3>
              <p>Groups appear only from real memberships or server-returned invitations. Penni does not populate public rooms with demo activity.</p>
              <div><button onClick={event => setSheet({ kind: 'create', restoreFocusTo: event.currentTarget })}><FontAwesomeIcon icon={faPlus} /> Create group</button>{onJoinGroupByCode && <button onClick={event => setSheet({ kind: 'join', restoreFocusTo: event.currentTarget })}><FontAwesomeIcon icon={faUserPlus} /> Join by invite</button>}</div>
            </section>
          )}
        </div>
      )}

      {sheet?.kind === 'create' && <CreateGroupSheet restoreFocusTo={sheet.restoreFocusTo} onClose={() => setSheet(null)} onSubmit={onCreateGroup} />}
      {sheet?.kind === 'join' && onJoinGroupByCode && <JoinGroupSheet restoreFocusTo={sheet.restoreFocusTo} onClose={() => setSheet(null)} onSubmit={code => { onJoinGroupByCode(code); setSheet(null) }} />}
      {sheet?.kind === 'invite' && onCreateInviteLink && <FocusInviteSheet kind="group" groupId={sheet.groupId} restoreFocusTo={sheet.restoreFocusTo} title={groups.find(group => group.id === sheet.groupId)?.name ?? 'Study group'} detail="Share one secure QR or link, or send a private invitation to a verified contact." onClose={() => setSheet(null)} onCreate={onCreateInviteLink} onDirectInvite={contact => onInviteToGroup(sheet.groupId, contact)} />}
    </>
  )
}

function readableActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function GroupInviteNotices({ invites, onRespond }: {
  invites: FocusGroupInviteNotice[]
  onRespond: (inviteId: string, accept: boolean) => boolean | Promise<boolean>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ inviteId: string; message: string } | null>(null)

  async function respond(inviteId: string, accept: boolean) {
    setPendingId(inviteId)
    setFeedback(null)
    try {
      const saved = await onRespond(inviteId, accept)
      if (!saved) {
        setFeedback({ inviteId, message: accept ? 'This invite could not be accepted. Try again.' : 'This invite could not be declined. Try again.' })
      }
    } catch (error) {
      setFeedback({ inviteId, message: readableActionError(error, 'This invitation could not be updated. Try again.') })
    } finally {
      setPendingId(null)
    }
  }

  return <section className="focus-group-notice-panel" aria-label="Study group invitations">
    <div className="focus-group-notice-heading"><span>Invitations</span><h3>Groups waiting for you</h3><p>Accept to join the room, or decline to remove the invitation.</p></div>
    <div className="focus-group-notice-list">{invites.map(invite => <article key={invite.id}>
      <i><FontAwesomeIcon icon={faUserPlus} /></i>
      <div className="focus-group-notice-copy"><span>{invite.category}</span><b>{invite.groupName}</b><small>Invited by {invite.inviterName} · expires {new Date(invite.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>{invite.message && <p>{invite.message}</p>}{feedback?.inviteId === invite.id && <em role="alert">{feedback.message}</em>}</div>
      <div className="focus-group-notice-actions"><button disabled={pendingId !== null} onClick={() => respond(invite.id, false)}>Decline</button><button className="primary" disabled={pendingId !== null} onClick={() => respond(invite.id, true)}>{pendingId === invite.id ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Updating…</> : 'Join group'}</button></div>
    </article>)}</div>
  </section>
}

function FocusGroupDetail(props: {
  profile: FocusProfile; group: FocusGroup; people: FocusPerson[]; messages: FocusGroupMessage[]; rankings: FocusRankingEntry[]; joinRequests: FocusGroupJoinRequestNotice[]; tab: GroupTab;
  onTab: (tab: GroupTab) => void; onBack: () => void; onLeave: (groupId: string) => boolean | Promise<boolean>; onInvite: (groupId: string, restoreFocusTo: HTMLElement) => void;
  onRespondJoinRequest: (requestId: string, accept: boolean) => boolean | Promise<boolean>;
  onSendMessage: (groupId: string, text: string) => boolean | Promise<boolean>; onMemberAction: (action: 'nudge' | 'remove' | 'block', groupId: string, personId: string) => boolean | Promise<boolean>
}) {
  const { profile, group, people, messages, rankings, joinRequests, tab, onTab, onBack, onLeave, onInvite, onRespondJoinRequest, onSendMessage, onMemberAction } = props
  const [selectedMember, setSelectedMember] = useState<{ id: string; trigger: HTMLElement } | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [memberAction, setMemberAction] = useState<string | null>(null)
  const members = useMemo(() => people.filter(person => group.memberIds.includes(person.id)), [group.memberIds, people])
  const liveMembers = members.filter(member => member.isLive)
  const memberDetail = selectedMember ? members.find(member => member.id === selectedMember.id) ?? null : null
  const groupRanking = rankings.filter(entry => group.memberIds.includes(entry.person.id) || entry.person.id === profile.id).sort((a, b) => b.weekSeconds - a.weekSeconds)
  const groupMessages = messages.filter(message => message.groupId === group.id).sort((a, b) => a.createdAt - b.createdAt)
  const pendingJoinRequests = joinRequests.filter(request => request.groupId === group.id)
  const progress = Math.round(group.weeklySeconds / Math.max(group.weeklyGoalSeconds, 1) * 100)

  useEffect(() => {
    setSelectedMember(current => current && !members.some(member => member.id === current.id) ? null : current)
  }, [members])

  async function sendMessage() {
    const text = messageDraft.trim()
    if (!text || messageSending) return
    setMessageSending(true)
    setMessageError('')
    try {
      const sent = await onSendMessage(group.id, text)
      if (sent) setMessageDraft(current => current.trim() === text ? '' : current)
      else setMessageError('The message was not sent. Your draft has been kept so you can retry.')
    } catch (error) {
      setMessageError(readableActionError(error, 'The message was not sent. Your draft has been kept so you can retry.'))
    } finally {
      setMessageSending(false)
    }
  }

  async function actOnMember(action: 'nudge' | 'remove' | 'block', person: FocusPerson) {
    const pendingKey = `${action}:${person.id}`
    if (memberAction) return
    setMemberAction(pendingKey)
    try {
      const saved = await onMemberAction(action, group.id, person.id)
      if (saved && action !== 'nudge') setSelectedMember(null)
    } finally {
      setMemberAction(null)
    }
  }

  return <div className="focus-view focus-group-detail">
    <div className="focus-group-detail-head"><button onClick={onBack} aria-label="Back to groups"><FontAwesomeIcon icon={faArrowLeft} /></button><div><span>{group.category} · {group.privacy}</span><h2>{group.name}</h2><p>{group.memberCount}/{group.capacity} members · led by {group.ownerName}</p></div>{group.canManage && <button className="focus-group-invite-trigger" onClick={event => onInvite(group.id, event.currentTarget)}><FontAwesomeIcon icon={faUserPlus} /><span>Invite members</span></button>}</div>
    <div className="focus-group-tabs" role="tablist" aria-label="Group view">{(['room', 'members', 'rank', 'chat'] as GroupTab[]).map(item => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => onTab(item)}>{item === 'room' ? 'Study room' : item}</button>)}</div>

    {tab === 'room' && <>
      <section className="focus-study-room focus-group-study-room" aria-labelledby="focus-group-room-title">
        <header className="focus-study-room-head">
          <div><span><i /> Live room</span><h3 id="focus-group-room-title">{group.name}</h3><p>{liveMembers.length ? `${liveMembers.length} ${liveMembers.length === 1 ? 'member is' : 'members are'} studying now` : 'The room is quiet—start a session to appear here'}</p></div>
          <strong><b>{liveMembers.length}</b><span>live</span><small>{members.length} members</small></strong>
        </header>
        <FocusLivePeopleGrid people={members} selectedId={selectedMember?.id} onSelect={(person, trigger) => setSelectedMember({ id: person.id, trigger })} emptyTitle="No members yet" emptyDetail="Invite study partners to build this room." />
      </section>

      <section className="focus-room-mission-strip" aria-label="Weekly group mission">
        <div className="focus-room-mission-copy"><span>Weekly mission</span><b>{compactFocusTime(group.weeklySeconds)} <small>of {compactFocusTime(group.weeklyGoalSeconds)}</small></b></div>
        <div className="focus-room-mission-progress"><span><b>{progress}%</b><small>complete</small></span><FocusProgress value={progress} /></div>
        <div className="focus-room-mission-meta"><span><FontAwesomeIcon icon={faTrophy} /><small>Rank</small><b>{group.rank ? `#${group.rank}` : '—'}</b></span><span><FontAwesomeIcon icon={faUsers} /><small>Capacity</small><b>{group.memberCount}/{group.capacity}</b></span></div>
      </section>

      <details className="focus-room-about">
        <summary><span><b>Room details &amp; rules</b><small>{group.description}</small></span><em>{group.rules.length} {group.rules.length === 1 ? 'rule' : 'rules'}</em></summary>
        <div className="focus-room-about-body">
          <div className="focus-group-rule-list">{group.rules.length ? group.rules.map((rule, index) => <span key={rule}><i><FontAwesomeIcon icon={faCheck} /></i><b>{index + 1}</b>{rule}</span>) : <p>No group rules have been added.</p>}</div>
          <div className="focus-group-privacy"><FontAwesomeIcon icon={group.privacy === 'private' ? faLock : faGlobe} /><p><b>{group.privacy === 'private' ? 'Private group' : 'Public group'}</b>{group.privacy === 'private' ? 'Membership requires an invite or approval.' : 'Aspirants can discover this room and request to join.'}</p></div>
          {group.isOwner ? <div className="focus-group-privacy"><FontAwesomeIcon icon={faCrown} /><p><b>You own this group</b>Ownership must be transferred before you can leave this room.</p></div> : <button className="focus-leave-group" onClick={() => { void onLeave(group.id) }}>Leave group</button>}
        </div>
      </details>
    </>}

    {tab === 'members' && <>
      {group.canManage && pendingJoinRequests.length > 0 && <GroupJoinRequestNotices requests={pendingJoinRequests} onRespond={onRespondJoinRequest} />}
      <section className="focus-card focus-group-member-list"><FocusSectionHeading eyebrow="Members" title={`${members.length} people in this room`} detail="Open a member to see their live block and privacy-eligible focus totals." action={group.canManage ? <button className="focus-primary-small" onClick={event => onInvite(group.id, event.currentTarget)}><FontAwesomeIcon icon={faUserPlus} /> Invite members</button> : undefined} />{members.length ? <div className="focus-member-directory">{members.map(member => <button key={member.id} className={selectedMember?.id === member.id ? 'selected' : ''} onClick={event => setSelectedMember({ id: member.id, trigger: event.currentTarget })}><FocusAvatar name={member.name} initials={member.initials} avatarUrl={member.avatarUrl} live={member.isLive} /><div><b>{member.id === profile.id ? 'You' : member.name}</b><span>{member.isLive ? `Studying · ${member.subject}` : member.username ? `@${member.username}` : 'Not studying now'}</span></div><strong>{member.isLive ? compactFocusTime(member.liveSeconds ?? 0) : member.analyticsShared ? compactFocusTime(member.weeklySeconds) : 'Private'}<small>{member.isLive ? 'live block' : 'this week'}</small></strong></button>)}</div> : <div className="focus-empty-inline"><FontAwesomeIcon icon={faUsers} /><p>Member records have not loaded.</p></div>}</section>
    </>}

    {tab === 'rank' && <section className="focus-card focus-group-ranking"><FocusSectionHeading eyebrow="Weekly ranking" title="Consistency inside this room" detail="Ranked by server-verified focused time for the current week." />{groupRanking.length ? groupRanking.map((entry, index) => <article key={entry.person.id} className={entry.person.id === profile.id ? 'self' : ''}><span className="focus-rank-number">{index === 0 ? <FontAwesomeIcon icon={faCrown} /> : index + 1}</span><FocusAvatar name={entry.person.name} initials={entry.person.initials} avatarUrl={entry.person.avatarUrl} /><div><b>{entry.person.id === profile.id ? 'You' : entry.person.name}</b><span>{entry.person.streak}-day streak</span></div><strong>{compactFocusTime(entry.weekSeconds)}</strong></article>) : <div className="focus-empty-inline"><FontAwesomeIcon icon={faTrophy} /><p>No verified focus time has been ranked this week.</p></div>}</section>}

    {tab === 'chat' && <section className="focus-card focus-group-chat"><FocusSectionHeading eyebrow="Group chat" title="Room messages" detail="Messages come from the connected group service; none are generated locally." />{groupMessages.length ? <div className="focus-chat-messages">{groupMessages.map(message => <article key={message.id} className={message.senderId === profile.id ? 'self' : ''}><FocusAvatar name={message.senderName} initials={message.senderInitials} avatarUrl={message.senderAvatarUrl} size="sm" /><div><span><b>{message.senderId === profile.id ? 'You' : message.senderName}</b><time>{new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time></span><p>{message.text}</p></div></article>)}</div> : <div className="focus-empty-inline"><FontAwesomeIcon icon={faCommentDots} /><p>No messages yet. Start with a useful study update.</p></div>}{messageError && <p className="focus-group-form-error" role="alert">{messageError}</p>}<form className="focus-chat-composer" aria-busy={messageSending} onSubmit={event => { event.preventDefault(); void sendMessage() }}><input value={messageDraft} onChange={event => { setMessageDraft(event.target.value); setMessageError('') }} placeholder="Message the group" maxLength={500} disabled={messageSending} /><button disabled={messageSending || !messageDraft.trim()}><FontAwesomeIcon icon={messageSending ? faCircleNotch : faPaperPlane} spin={messageSending} /><span>{messageSending ? 'Sending…' : 'Send'}</span></button></form></section>}

    {memberDetail && selectedMember && <FocusPersonDetails person={memberDetail} relationshipLabel={memberDetail.id === profile.id ? 'Your group profile' : `${group.name} member`} restoreFocusTo={selectedMember.trigger} busy={Boolean(memberAction)} onClose={() => setSelectedMember(null)} actions={memberDetail.id !== profile.id ? <><button className="primary" disabled={Boolean(memberAction)} onClick={() => { void actOnMember('nudge', memberDetail) }}><FontAwesomeIcon icon={memberAction === `nudge:${memberDetail.id}` ? faCircleNotch : faPaperPlane} spin={memberAction === `nudge:${memberDetail.id}`} /> {memberAction === `nudge:${memberDetail.id}` ? 'Sending…' : 'Nudge'}</button>{group.canManage && <><button disabled={Boolean(memberAction)} onClick={() => { void actOnMember('remove', memberDetail) }}><FontAwesomeIcon icon={memberAction === `remove:${memberDetail.id}` ? faCircleNotch : faTrash} spin={memberAction === `remove:${memberDetail.id}`} /> {memberAction === `remove:${memberDetail.id}` ? 'Removing…' : 'Remove'}</button><button className="danger" disabled={Boolean(memberAction)} onClick={() => { void actOnMember('block', memberDetail) }}><FontAwesomeIcon icon={memberAction === `block:${memberDetail.id}` ? faCircleNotch : faBan} spin={memberAction === `block:${memberDetail.id}`} /> {memberAction === `block:${memberDetail.id}` ? 'Blocking…' : 'Block'}</button></>}</> : undefined} />}
  </div>
}

function GroupJoinRequestNotices({ requests, onRespond }: {
  requests: FocusGroupJoinRequestNotice[]
  onRespond: (requestId: string, accept: boolean) => boolean | Promise<boolean>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ requestId: string; message: string } | null>(null)

  async function respond(requestId: string, accept: boolean) {
    setPendingId(requestId)
    setFeedback(null)
    try {
      const saved = await onRespond(requestId, accept)
      if (!saved) {
        setFeedback({ requestId, message: accept ? 'This member could not be added. Try again.' : 'This request could not be declined. Try again.' })
      }
    } catch (error) {
      setFeedback({ requestId, message: readableActionError(error, 'This join request could not be updated. Try again.') })
    } finally {
      setPendingId(null)
    }
  }

  return <section className="focus-group-notice-panel compact" aria-label="Pending group join requests">
    <div className="focus-group-notice-heading"><span>Admin queue</span><h3>{requests.length} {requests.length === 1 ? 'person wants' : 'people want'} to join</h3><p>Review exact account requests before adding them to this room.</p></div>
    <div className="focus-group-notice-list">{requests.map(request => <article key={request.id}>
      <FocusAvatar name={request.person.name} initials={request.person.initials} avatarUrl={request.person.avatarUrl} />
      <div className="focus-group-notice-copy"><span>Join request</span><b>{request.person.name}</b><small>{request.person.streak}-day streak · requested {new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>{request.message && <p>{request.message}</p>}{feedback?.requestId === request.id && <em role="alert">{feedback.message}</em>}</div>
      <div className="focus-group-notice-actions"><button disabled={pendingId !== null} onClick={() => respond(request.id, false)}>Decline</button><button className="primary" disabled={pendingId !== null} onClick={() => respond(request.id, true)}>{pendingId === request.id ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Updating…</> : 'Approve'}</button></div>
    </article>)}</div>
  </section>
}

function FocusOverlayPortal({ children }: { children: ReactNode }) {
  const content = <div className="focus-overlay-portal">{children}</div>
  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}

const GROUP_CATEGORIES = ['Current Affairs', 'General Studies', 'Optional', 'Essay', 'CSAT', 'Answer Writing']

function GroupSheetShell({ title, detail, restoreFocusTo, onClose, busy = false, children }: { title: string; detail: string; restoreFocusTo: HTMLElement; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = restoreFocusTo
    const parentDialog = document.querySelector<HTMLElement>('.focus-secondary-sheet[aria-modal="true"]')
    const parentModalValue = parentDialog?.getAttribute('aria-modal') ?? null
    const parentHiddenValue = parentDialog?.getAttribute('aria-hidden') ?? null
    const parentWasInert = parentDialog?.inert ?? false

    if (parentDialog) {
      parentDialog.setAttribute('aria-modal', 'false')
      parentDialog.setAttribute('aria-hidden', 'true')
      parentDialog.inert = true
    }

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      const firstControl = dialog.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? dialog.querySelector<HTMLElement>('button:not([disabled])')
      ;(firstControl ?? dialog).focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCloseRef.current()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown, true)
      if (parentDialog) {
        if (parentModalValue === null) parentDialog.removeAttribute('aria-modal')
        else parentDialog.setAttribute('aria-modal', parentModalValue)
        if (parentHiddenValue === null) parentDialog.removeAttribute('aria-hidden')
        else parentDialog.setAttribute('aria-hidden', parentHiddenValue)
        parentDialog.inert = parentWasInert
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return (
    <FocusOverlayPortal>
      <div className="focus-group-sheet-backdrop" onClick={onClose}>
        <aside ref={dialogRef} className="focus-group-sheet" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} tabIndex={-1} onClick={event => event.stopPropagation()}>
          <header><div><span>Study groups</span><h3>{title}</h3><p>{detail}</p></div><button type="button" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>
          <div className="focus-group-sheet-body">{children}</div>
        </aside>
      </div>
    </FocusOverlayPortal>
  )
}

type CreateGroupField = 'name' | 'capacity' | 'weeklyGoal' | 'description'
type FormFeedback = { kind: 'idle' | 'submitting' | 'success' | 'error'; message: string }

function CreateGroupSheet({ restoreFocusTo, onClose, onSubmit }: { restoreFocusTo: HTMLElement; onClose: () => void; onSubmit: (draft: FocusGroupDraft) => string | null | Promise<string | null> }) {
  const [draft, setDraft] = useState<FocusGroupDraft>({
    name: '',
    category: GROUP_CATEGORIES[0],
    description: '',
    privacy: 'private',
    joinPolicy: 'approval',
    capacity: 30,
    weeklyGoalSeconds: 18_000,
    rules: [],
  })
  const [rulesText, setRulesText] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateGroupField, string>>>({})
  const [feedback, setFeedback] = useState<FormFeedback>({ kind: 'idle', message: '' })
  const busy = feedback.kind === 'submitting' || feedback.kind === 'success'

  function clearFieldError(field: CreateGroupField) {
    setFieldErrors(current => current[field] ? { ...current, [field]: undefined } : current)
    if (feedback.kind === 'error') setFeedback({ kind: 'idle', message: '' })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: Partial<Record<CreateGroupField, string>> = {}
    if (draft.name.trim().length < 3) errors.name = 'Use at least 3 characters so members can recognise the group.'
    if (!Number.isFinite(draft.capacity) || draft.capacity < 2 || draft.capacity > 200) errors.capacity = 'Capacity must be between 2 and 200 members.'
    if (!Number.isFinite(draft.weeklyGoalSeconds) || draft.weeklyGoalSeconds < 1_800 || draft.weeklyGoalSeconds > 604_800) errors.weeklyGoal = 'Weekly goal must be between 30 and 10,080 minutes.'
    if (draft.description.trim().length < 10) errors.description = 'Add at least 10 characters describing what this room is for.'
    setFieldErrors(errors)
    const firstInvalid = Object.keys(errors)[0] as CreateGroupField | undefined
    if (firstInvalid) {
      setFeedback({ kind: 'error', message: 'Please fix the highlighted fields before creating the group.' })
      event.currentTarget.querySelector<HTMLElement>(`[data-group-field="${firstInvalid}"]`)?.focus()
      return
    }

    setFeedback({ kind: 'submitting', message: 'Creating your study group…' })
    try {
      const groupId = await onSubmit({
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        capacity: Math.round(draft.capacity),
        weeklyGoalSeconds: Math.round(draft.weeklyGoalSeconds),
        rules: rulesText.split('\n').map(rule => rule.trim().slice(0, 180)).filter(Boolean).slice(0, 8),
      })
      if (!groupId) {
        setFeedback({ kind: 'error', message: 'The group was not created. Check your connection or account permissions, then try again.' })
        return
      }
      setFeedback({ kind: 'success', message: 'Group created. Opening your study room…' })
      await new Promise(resolve => window.setTimeout(resolve, 650))
      onClose()
    } catch (error) {
      setFeedback({ kind: 'error', message: readableActionError(error, 'The group could not be created. Please try again.') })
    }
  }

  return (
    <GroupSheetShell title="Create a study room" detail="Set the purpose, access rules and a realistic weekly goal before inviting anyone." restoreFocusTo={restoreFocusTo} onClose={onClose} busy={busy}>
      <form className="focus-group-form" onSubmit={submit} noValidate>
        <label className="wide"><span>Group name <small>3–60 characters</small></span><input data-group-field="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'focus-group-name-error' : undefined} value={draft.name} onChange={event => { setDraft(current => ({ ...current, name: event.target.value })); clearFieldError('name') }} maxLength={60} placeholder="e.g. GS 2 Morning Circle" autoFocus />{fieldErrors.name && <small className="focus-group-field-error" id="focus-group-name-error">{fieldErrors.name}</small>}</label>
        <label><span>Category</span><select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}>{GROUP_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label><span>Visibility</span><select value={draft.privacy} onChange={event => { const privacy = event.target.value as FocusGroupDraft['privacy']; setDraft(current => ({ ...current, privacy, joinPolicy: privacy === 'private' && current.joinPolicy === 'open' ? 'approval' : current.joinPolicy })) }}><option value="private">Private</option><option value="public">Public</option></select></label>
        <label><span>Joining</span><select value={draft.joinPolicy} onChange={event => setDraft(current => ({ ...current, joinPolicy: event.target.value as FocusGroupDraft['joinPolicy'] }))}><option value="approval">Admin approval</option><option value="invite-only">Invite only</option>{draft.privacy === 'public' && <option value="open">Open to join</option>}</select></label>
        <label><span>Capacity</span><input data-group-field="capacity" aria-invalid={Boolean(fieldErrors.capacity)} aria-describedby={fieldErrors.capacity ? 'focus-group-capacity-error' : undefined} type="number" min="2" max="200" value={Number.isFinite(draft.capacity) ? draft.capacity : ''} onChange={event => { setDraft(current => ({ ...current, capacity: event.target.value === '' ? Number.NaN : Number(event.target.value) })); clearFieldError('capacity') }} />{fieldErrors.capacity && <small className="focus-group-field-error" id="focus-group-capacity-error">{fieldErrors.capacity}</small>}</label>
        <label className="wide"><span>Weekly room goal</span><div className={`focus-group-unit-input ${fieldErrors.weeklyGoal ? 'invalid' : ''}`}><input data-group-field="weeklyGoal" aria-invalid={Boolean(fieldErrors.weeklyGoal)} aria-describedby={fieldErrors.weeklyGoal ? 'focus-group-goal-error' : undefined} type="number" min="30" max="10080" value={Number.isFinite(draft.weeklyGoalSeconds) ? Math.round(draft.weeklyGoalSeconds / 60) : ''} onChange={event => { setDraft(current => ({ ...current, weeklyGoalSeconds: event.target.value === '' ? Number.NaN : Number(event.target.value) * 60 })); clearFieldError('weeklyGoal') }} /><em>minutes</em></div>{fieldErrors.weeklyGoal && <small className="focus-group-field-error" id="focus-group-goal-error">{fieldErrors.weeklyGoal}</small>}</label>
        <label className="wide"><span>Description <small>At least 10 characters</small></span><textarea data-group-field="description" aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'focus-group-description-error' : undefined} value={draft.description} onChange={event => { setDraft(current => ({ ...current, description: event.target.value })); clearFieldError('description') }} maxLength={280} rows={3} placeholder="What will members study and how will this room help?" />{fieldErrors.description && <small className="focus-group-field-error" id="focus-group-description-error">{fieldErrors.description}</small>}</label>
        <label className="wide"><span>Rules <small>Optional · one per line</small></span><textarea value={rulesText} onChange={event => setRulesText(event.target.value)} maxLength={700} rows={4} placeholder={'Share honest focus time\nKeep chat study-related'} /></label>
        <div className="focus-group-form-note wide"><FontAwesomeIcon icon={draft.privacy === 'private' ? faLock : faGlobe} /><p><b>{draft.privacy === 'private' ? 'Private room' : 'Public room'}</b>{draft.privacy === 'private' ? 'Only invited or approved members can enter.' : 'The room may appear in connected discovery results; no demo members are added.'}</p></div>
        <footer className="wide">{feedback.kind !== 'idle' && <p className={`focus-group-submit-status ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'submitting' && <FontAwesomeIcon icon={faCircleNotch} spin />}{feedback.kind === 'success' && <FontAwesomeIcon icon={faCheck} />}{feedback.message}</p>}<div className="focus-group-footer-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{feedback.kind === 'submitting' ? 'Creating…' : feedback.kind === 'success' ? 'Created' : 'Create group'}</button></div></footer>
      </form>
    </GroupSheetShell>
  )
}

function JoinGroupSheet({ restoreFocusTo, onClose, onSubmit }: { restoreFocusTo: HTMLElement; onClose: () => void; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const exactCode = code.trim()
    if (exactCode.length < 4) { setError('Enter the complete invite code.'); return }
    onSubmit(exactCode)
  }

  return (
    <GroupSheetShell title="Join with an invite" detail="Use the complete code shared by a group admin. Penni will not guess or browse rooms from partial text." restoreFocusTo={restoreFocusTo} onClose={onClose}>
      <form className="focus-group-simple-form" onSubmit={submit}>
        <label><span>Invite code</span><input value={code} onChange={event => { setCode(event.target.value); setError('') }} maxLength={80} placeholder="Enter full invite code" autoCapitalize="characters" autoFocus /></label>
        {error && <p className="focus-group-form-error">{error}</p>}
        <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!code.trim()}>Check invite</button></footer>
      </form>
    </GroupSheetShell>
  )
}
