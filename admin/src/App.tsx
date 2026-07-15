import { useSession } from '@/hooks/useSession'
import { supabase } from '@/lib/supabase'
import { SignIn } from '@/components/SignIn'
import { Workspace } from '@/components/Workspace'

export default function App() {
  const session = useSession()

  if (session.phase === 'loading') {
    return <div className="gate"><div className="gate-card"><p>Loading…</p></div></div>
  }

  if (session.phase === 'unconfigured') {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Penni <span>CMS</span></h1>
          <p>Supabase isn't configured for this build.</p>
          <p>
            Copy <code>admin/.env.example</code> to <code>admin/.env</code>, fill in your project's
            URL and anon key, then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  if (session.phase === 'signed-out') return <SignIn />

  // Signed in, but no `editors` row — every write would be rejected by RLS.
  // Show the user id so it can be pasted straight into the seed statement.
  if (session.phase === 'not-an-editor') {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Not an editor</h1>
          <p>
            <b>{session.user.email}</b> is signed in but has no editor access.
            Add a row in the <code>editors</code> table:
          </p>
          <div className="field">
            <textarea
              readOnly
              rows={4}
              onFocus={e => e.currentTarget.select()}
              value={`insert into editors (user_id, email, role)\nvalues ('${session.user.id}', '${session.user.email}', 'admin');`}
            />
          </div>
          <button className="btn" onClick={() => supabase().auth.signOut()}>Sign out</button>
        </div>
      </div>
    )
  }

  return <Workspace user={session.user} role={session.role} />
}
