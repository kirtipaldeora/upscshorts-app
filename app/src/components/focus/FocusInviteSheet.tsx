import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faCircleNotch,
  faCopy,
  faLink,
  faQrcode,
  faRotate,
  faShareNodes,
  faUserPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { FocusInviteShare } from './focusTypes'

interface FocusInviteSheetProps {
  kind: 'friend' | 'group'
  groupId?: string
  title: string
  detail: string
  handle?: string
  restoreFocusTo: HTMLElement
  onClose: () => void
  onCreate: (kind: 'friend' | 'group', groupId?: string) => Promise<FocusInviteShare>
  onDirectInvite?: (exactContact: string) => boolean | Promise<boolean>
}

type Feedback = { tone: 'idle' | 'success' | 'error'; message: string }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function FocusInviteSheet({
  kind,
  groupId,
  title,
  detail,
  handle,
  restoreFocusTo,
  onClose,
  onCreate,
  onDirectInvite,
}: FocusInviteSheetProps) {
  const [tab, setTab] = useState<'share' | 'direct'>('share')
  const [share, setShare] = useState<FocusInviteShare | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback>({ tone: 'idle', message: '' })
  const [contact, setContact] = useState('')
  const [directBusy, setDirectBusy] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)

  async function generate() {
    setLoading(true)
    setShare(null)
    setQrDataUrl('')
    setFeedback({ tone: 'idle', message: '' })
    try {
      const created = await onCreate(kind, groupId)
      const dataUrl = await QRCode.toDataURL(created.url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 420,
        color: { dark: '#101933', light: '#ffffff' },
      })
      setShare(created)
      setQrDataUrl(dataUrl)
    } catch (error) {
      setFeedback({ tone: 'error', message: errorMessage(error, 'The secure invite could not be created. Try again.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void generate()
    // Generate once for the invite target represented by this mounted sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, groupId])

  useEffect(() => {
    const previous = restoreFocusTo
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [onClose, restoreFocusTo])

  async function copyLink() {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share.url)
      setFeedback({ tone: 'success', message: 'Invite link copied.' })
    } catch {
      linkRef.current?.focus()
      linkRef.current?.select()
      setFeedback({ tone: 'error', message: 'Select the link above and copy it manually.' })
    }
  }

  async function shareLink() {
    if (!share) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: kind === 'group' ? title : `Connect with ${handle ? `@${handle}` : 'me'} on Penni`,
          text: kind === 'group' ? 'Join my Penni Focus study group.' : 'Add me to your Penni Focus circle.',
          url: share.url,
        })
        setFeedback({ tone: 'success', message: 'Invite ready to share.' })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copyLink()
  }

  async function sendDirect(event: FormEvent) {
    event.preventDefault()
    if (!onDirectInvite || directBusy) return
    const raw = contact.trim()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
    const phone = raw.replace(/[\s()-]/g, '')
    const isPhone = /^\+?[1-9]\d{7,14}$/.test(phone)
    if (!isEmail && !isPhone) {
      setFeedback({ tone: 'error', message: 'Enter a complete email address or full phone number with country code.' })
      return
    }
    setDirectBusy(true)
    setFeedback({ tone: 'idle', message: '' })
    try {
      const sent = await onDirectInvite(isEmail ? raw.toLowerCase() : phone)
      if (!sent) throw new Error('No invitation was sent. Check the contact and try again.')
      setContact('')
      setFeedback({ tone: 'success', message: 'Private group invitation sent.' })
    } catch (error) {
      setFeedback({ tone: 'error', message: errorMessage(error, 'The invitation could not be sent. Try again.') })
    } finally {
      setDirectBusy(false)
    }
  }

  const content = (
    <div className="focus-invite-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="focus-invite-sheet" role="dialog" aria-modal="true" aria-label={title} aria-busy={loading || directBusy} tabIndex={-1}>
        <i className="focus-invite-handle" aria-hidden="true" />
        <header>
          <div><span>{kind === 'group' ? 'Study group invite' : 'Your friend QR'}</span><h3>{title}</h3><p>{detail}</p></div>
          <button type="button" onClick={onClose} aria-label="Close invitation"><FontAwesomeIcon icon={faXmark} /></button>
        </header>

        {onDirectInvite && (
          <nav className="focus-invite-tabs" aria-label="Invitation method">
            <button type="button" className={tab === 'share' ? 'active' : ''} onClick={() => { setTab('share'); setFeedback({ tone: 'idle', message: '' }) }}><FontAwesomeIcon icon={faQrcode} /> QR &amp; link</button>
            <button type="button" className={tab === 'direct' ? 'active' : ''} onClick={() => { setTab('direct'); setFeedback({ tone: 'idle', message: '' }) }}><FontAwesomeIcon icon={faUserPlus} /> Email or phone</button>
          </nav>
        )}

        <div className="focus-invite-body">
          {tab === 'share' ? (
            <>
              <div className={`focus-invite-qr ${loading ? 'loading' : ''}`}>
                {loading ? <span><FontAwesomeIcon icon={faCircleNotch} spin /><b>Creating a secure QR…</b></span>
                  : qrDataUrl ? <img src={qrDataUrl} alt={kind === 'group' ? `QR code to join ${title}` : 'QR code to send a Penni friend request'} />
                    : <span className="error"><FontAwesomeIcon icon={faQrcode} /><b>QR unavailable</b></span>}
              </div>

              {share && (
                <>
                  <label className="focus-invite-link"><FontAwesomeIcon icon={faLink} /><input ref={linkRef} value={share.url} readOnly aria-label="Invitation link" /></label>
                  <div className="focus-invite-actions">
                    <button type="button" onClick={() => void copyLink()}><FontAwesomeIcon icon={faCopy} /><span>Copy link</span></button>
                    <button type="button" className="primary" onClick={() => void shareLink()}><FontAwesomeIcon icon={faShareNodes} /><span>Share</span></button>
                  </div>
                  <div className="focus-invite-meta"><span>{kind === 'group' ? 'Anyone with this link can request entry until it expires.' : 'Scanning opens your profile and asks the other person to confirm.'}</span><b>Expires {new Date(share.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b></div>
                </>
              )}
              {!loading && !share && <button type="button" className="focus-invite-retry" onClick={() => void generate()}><FontAwesomeIcon icon={faRotate} /> Try again</button>}
            </>
          ) : (
            <form className="focus-invite-direct" onSubmit={event => void sendDirect(event)} noValidate>
              <div className="focus-invite-direct-icon"><FontAwesomeIcon icon={faUserPlus} /></div>
              <h4>Send a private invitation</h4>
              <p>Use the exact verified email or full phone number. Penni never exposes whether a different account owns that contact.</p>
              <label><span>Email or full phone number</span><input value={contact} onChange={event => { setContact(event.target.value); setFeedback({ tone: 'idle', message: '' }) }} placeholder="name@example.com or +91…" inputMode="email" autoCapitalize="none" autoCorrect="off" /></label>
              <button type="submit" className="primary" disabled={directBusy || !contact.trim()}>{directBusy ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Sending…</> : 'Send private invite'}</button>
            </form>
          )}

          {feedback.message && <p className={`focus-invite-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.tone === 'success' && <FontAwesomeIcon icon={faCheck} />}{feedback.message}</p>}
        </div>
      </section>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
