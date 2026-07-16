import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleNotch, faLock, faUserGroup, faUserPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import {
  acceptFocusInviteLink,
  resolveFocusInviteLink,
  type FocusInvitePreview,
  type FocusResult,
} from '@/lib/focusSocialClient'
import { FocusAvatar } from './FocusPrimitives'

interface FocusInvitePromptProps {
  token: string
  onDismiss: () => void
  onAccepted: (kind: 'friend' | 'group', status: string) => void
}

function dataFrom<T>(result: FocusResult<T>) {
  if (!result.available) throw new Error('Connect to the internet and sign in to open this invitation.')
  return result.data
}

function messageFrom(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/schema cache|could not find the function|does not exist/i.test(message)) return 'QR invitations need the latest Focus service update.'
  return message || 'This invitation could not be opened.'
}

export function FocusInvitePrompt({ token, onDismiss, onAccepted }: FocusInvitePromptProps) {
  const [preview, setPreview] = useState<FocusInvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void resolveFocusInviteLink(token)
      .then(result => {
        if (!active) return
        const next = dataFrom(result)
        if (!next) throw new Error('This invitation has expired or was replaced with a newer QR.')
        setPreview(next)
      })
      .catch(problem => active && setError(messageFrom(problem)))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [token])

  async function accept() {
    if (!preview || accepting) return
    setAccepting(true)
    setError('')
    try {
      const status = dataFrom(await acceptFocusInviteLink(token))
      if (!status) throw new Error('The invitation could not be accepted.')
      onAccepted(preview.kind, status)
    } catch (problem) {
      setError(messageFrom(problem))
      setAccepting(false)
    }
  }

  const alreadyConnected = preview?.kind === 'friend' && preview.relationship === 'friend'
  const requestPending = preview?.kind === 'friend' && preview.relationship === 'outgoing'
  const alreadyMember = preview?.kind === 'group' && preview.viewerIsMember
  const noAction = alreadyConnected || requestPending || alreadyMember || preview?.relationship === 'self'

  return (
    <div className="focus-invite-prompt-backdrop">
      <section className="focus-invite-prompt" role="dialog" aria-modal="true" aria-label="Penni Focus invitation" aria-busy={loading || accepting}>
        <button className="focus-invite-prompt-close" type="button" onClick={onDismiss} aria-label="Close invitation"><FontAwesomeIcon icon={faXmark} /></button>
        {loading ? <div className="focus-invite-prompt-loading"><FontAwesomeIcon icon={faCircleNotch} spin /><b>Opening secure invitation…</b></div> : preview ? (
          <>
            {preview.kind === 'friend' ? (
              <div className="focus-invite-prompt-person"><FocusAvatar name={preview.inviterDisplayName} initials={preview.inviterDisplayName.slice(0, 2).toUpperCase()} avatarUrl={preview.inviterAvatarUrl} size="lg" /><i><FontAwesomeIcon icon={faUserPlus} /></i></div>
            ) : <div className="focus-invite-prompt-group"><FontAwesomeIcon icon={faUserGroup} /></div>}
            <span>{preview.kind === 'friend' ? 'Friend invitation' : preview.groupCategory}</span>
            <h2>{preview.kind === 'friend' ? preview.inviterDisplayName : preview.groupName}</h2>
            {preview.kind === 'friend' ? <p>{preview.inviterUsername ? `@${preview.inviterUsername} wants to connect for Focus accountability.` : 'Confirm before sending a friend request.'}</p>
              : <p>{preview.groupMemberCount}/{preview.groupCapacity} members · {preview.groupPrivacy} study group</p>}
            <div className="focus-invite-prompt-safety"><FontAwesomeIcon icon={faLock} /><span>{preview.kind === 'friend' ? 'Nothing is added automatically. The request will also appear in both Friends inboxes.' : 'This link was created by a group admin and expires automatically.'}</span></div>
            {error && <p className="focus-invite-prompt-error" role="alert">{error}</p>}
            <button className="focus-invite-prompt-accept" type="button" disabled={accepting || noAction} onClick={() => void accept()}>
              {accepting ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Saving…</>
                : noAction ? <><FontAwesomeIcon icon={faCheck} />{alreadyMember ? 'Already in this group' : requestPending ? 'Request already sent' : alreadyConnected ? 'Already friends' : 'This is your QR'}</>
                  : preview.kind === 'group' ? 'Join study group' : preview.relationship === 'incoming' ? 'Accept friend request' : 'Send friend request'}
            </button>
            <button className="focus-invite-prompt-later" type="button" onClick={onDismiss}>{noAction ? 'Close' : 'Not now'}</button>
          </>
        ) : (
          <div className="focus-invite-prompt-unavailable"><FontAwesomeIcon icon={faUserPlus} /><h2>Invite unavailable</h2><p>{error}</p><button type="button" onClick={onDismiss}>Close</button></div>
        )}
      </section>
    </div>
  )
}
