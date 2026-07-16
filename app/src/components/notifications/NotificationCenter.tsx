import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faChevronRight, faNewspaper, faUserGroup, faXmark, faListCheck } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { listFocusFriendRequests, listFocusGroupInvites } from '@/lib/focusSocialClient'

const SEEN_KEY = 'penni.notifications.seen.v1'

type SeenState = { social: string; briefing: string; practice: string }
type SocialNotice = { friendCount: number; groupCount: number; names: string[]; signature: string }

function loadSeen(): SeenState {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Partial<SeenState>
    return { social: parsed.social ?? '', briefing: parsed.briefing ?? '', practice: parsed.practice ?? '' }
  } catch {
    return { social: '', briefing: '', practice: '' }
  }
}

function saveSeen(value: SeenState) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(value)) } catch { /* noop */ }
}

export function NotificationCenter() {
  const { articlesByDate, setSelectedDate, setScreen } = useAppStore()
  const user = useAuthStore(state => state.user)
  const isGuest = useAuthStore(state => state.isGuest)
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<SeenState>(loadSeen)
  const [social, setSocial] = useState<SocialNotice>({ friendCount: 0, groupCount: 0, names: [], signature: '' })

  const dates = useMemo(() => Object.keys(articlesByDate).sort((a, b) => b.localeCompare(a)), [articlesByDate])
  const latestDate = dates[0] ?? ''
  const latestStories = useMemo(() => latestDate ? articlesByDate[latestDate] ?? [] : [], [articlesByDate, latestDate])
  const questionCount = useMemo(() => latestStories.reduce((sum, article) => sum + (article.prelimsQs?.length ?? 0), 0), [latestStories])
  const briefingSignature = latestDate ? `${latestDate}:${latestStories.map(article => article.id).join(',')}` : ''
  const practiceSignature = latestDate ? `${latestDate}:${latestStories.map(article => `${article.id}:${article.prelimsQs?.length ?? 0}`).join(',')}` : ''

  const refreshSocial = useCallback(async () => {
    if (!user || isGuest) {
      setSocial({ friendCount: 0, groupCount: 0, names: [], signature: '' })
      return
    }
    try {
      const [requestResult, groupResult] = await Promise.all([listFocusFriendRequests(), listFocusGroupInvites()])
      const incoming = requestResult.available
        ? requestResult.data.filter(request => request.status === 'pending' && request.recipientId === user.id)
        : []
      const groups = groupResult.available ? groupResult.data : []
      const signature = [
        ...incoming.map(request => `f:${request.id}`),
        ...groups.map(invite => `g:${invite.id}`),
      ].sort().join('|')
      setSocial({
        friendCount: incoming.length,
        groupCount: groups.length,
        names: incoming.map(request => request.otherProfile?.displayName).filter((name): name is string => Boolean(name)).slice(0, 2),
        signature,
      })
    } catch {
      // The centre remains useful for briefing/practice updates if Focus is
      // offline or its newest migration has not reached the server yet.
    }
  }, [isGuest, user])

  useEffect(() => {
    void refreshSocial()
    if (!user || isGuest) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshSocial() }, 60_000)
    return () => window.clearInterval(timer)
  }, [isGuest, refreshSocial, user])

  const unreadSocial = Boolean(social.signature && social.signature !== seen.social)
  const unreadBriefing = Boolean(briefingSignature && briefingSignature !== seen.briefing)
  const unreadPractice = Boolean(practiceSignature && questionCount > 0 && practiceSignature !== seen.practice)
  const unreadBlocks = Number(unreadSocial) + Number(unreadBriefing) + Number(unreadPractice)

  function openCenter() {
    const next = { social: social.signature, briefing: briefingSignature, practice: practiceSignature }
    setSeen(next)
    saveSeen(next)
    setOpen(true)
    void refreshSocial()
  }

  function openSocial() {
    try { sessionStorage.setItem('penni.focus.initial-view', social.friendCount ? 'friends' : 'groups') } catch { /* noop */ }
    setOpen(false)
    setScreen('focus')
  }

  function openBriefing() {
    if (latestDate) setSelectedDate(latestDate)
    setOpen(false)
    setScreen('feed')
  }

  function openPractice() {
    setOpen(false)
    setScreen('practice')
  }

  const portal = open ? (
    <div className="notification-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="notification-sheet" role="dialog" aria-modal="true" aria-label="Notifications">
        <i className="notification-handle" aria-hidden="true" />
        <header><div><span>Penni updates</span><h2>Notifications</h2><p>Important changes, grouped by what you can do next.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><FontAwesomeIcon icon={faXmark} /></button></header>
        <div className="notification-blocks">
          <button className="notification-block social" type="button" onClick={openSocial} disabled={!social.friendCount && !social.groupCount}>
            <i><FontAwesomeIcon icon={faUserGroup} /></i>
            <span><small>Social</small><b>{social.friendCount || social.groupCount ? `${social.friendCount + social.groupCount} request${social.friendCount + social.groupCount === 1 ? '' : 's'} waiting` : 'No requests waiting'}</b><p>{social.names.length ? `${social.names.join(' and ')} want to connect.` : social.groupCount ? `${social.groupCount} study-group invitation${social.groupCount === 1 ? '' : 's'}.` : 'Friend and group requests will appear in this block.'}</p></span>
            {(social.friendCount > 0 || social.groupCount > 0) && <FontAwesomeIcon icon={faChevronRight} />}
          </button>

          <button className="notification-block briefing" type="button" onClick={openBriefing} disabled={!latestStories.length}>
            <i><FontAwesomeIcon icon={faNewspaper} /></i>
            <span><small>Latest briefing · {latestDate || 'Not loaded'}</small><b>{latestStories.length ? `${latestStories.length} stories ready` : 'No briefing loaded'}</b>{latestStories.length ? <div className="notification-story-preview">{latestStories.slice(0, 2).map(article => <em key={article.id}>{article.headline}</em>)}</div> : <p>New daily stories will appear as one briefing block.</p>}</span>
            {latestStories.length > 0 && <FontAwesomeIcon icon={faChevronRight} />}
          </button>

          <button className="notification-block practice" type="button" onClick={openPractice} disabled={!questionCount}>
            <i><FontAwesomeIcon icon={faListCheck} /></i>
            <span><small>Practice</small><b>{questionCount ? `${questionCount} current-affairs questions` : 'No new questions'}</b><p>{questionCount ? `Built from the ${latestDate} briefing and ready in Daily MCQ.` : 'New question sets will appear here when the briefing is updated.'}</p></span>
            {questionCount > 0 && <FontAwesomeIcon icon={faChevronRight} />}
          </button>
        </div>
      </section>
    </div>
  ) : null

  return (
    <>
      <button type="button" onClick={openCenter} aria-label={unreadBlocks ? `Notifications, ${unreadBlocks} new sections` : 'Notifications'} className="glass-icon-btn top-notification-button">
        <FontAwesomeIcon icon={faBell} />
        {unreadBlocks > 0 && <i>{unreadBlocks}</i>}
      </button>
      {portal && typeof document !== 'undefined' ? createPortal(portal, document.body) : portal}
    </>
  )
}
