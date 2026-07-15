import { useState } from 'react'
import type { Article } from '@penni/types/article'
import { saveArticles } from '@/lib/articles'
import { toRow } from '@/lib/mapArticle'

interface Props {
  date: string
  onClose: () => void
  onImported: (count: number) => void
}

/**
 * Brings the news pipeline's output into the CMS.
 *
 * The pipeline still writes app/public/data/articles/<date>.json to the repo —
 * it was left alone deliberately. This is the bridge: drop that file in and its
 * articles land as drafts to review, edit and publish.
 */
export function ImportDialog({ date, onClose, onImported }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [overrideDate, setOverrideDate] = useState(true)

  async function readFile(file: File) {
    setText(await file.text())
    setError('')
  }

  async function importNow() {
    setBusy(true)
    setError('')
    try {
      const parsed: unknown = JSON.parse(text)
      // The pipeline writes { "<date>": Article[] }. A bare array is also
      // accepted so a hand-assembled list works.
      const list: unknown = Array.isArray(parsed)
        ? parsed
        : Object.values(parsed as Record<string, unknown>).flat()

      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('No articles found. Expected { "<date>": [ … ] }, or a bare array of articles.')
      }

      const articles = list as Article[]
      const bad = articles.findIndex(a => !a?.id || !a?.headline)
      if (bad >= 0) throw new Error(`Entry ${bad + 1} has no id or headline — is this an articles pack?`)

      // Imports always land as drafts, never straight to published: the point of
      // the CMS is that a human sees the pipeline's output before students do.
      const rows = articles.map((a, i) =>
        toRow(overrideDate ? { ...a, date } : a, 'draft', i),
      )
      await saveArticles(rows)
      onImported(rows.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that JSON.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-head"><h2>Import articles JSON</h2></div>

        <div className="modal-body">
          <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 0 }}>
            Paste or upload a pack written by{' '}
            <code style={{ fontSize: 12 }}>scripts/news-pipeline/run.mjs</code> — normally{' '}
            <code style={{ fontSize: 12 }}>app/public/data/articles/{date}.json</code>. Everything
            imports as a draft.
          </p>

          {error && <div className="notice bad">{error}</div>}

          <div className="field">
            <label>File</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f) }}
            />
          </div>

          <div className="field">
            <label>…or paste JSON</label>
            <textarea rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="[ { &quot;id&quot;: … } ]" />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={overrideDate} onChange={e => setOverrideDate(e.target.checked)} />
            Force every article onto {date}
          </label>
          <div className="hint" style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 4 }}>
            Uncheck to keep each article's own date field.
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !text.trim()} onClick={importNow}>
            {busy ? 'Importing…' : 'Import as drafts'}
          </button>
        </div>
      </div>
    </div>
  )
}
