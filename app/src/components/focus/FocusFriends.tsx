import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faCheck, faChevronRight, faCircleNotch, faMagnifyingGlass, faPaperPlane, faPlus, faQrcode, faTrash, faUserGroup, faUserPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { FocusFriendAction, FocusFriendRequest, FocusInviteShare, FocusPerson, FocusSearchRequest } from './focusTypes'
import { FocusAvatar } from './FocusPrimitives'
import { FocusFriendsManageSheet, type FocusFriendsManageTab } from './FocusFriendsManageSheet'
import { FocusInviteSheet } from './FocusInviteSheet'
import { FocusLivePeopleGrid, FocusPersonDetails } from './FocusPersonDetails'

interface FocusFriendsProps {
  username?: string
  friends: FocusPerson[]
  requests: FocusFriendRequest[]
  onSearchPeople?: (request: FocusSearchRequest) => Promise<FocusPerson[]> | FocusPerson[]
  onUsernameChange?: (username: string) => Promise<string> | string
  onCreateInviteLink?: (kind: 'friend' | 'group', groupId?: string) => Promise<FocusInviteShare>
  friendRequestsEnabled?: boolean
  onFriendRequestsChange?: (enabled: boolean) => void
  onAction: (action: FocusFriendAction, personId: string, requestId?: string) => Promise<boolean> | boolean
}

function searchChannel(query: string): FocusSearchRequest['channel'] | null {
  const value = query.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
  if (/^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''))) return 'phone'
  const username = value.replace(/^@/, '')
  if (/^[a-zA-Z0-9][a-zA-Z0-9._]{1,22}[a-zA-Z0-9]$/.test(username) && !/[._]{2}/.test(username)) return 'username'
  return null
}

function canonicalSearchValue(query: string, channel: FocusSearchRequest['channel']) {
  const value = query.trim()
  if (channel === 'username') return value.toLowerCase().replace(/^@/, '')
  if (channel === 'email') return value.toLowerCase()
  return value.replace(/[\s()-]/g, '')
}

function normalizedUsername(value: string) {
  const username = value.trim().toLowerCase().replace(/^@/, '')
  if (username.length < 3 || username.length > 24 || !/^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(username) || /[._]{2}/.test(username)) {
    throw new Error('Use 3-24 letters, numbers, dots or underscores. Do not put separators together or at either end.')
  }
  if (/^(admin|administrator|support|penni|official|moderator|system)([._]|$)/.test(username)) {
    throw new Error('That username is reserved. Please choose another.')
  }
  return username
}

export function FocusFriends({ username, friends, requests, onSearchPeople, onUsernameChange, onCreateInviteLink, friendRequestsEnabled = false, onFriendRequestsChange, onAction }: FocusFriendsProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState<FocusPerson[] | null>(null)
  const [handledRequests, setHandledRequests] = useState<string[]>([])
  const [pendingRequests, setPendingRequests] = useState<string[]>([])
  const [actedPeople, setActedPeople] = useState<Record<string, string>>({})
  const [editingUsername, setEditingUsername] = useState(!username)
  const [usernameDraft, setUsernameDraft] = useState(username ?? '')
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [inviteTrigger, setInviteTrigger] = useState<HTMLElement | null>(null)
  const [manageSheet, setManageSheet] = useState<{ tab: FocusFriendsManageTab; trigger: HTMLElement } | null>(null)
  const [selectedFriend, setSelectedFriend] = useState<{ id: string; trigger: HTMLElement } | null>(null)
  const searchGenerationRef = useRef(0)
  const liveFriends = friends.filter(friend => friend.isLive)
  const friendDetail = selectedFriend ? friends.find(friend => friend.id === selectedFriend.id) ?? null : null
  const incoming = requests.filter(request => request.direction === 'incoming' && !handledRequests.includes(request.id))
  const outgoing = requests.filter(request => request.direction === 'outgoing' && !handledRequests.includes(request.id))
  const pendingCount = incoming.length + outgoing.length

  useEffect(() => {
    setUsernameDraft(username ?? '')
    if (username) setEditingUsername(false)
  }, [username])

  useEffect(() => () => { searchGenerationRef.current++ }, [])

  useEffect(() => {
    setSelectedFriend(current => current && !friends.some(friend => friend.id === current.id) ? null : current)
  }, [friends])

  async function saveUsername() {
    setUsernameError('')
    if (!onUsernameChange) { setUsernameError('Username setup needs a connected, signed-in account.'); return }
    let canonical: string
    try {
      canonical = normalizedUsername(usernameDraft)
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : 'Enter a valid username.')
      return
    }
    setSavingUsername(true)
    try {
      const saved = await onUsernameChange(canonical)
      setUsernameDraft(saved)
      setEditingUsername(false)
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : 'Your username could not be saved. Try again.')
    } finally {
      setSavingUsername(false)
    }
  }

  async function findAccount() {
    const generation = ++searchGenerationRef.current
    const channel = searchChannel(query)
    setSearchError('')
    setSearchResults(null)
    if (!channel) { setSearching(false); setSearchError('Enter an exact username, complete email address, or full phone number with country code.'); return }
    // Verified contact lookup does not depend on claiming a public handle.
    // Only username-to-username discovery asks the current user to claim one.
    if (!username && channel === 'username') {
      setSearching(false)
      setSearchError('Choose your unique username before searching by username. You can still search by verified email or full phone number now.')
      setEditingUsername(true)
      setManageSheet(current => current ? { ...current, tab: 'profile' } : current)
      return
    }
    if (!onSearchPeople) { setSearching(false); setSearchError('Verified account lookup is not connected yet.'); return }
    setSearching(true)
    try {
      const result = await onSearchPeople({ query: canonicalSearchValue(query, channel), channel })
      if (searchGenerationRef.current === generation) setSearchResults(result)
    } catch (error) {
      if (searchGenerationRef.current === generation) {
        setSearchError(error instanceof Error ? error.message : 'The account lookup could not be completed. Try again.')
      }
    } finally {
      if (searchGenerationRef.current === generation) setSearching(false)
    }
  }

  async function handleRequest(request: FocusFriendRequest, action: 'accept' | 'decline' | 'cancel') {
    setPendingRequests(current => [...current, request.id])
    try {
      const saved = await onAction(action, request.person.id, request.id)
      if (saved) setHandledRequests(current => [...current, request.id])
    } catch {
      // The connected controller reports the actionable error; keep the row
      // visible so the user can retry instead of pretending it succeeded.
    } finally {
      setPendingRequests(current => current.filter(id => id !== request.id))
    }
  }

  async function act(action: FocusFriendAction, person: FocusPerson) {
    const pending = `${action}:pending`
    setActedPeople(current => ({ ...current, [person.id]: pending }))
    try {
      const saved = await onAction(action, person.id)
      setActedPeople(current => {
        if (saved) return { ...current, [person.id]: action }
        const next = { ...current }
        delete next[person.id]
        return next
      })
      return Boolean(saved)
    } catch {
      setActedPeople(current => {
        const next = { ...current }
        delete next[person.id]
        return next
      })
      return false
    }
  }

  function openManage(tab: FocusFriendsManageTab, trigger: HTMLElement) {
    if (tab === 'profile' && !username) setEditingUsername(true)
    setManageSheet({ tab, trigger })
  }

  return (
    <div className="focus-view focus-friends-view">
      <header className="focus-friends-main-head">
        <div><span>Study circle</span><h2>Friends</h2><p>Your live study room, with private analytics one tap away.</p></div>
        <button type="button" className="focus-friends-manage-trigger" onClick={event => openManage('add', event.currentTarget)}>
          <FontAwesomeIcon icon={faUserPlus} /><span>Manage</span>{incoming.length > 0 && <b aria-label={`${incoming.length} incoming friend ${incoming.length === 1 ? 'request' : 'requests'}`}>{incoming.length > 99 ? '99+' : incoming.length}</b>}
        </button>
      </header>

      <section className="focus-study-room focus-friends-study-room" aria-labelledby="focus-friends-room-title">
        <header className="focus-study-room-head">
          <div><span><i /> Live room</span><h3 id="focus-friends-room-title">Friends studying</h3><p>{liveFriends.length ? `${liveFriends.length} ${liveFriends.length === 1 ? 'friend is' : 'friends are'} focusing now` : 'No one is focusing right now'}</p></div>
          <strong><b>{liveFriends.length}</b><span>live</span><small>{friends.length} total</small></strong>
        </header>
        <FocusLivePeopleGrid people={friends} selectedId={selectedFriend?.id} onSelect={(person, trigger) => setSelectedFriend({ id: person.id, trigger })} emptyTitle="Your study room is empty" emptyDetail="Use Manage to find a friend by username, email or QR." />
      </section>

      {pendingCount > 0 && <button type="button" className="focus-friends-request-banner" onClick={event => openManage('requests', event.currentTarget)}>
        <span className="focus-friends-request-banner-icon"><FontAwesomeIcon icon={faUserGroup} /></span>
        <span><b>{incoming.length ? `${incoming.length} friend ${incoming.length === 1 ? 'request' : 'requests'} waiting` : `${outgoing.length} sent ${outgoing.length === 1 ? 'request' : 'requests'} pending`}</b><small>{incoming.length ? 'Review, accept or decline' : 'View or cancel sent requests'}</small></span>
        <em>{pendingCount}</em><FontAwesomeIcon icon={faChevronRight} />
      </button>}

      {manageSheet && <FocusFriendsManageSheet
        activeTab={manageSheet.tab}
        requestCount={pendingCount}
        restoreFocusTo={manageSheet.trigger}
        onTabChange={tab => setManageSheet(current => current ? { ...current, tab } : current)}
        onClose={() => setManageSheet(null)}
        addPanel={<section className="focus-friends-manage-panel focus-friends-add-panel">
          <div className="focus-friends-panel-copy"><span>Add to your circle</span><h3>Find an exact account</h3><p>Search a unique username, verified email, or full phone number. Penni never exposes a public contact directory.</p></div>
          <div className="focus-friend-lookup">
            <form onSubmit={event => { event.preventDefault(); void findAccount() }}><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => { searchGenerationRef.current++; setSearching(false); setQuery(event.target.value); setSearchResults(null); setSearchError('') }} placeholder="username, email or full phone" aria-label="Search by exact username, verified email or full phone number" autoComplete="off" autoCapitalize="none" autoCorrect="off" />{query && <button type="button" onClick={() => { searchGenerationRef.current++; setSearching(false); setQuery(''); setSearchResults(null); setSearchError('') }} aria-label="Clear lookup"><FontAwesomeIcon icon={faXmark} /></button>}<button className="find" type="submit" disabled={searching}>{searching ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Finding…</> : 'Find'}</button></form>
            {searchError && <p className="focus-lookup-error" role="alert">{searchError}</p>}
            {searchResults && (searchResults.length ? <div className="focus-lookup-results">{searchResults.map(person => { const actionState = actedPeople[person.id]; const requested = actionState === 'add'; const sending = actionState === 'add:pending'; return <article key={person.id}><FocusAvatar name={person.name} initials={person.initials} avatarUrl={person.avatarUrl} /><div><b>{person.name}</b><span>{requested ? 'Request sent · waiting for acceptance' : person.username ? `@${person.username}` : person.emailHint ?? person.phoneHint ?? 'Verified exact match'}</span></div><button type="button" onClick={() => { void act('add', person) }} disabled={requested || sending}><FontAwesomeIcon icon={sending ? faCircleNotch : requested ? faCheck : faPlus} spin={sending} /> {sending ? 'Sending…' : requested ? 'Waiting' : 'Add friend'}</button></article> })}{Object.values(actedPeople).includes('add') && <p className="focus-request-route" role="status">Request sent. They will see it in their Friends inbox.</p>}</div> : <div className="focus-lookup-empty"><b>No opted-in account matched.</b><span>Ask them to open Friends → Manage → My profile and enable friend requests.</span></div>)}
          </div>
        </section>}
        requestsPanel={<section className="focus-friends-manage-panel focus-friends-requests-panel">
          <div className="focus-friends-panel-copy"><span>Request inbox</span><h3>{incoming.length ? `${incoming.length} waiting for you` : outgoing.length ? 'Sent requests' : 'All caught up'}</h3><p>Requests from username search and QR invites stay here until they are accepted, declined or cancelled.</p></div>
          {pendingCount > 0 ? <div className="focus-request-list">
            {incoming.map(request => { const pending = pendingRequests.includes(request.id); return <article key={request.id}><FocusAvatar name={request.person.name} initials={request.person.initials} avatarUrl={request.person.avatarUrl} /><div><b>{request.person.name}</b><span>Wants to join your study circle</span></div><button type="button" className="accept" disabled={pending} onClick={() => { void handleRequest(request, 'accept') }}><FontAwesomeIcon icon={pending ? faCircleNotch : faCheck} spin={pending} /> {pending ? 'Saving…' : 'Accept'}</button><button type="button" className="decline" disabled={pending} onClick={() => { void handleRequest(request, 'decline') }} aria-label={`Decline ${request.person.name}`}><FontAwesomeIcon icon={faXmark} /></button></article> })}
            {outgoing.map(request => { const pending = pendingRequests.includes(request.id); return <article key={request.id} className="outgoing"><FocusAvatar name={request.person.name} initials={request.person.initials} avatarUrl={request.person.avatarUrl} /><div><b>{request.person.name}</b><span>Waiting for acceptance</span></div><button type="button" className="cancel" disabled={pending} onClick={() => { void handleRequest(request, 'cancel') }}><FontAwesomeIcon icon={pending ? faCircleNotch : faXmark} spin={pending} /> {pending ? 'Cancelling…' : 'Cancel'}</button></article> })}
          </div> : <div className="focus-request-empty"><FontAwesomeIcon icon={faCheck} /><span><b>No pending requests</b><small>New incoming and sent requests will appear here.</small></span></div>}
        </section>}
        profilePanel={<section className="focus-friends-manage-panel focus-friends-profile-panel">
          <div className="focus-friends-panel-copy"><span>My profile</span><h3>{username ? `@${username}` : 'Choose a unique username'}</h3><p>Your username and private QR are the simplest ways for people you know to find you.</p></div>
          <div className={`focus-username-card ${username ? 'claimed' : ''}`}>
            {editingUsername ? <form onSubmit={event => { event.preventDefault(); void saveUsername() }}><label><span aria-hidden="true">@</span><input value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value.toLowerCase().replace(/^@/, '')); setUsernameError('') }} placeholder="your.username" aria-label="Your unique username" autoCapitalize="none" autoCorrect="off" maxLength={24} /></label><button type="submit" disabled={savingUsername}>{savingUsername ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Saving…</> : username ? 'Save username' : 'Claim username'}</button>{username && <button type="button" className="cancel" onClick={() => { setUsernameDraft(username); setUsernameError(''); setEditingUsername(false) }}>Cancel</button>}</form> : <div className="focus-username-actions"><button className="focus-friend-qr-trigger" type="button" disabled={!username || !onCreateInviteLink} onClick={() => { const restore = manageSheet.trigger; setManageSheet(null); setInviteTrigger(restore) }}><FontAwesomeIcon icon={faQrcode} /> Show my QR</button><button className="edit" type="button" onClick={() => setEditingUsername(true)}>Edit username</button></div>}
            {usernameError && <p className="focus-username-error" role="alert">{usernameError}</p>}
          </div>
          <div className={`focus-friend-discovery-control ${friendRequestsEnabled ? 'enabled' : ''}`}>
            <span><b>Accept friend requests</b><small>{friendRequestsEnabled ? 'People who know your exact username, email or phone can find you.' : 'Your account stays hidden from friend search until this is enabled.'}</small></span>
            <button type="button" role="switch" aria-checked={friendRequestsEnabled} onClick={() => onFriendRequestsChange?.(!friendRequestsEnabled)} disabled={!onFriendRequestsChange}><i /></button>
          </div>
        </section>}
      />}

      {inviteTrigger && username && onCreateInviteLink && <FocusInviteSheet kind="friend" title={`Connect with @${username}`} detail="Let a friend scan this QR or open the link. They will see your profile and confirm before a request is sent." handle={username} restoreFocusTo={inviteTrigger} onClose={() => setInviteTrigger(null)} onCreate={onCreateInviteLink} />}
      {friendDetail && selectedFriend && <FocusPersonDetails person={friendDetail} relationshipLabel="Focus friend" restoreFocusTo={selectedFriend.trigger} busy={Boolean(actedPeople[friendDetail.id]?.endsWith(':pending'))} onClose={() => setSelectedFriend(null)} actions={<><button className="primary" disabled={actedPeople[friendDetail.id] === 'nudge' || actedPeople[friendDetail.id]?.endsWith(':pending')} onClick={() => { void act('nudge', friendDetail) }}><FontAwesomeIcon icon={actedPeople[friendDetail.id] === 'nudge:pending' ? faCircleNotch : actedPeople[friendDetail.id] === 'nudge' ? faCheck : faPaperPlane} spin={actedPeople[friendDetail.id] === 'nudge:pending'} /> {actedPeople[friendDetail.id] === 'nudge:pending' ? 'Sending…' : actedPeople[friendDetail.id] === 'nudge' ? 'Nudge sent' : 'Nudge'}</button><button disabled={actedPeople[friendDetail.id]?.endsWith(':pending')} onClick={async () => { if (await act('remove', friendDetail)) setSelectedFriend(null) }}><FontAwesomeIcon icon={actedPeople[friendDetail.id] === 'remove:pending' ? faCircleNotch : faTrash} spin={actedPeople[friendDetail.id] === 'remove:pending'} /> {actedPeople[friendDetail.id] === 'remove:pending' ? 'Removing…' : 'Remove friend'}</button><button className="danger" disabled={actedPeople[friendDetail.id]?.endsWith(':pending')} onClick={async () => { if (await act('block', friendDetail)) setSelectedFriend(null) }}><FontAwesomeIcon icon={actedPeople[friendDetail.id] === 'block:pending' ? faCircleNotch : faBan} spin={actedPeople[friendDetail.id] === 'block:pending'} /> {actedPeople[friendDetail.id] === 'block:pending' ? 'Blocking…' : 'Block'}</button></>} />}
    </div>
  )
}
