import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Email magic link. Penni's own login uses Google/Apple OAuth and phone OTP,
 * but those need provider setup per redirect origin; the CMS is a handful of
 * people on a different domain, and email links work with no extra config.
 */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h1>Penni <span>CMS</span></h1>
        {sent ? (
          <>
            <p>Check <b>{email}</b> for a sign-in link. You can close this tab.</p>
            <button className="btn" onClick={() => setSent(false)}>Use a different email</button>
          </>
        ) : (
          <form onSubmit={send}>
            <p>Sign in to edit Penni's content.</p>
            {error && <div className="notice bad">{error}</div>}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="btn primary" type="submit" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
