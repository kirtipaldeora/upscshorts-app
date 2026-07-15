import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faCheck, faMagnifyingGlass, faPaperPlane, faPlus, faTrash, faUserGroup, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { FocusFriendAction, FocusFriendRequest, FocusPerson, FocusSearchRequest } from './focusTypes'
import { compactFocusTime, FocusAvatar, FocusSectionHeading } from './FocusPrimitives'

interface FocusFriendsProps {
  username?: string
  friends: FocusPerson[]
  requests: FocusFriendRequest[]
  onSearchPeople?: (request: FocusSearchRequest) => Promise<FocusPerson[]> | FocusPerson[]
  onUsernameChange?: (username: string) => Promise<string> | string
  onAction: (action: FocusFriendAction, personId: string, requestId?: string) => Promise<boolean> | boolean
}

function searchChannel(query: string): FocusSearchRequest['channel'] | null {
  const value = query.trim()
  if (/^@[a-zA-Z0-9][a-zA-Z0-9._]{1,22}[a-zA-Z0-9]$/.test(value) && !/[._]{2}/.test(value)) return 'username'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
  if (/^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''))) return 'phone'
  return null
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

export function FocusFriends({ username, friends, requests, onSearchPeople, onUsernameChange, onAction }: FocusFriendsProps) {
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
  const searchGenerationRef = useRef(0)
  const liveFriends = friends.filter(friend => friend.isLive)
  const incoming = requests.filter(request => request.direction === 'incoming' && !handledRequests.includes(request.id))
  const outgoing = requests.filter(request => request.direction === 'outgoing' && !handledRequests.includes(request.id))

  useEffect(() => {
    setUsernameDraft(username ?? '')
    if (username) setEditingUsername(false)
  }, [username])

  useEffect(() => () => { searchGenerationRef.current++ }, [])

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
    if (!channel) { setSearching(false); setSearchError('Enter an exact @username, complete email address, or full phone number with country code.'); return }
    // Verified contact lookup does not depend on claiming a public handle.
    // Only username-to-username discovery asks the current user to claim one.
    if (!username && channel === 'username') { setSearching(false); setSearchError('Choose your unique username before searching by @username. You can still search by verified email or full phone number now.'); setEditingUsername(true); return }
    if (!onSearchPeople) { setSearching(false); setSearchError('Verified account lookup is not connected yet.'); return }
    setSearching(true)
    try {
      const result = await onSearchPeople({ query: query.trim(), channel })
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
    } catch {
      setActedPeople(current => {
        const next = { ...current }
        delete next[person.id]
        return next
      })
    }
  }

  return (
    <div className="focus-view focus-friends-view">
      <FocusSectionHeading eyebrow="Study circle" title="Accountability without surveillance." detail="Live status is opt-in. Discovery uses only an exact username or verified contact match." />

      <section className={`focus-username-card ${username ? 'claimed' : ''}`}>
        <div className="focus-username-copy">
          <span>Your username</span>
          <h3>{username ? `@${username}` : 'Choose how friends find you'}</h3>
          <p>Usernames are unique across Penni; display names can repeat. You can change yours later.</p>
        </div>
        {editingUsername ? <form onSubmit={event => { event.preventDefault(); void saveUsername() }}>
          <label><span aria-hidden="true">@</span><input value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value.toLowerCase().replace(/^@/, '')); setUsernameError('') }} placeholder="your.username" aria-label="Your unique username" autoCapitalize="none" autoCorrect="off" maxLength={24} /></label>
          <button type="submit" disabled={savingUsername}>{savingUsername ? 'Saving…' : username ? 'Save' : 'Claim username'}</button>
          {username && <button type="button" className="cancel" onClick={() => { setUsernameDraft(username); setUsernameError(''); setEditingUsername(false) }}>Cancel</button>}
        </form> : <button className="edit" type="button" onClick={() => setEditingUsername(true)}>Edit username</button>}
        {usernameError && <p className="focus-username-error" role="alert">{usernameError}</p>}
      </section>

      <section className="focus-friend-lookup">
        <div><span>Find a specific person</span><h3>Exact account search</h3><p>Use an exact @username, verified email or full phone number. There is no broad name search or browsable people directory.</p></div>
        <form onSubmit={event => { event.preventDefault(); void findAccount() }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input value={query} onChange={event => { searchGenerationRef.current++; setSearching(false); setQuery(event.target.value); setSearchResults(null); setSearchError('') }} placeholder="@username, email or full phone" aria-label="Search by exact username, verified email or full phone number" autoComplete="off" autoCapitalize="none" autoCorrect="off" />
          {query && <button type="button" onClick={() => { searchGenerationRef.current++; setSearching(false); setQuery(''); setSearchResults(null); setSearchError('') }} aria-label="Clear lookup"><FontAwesomeIcon icon={faXmark} /></button>}
          <button className="find" type="submit" disabled={searching}>{searching ? 'Finding…' : 'Find'}</button>
        </form>
        {searchError && <p className="focus-lookup-error">{searchError}</p>}
        {searchResults && (searchResults.length ? <div className="focus-lookup-results">{searchResults.map(person => { const actionState = actedPeople[person.id]; const requested = actionState === 'add'; const sending = actionState === 'add:pending'; return <article key={person.id}><FocusAvatar name={person.name} initials={person.initials} avatarUrl={person.avatarUrl} /><div><b>{person.name}</b><span>{person.username ? `@${person.username}` : person.emailHint ?? person.phoneHint ?? 'Verified exact match'}</span></div><button onClick={() => { void act('add', person) }} disabled={requested || sending}><FontAwesomeIcon icon={requested ? faCheck : faPlus} /> {sending ? 'Sending…' : requested ? 'Requested' : 'Add friend'}</button></article> })}</div> : <div className="focus-lookup-empty">No opted-in Penni account matched that exact username or contact.</div>)}
      </section>

      <section className="focus-card focus-live-friends">
        <FocusSectionHeading eyebrow="Live now" title={liveFriends.length ? `${liveFriends.length} friends are studying` : 'No friends focusing right now'} detail="Only subject and elapsed focus time are visible." />
        {liveFriends.length ? <div className="focus-live-friend-grid">{liveFriends.map(person => { const nudged = actedPeople[person.id] === 'nudge'; const sending = actedPeople[person.id] === 'nudge:pending'; return <article key={person.id}><FocusAvatar name={person.name} initials={person.initials} avatarUrl={person.avatarUrl} live size="lg" /><div><span>Focusing · {person.subject}</span><h3>{person.name}</h3><p>{compactFocusTime(person.liveSeconds ?? 0)} in this block · {compactFocusTime(person.todaySeconds)} today</p></div><button className={nudged ? 'sent' : ''} onClick={() => { void act('nudge', person) }} disabled={nudged || sending}><FontAwesomeIcon icon={nudged ? faCheck : faPaperPlane} /> {sending ? 'Sending…' : nudged ? 'Nudge sent' : 'Nudge'}</button></article>})}</div> : <div className="focus-empty-inline"><FontAwesomeIcon icon={faUserGroup} /><p>Friends appear here only when they choose to share live status.</p></div>}
      </section>

      {(incoming.length > 0 || outgoing.length > 0) && <section className="focus-card focus-request-card">
        <FocusSectionHeading eyebrow="Requests" title="Manage your study circle" detail="Incoming and sent requests stay separate." />
        <div className="focus-request-list">
          {incoming.map(request => { const pending = pendingRequests.includes(request.id); return <article key={request.id}><FocusAvatar name={request.person.name} initials={request.person.initials} avatarUrl={request.person.avatarUrl} /><div><b>{request.person.name}</b><span>Incoming request · {request.person.mutualCount ?? 0} mutual</span></div><button className="accept" disabled={pending} onClick={() => { void handleRequest(request, 'accept') }}><FontAwesomeIcon icon={faCheck} /> {pending ? 'Saving…' : 'Accept'}</button><button className="decline" disabled={pending} onClick={() => { void handleRequest(request, 'decline') }} aria-label={`Decline ${request.person.name}`}><FontAwesomeIcon icon={faXmark} /></button></article> })}
          {outgoing.map(request => { const pending = pendingRequests.includes(request.id); return <article key={request.id}><FocusAvatar name={request.person.name} initials={request.person.initials} avatarUrl={request.person.avatarUrl} /><div><b>{request.person.name}</b><span>Request sent</span></div><button className="cancel" disabled={pending} onClick={() => { void handleRequest(request, 'cancel') }}><FontAwesomeIcon icon={faXmark} /> {pending ? 'Cancelling…' : 'Cancel'}</button></article> })}
        </div>
      </section>}

      <section className="focus-card focus-friend-list-card">
        <FocusSectionHeading eyebrow="Friends" title={friends.length ? `${friends.length} in your circle` : 'Your circle is empty'} detail="Remove ends the connection. Block also prevents future requests and lookup visibility between both accounts." />
        {friends.length ? <div className="focus-friend-list">{friends.map(person => { const pending = actedPeople[person.id]?.endsWith(':pending'); return <article key={person.id}><FocusAvatar name={person.name} initials={person.initials} avatarUrl={person.avatarUrl} live={person.isLive} /><div><b>{person.name}{person.username && <small> @{person.username}</small>}</b><span>{person.isLive ? `Focusing · ${person.subject}` : `${person.streak}-day streak`}</span><small>{compactFocusTime(person.weeklySeconds)} this week</small></div><button disabled={pending} onClick={() => { void act('remove', person) }}><FontAwesomeIcon icon={faTrash} /> Remove</button><button className="block" disabled={pending} onClick={() => { void act('block', person) }}><FontAwesomeIcon icon={faBan} /> Block</button></article> })}</div> : <div className="focus-empty-inline"><FontAwesomeIcon icon={faUserGroup} /><p>Use exact account search above to send your first friend request.</p></div>}
      </section>
    </div>
  )
}
