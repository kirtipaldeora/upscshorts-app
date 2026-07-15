import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { allDates, articlesFor, deleteArticle, saveArticle, setStatus } from '@/lib/articles'
import { emptyRow, toArticle, type ArticleRow } from '@/lib/mapArticle'
import { broadcastFeature, publishDate, qualityIssuesFor } from '@/lib/publish'
import { ArticleEditor } from './ArticleEditor'
import { ImportDialog } from './ImportDialog'

function today() {
  // IST — the pipeline dates content the same way, so the rail lines up with it.
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

interface Props {
  user: User
  role: 'admin' | 'editor'
}

export function Workspace({ user }: Props) {
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState<ArticleRow[]>([])
  const [editing, setEditing] = useState<ArticleRow | null>(null)
  const [importing, setImporting] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [featureTitle, setFeatureTitle] = useState('')
  const [featureSummary, setFeatureSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const refreshDates = useCallback(async () => {
    const list = await allDates()
    // Always offer today, even before anything exists for it.
    setDates([...new Set([today(), ...list])].sort().reverse())
  }, [])

  const refreshRows = useCallback(async (d: string) => {
    setLoading(true)
    try {
      setRows(await articlesFor(d))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load articles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refreshDates() }, [refreshDates])
  useEffect(() => { void refreshRows(date) }, [date, refreshRows])

  const published = useMemo(() => rows.filter(r => r.status === 'published'), [rows])
  const drafts = useMemo(() => rows.filter(r => r.status === 'draft'), [rows])

  // Advisory: the same gate the content pipeline uses. Strict by design, so it
  // reports rather than blocks.
  const issues = useMemo(() => qualityIssuesFor(published.map(toArticle)), [published])

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (label) {
        setFlash(label)
        window.setTimeout(() => setFlash(''), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <h1>Penni <span>CMS</span></h1>
        <div className="spacer" />
        <span className="who">{user.email}</span>
        <button className="btn sm" onClick={() => setAnnouncing(true)}>Announce feature</button>
        <button className="btn sm" onClick={() => supabase().auth.signOut()}>Sign out</button>
      </div>

      <div className="body">
        <div className="rail">
          <h2>Dates</h2>
          {dates.map(d => (
            <button key={d} className={`date-btn ${d === date ? 'on' : ''}`} onClick={() => setDate(d)}>
              {d === today() && <span className="dot" title="Today" />}
              {d}
            </button>
          ))}
        </div>

        <div className="main">
          {error && <div className="notice bad">{error}</div>}
          {flash && <div className="notice good">{flash}</div>}

          <div className="bar">
            <span className="summary">
              <b>{date}</b> — {published.length} published, {drafts.length} draft
            </span>
            <div className="spacer" />
            <button className="btn sm" onClick={() => setImporting(true)}>Import JSON</button>
            <button className="btn sm" onClick={() => setEditing(emptyRow(date))}>New article</button>
            <button
              className="btn primary sm"
              disabled={busy}
              onClick={() => run(
                '',
                async () => {
                  const result = await publishDate(date)
                  const delivery = result.notificationError
                    ? ' Content is live, but subscriber alerts failed—check the notification function.'
                    : result.notifications
                      ? ` Alerts delivered: ${result.notifications.email} email, ${result.notifications.whatsapp} WhatsApp.`
                      : ' No subscriber alert was sent because this date has no published articles.'
                  setFlash(`Published ${published.length} article${published.length === 1 ? '' : 's'} for ${date}. Live within a minute.${delivery}`)
                  window.setTimeout(() => setFlash(''), 5000)
                },
              )}
            >
              {busy ? 'Publishing…' : 'Publish this date'}
            </button>
          </div>

          {issues.length > 0 && (
            <div className="notice warn">
              <b>{issues.length} quality {issues.length === 1 ? 'flag' : 'flags'}</b> on published
              articles — advisory only, publishing is not blocked.
              <ul>
                {issues.slice(0, 6).map((issue, i) => (
                  <li key={i}><b>{issue.headline || issue.articleId}</b> ({issue.field}): {issue.reason}</li>
                ))}
                {issues.length > 6 && <li>…and {issues.length - 6} more.</li>}
              </ul>
            </div>
          )}

          {loading ? (
            <div className="empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="empty">
              Nothing for {date} yet. Import the pipeline's JSON, or add an article by hand.
            </div>
          ) : (
            rows.map(row => (
              <div className="card" key={row.id}>
                <div className="card-head">
                  <span className={`tag ${row.status}`}>{row.status}</span>
                  <h3>{row.headline || <i style={{ color: 'var(--ink-3)' }}>Untitled</i>}</h3>
                  <button className="btn sm" onClick={() => setEditing(row)}>Edit</button>
                  <button
                    className="btn sm"
                    disabled={busy}
                    onClick={() => run(
                      row.status === 'published' ? 'Moved to draft. Re-publish the date to apply.' : 'Marked published. Publish the date to push it live.',
                      async () => {
                        await setStatus(row.id, row.status === 'published' ? 'draft' : 'published')
                        await refreshRows(date)
                      },
                    )}
                  >
                    {row.status === 'published' ? 'Unpublish' : 'Mark published'}
                  </button>
                  <button
                    className="btn sm danger"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Delete "${row.headline || row.id}"? This cannot be undone.`)) return
                      void run('Article deleted. Re-publish the date to apply.', async () => {
                        await deleteArticle(row.id)
                        await refreshRows(date)
                      })
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="meta">
                  {row.category} · {row.gs_paper} · {row.source || 'no source'}
                  {Array.isArray(row.prelims_qs) && row.prelims_qs.length > 0 && ` · ${row.prelims_qs.length} MCQ`}
                  {row.audio_script && ' · audio'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <ArticleEditor
          row={editing}
          onCancel={() => setEditing(null)}
          onSave={async next => {
            await run('Saved.', async () => {
              await saveArticle(next)
              setEditing(null)
              await refreshDates()
              await refreshRows(date)
            })
          }}
        />
      )}

      {importing && (
        <ImportDialog
          date={date}
          onClose={() => setImporting(false)}
          onImported={async count => {
            setImporting(false)
            await refreshDates()
            await refreshRows(date)
            setFlash(`Imported ${count} article${count === 1 ? '' : 's'} as drafts.`)
            window.setTimeout(() => setFlash(''), 3000)
          }}
        />
      )}

      {announcing && (
        <div className="modal-bg" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAnnouncing(false) }}>
          <div className="modal feature-announcement" role="dialog" aria-modal="true" aria-labelledby="feature-announcement-title">
            <div className="modal-head">
              <h2 id="feature-announcement-title">Announce a Penni feature</h2>
              <button className="btn sm" onClick={() => setAnnouncing(false)}>Close</button>
            </div>
            <div className="modal-body">
              <div className="notice warn">This sends immediately to every student who opted in, using their enabled email and WhatsApp channels.</div>
              <div className="field">
                <label htmlFor="feature-title">Feature title</label>
                <input id="feature-title" value={featureTitle} maxLength={90} onChange={event => setFeatureTitle(event.target.value)} placeholder="New revision planner" />
              </div>
              <div className="field">
                <label htmlFor="feature-summary">Short summary</label>
                <textarea id="feature-summary" value={featureSummary} maxLength={280} rows={4} onChange={event => setFeatureSummary(event.target.value)} placeholder="Tell students what changed and why it is useful." />
                <div className="hint">{featureSummary.length}/280 characters</div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setAnnouncing(false)}>Cancel</button>
              <button
                className="btn primary"
                disabled={busy || !featureTitle.trim() || !featureSummary.trim()}
                onClick={() => void run('', async () => {
                  const result = await broadcastFeature(featureTitle, featureSummary)
                  setAnnouncing(false)
                  setFeatureTitle('')
                  setFeatureSummary('')
                  setFlash(`Feature announced: ${result.email} email, ${result.whatsapp} WhatsApp delivered.`)
                  window.setTimeout(() => setFlash(''), 5000)
                })}
              >
                {busy ? 'Sending…' : 'Send announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
