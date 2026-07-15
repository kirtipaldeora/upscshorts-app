import { useState } from 'react'
import type { PrelimQuestion } from '@penni/types/article'
import { CATEGORIES, GS_PAPERS, type ArticleRow } from '@/lib/mapArticle'

interface Props {
  row: ArticleRow
  onCancel: () => void
  onSave: (row: ArticleRow) => Promise<void>
}

function asQuestions(value: unknown): PrelimQuestion[] {
  return Array.isArray(value) ? (value as PrelimQuestion[]) : []
}

function asDeepDive(value: unknown): { explanation: string; possibleMainsQuestion: string } {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    possibleMainsQuestion: typeof raw.possibleMainsQuestion === 'string' ? raw.possibleMainsQuestion : '',
  }
}

function asLocation(value: unknown): { lat: string; lon: string; place: string } {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    lat: typeof raw.lat === 'number' ? String(raw.lat) : '',
    lon: typeof raw.lon === 'number' ? String(raw.lon) : '',
    place: typeof raw.place === 'string' ? raw.place : '',
  }
}

export function ArticleEditor({ row, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<ArticleRow>(row)
  const [deepDive, setDeepDive] = useState(asDeepDive(row.deep_dive))
  const [questions, setQuestions] = useState<PrelimQuestion[]>(asQuestions(row.prelims_qs))
  const [keyTerms, setKeyTerms] = useState((row.key_terms ?? []).join(', '))
  const [location, setLocation] = useState(asLocation(row.location))
  const [busy, setBusy] = useState(false)

  function set<K extends keyof ArticleRow>(key: K, value: ArticleRow[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function setQuestion(i: number, patch: Partial<PrelimQuestion>) {
    setQuestions(qs => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  }

  async function save() {
    setBusy(true)
    // A location is only emitted when both coordinates parse — a half-filled
    // one would put a pin at (0,0) in the Atlas globe.
    const lat = Number(location.lat)
    const lon = Number(location.lon)
    const hasLocation = location.lat.trim() !== '' && location.lon.trim() !== '' &&
      Number.isFinite(lat) && Number.isFinite(lon)
    try {
      await onSave({
        ...draft,
        deep_dive: deepDive,
        prelims_qs: questions,
        key_terms: keyTerms.split(',').map(t => t.trim()).filter(Boolean),
        location: hasLocation ? { lat, lon, place: location.place } : null,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{row.headline ? 'Edit article' : 'New article'}</h2>
          <span className={`tag ${draft.status}`}>{draft.status}</span>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Headline</label>
            <input value={draft.headline} onChange={e => set('headline', e.target.value)} autoFocus />
          </div>

          <div className="row">
            <div className="field">
              <label>Date</label>
              <input type="date" value={draft.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Source</label>
              <input value={draft.source} onChange={e => set('source', e.target.value)} placeholder="The Hindu" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Category</label>
              <select value={draft.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>GS paper</label>
              <select value={draft.gs_paper} onChange={e => set('gs_paper', e.target.value)}>
                {GS_PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Order</label>
              <input
                type="number"
                value={draft.sort_order}
                onChange={e => set('sort_order', Number(e.target.value) || 0)}
              />
              <div className="hint">Lower shows first.</div>
            </div>
          </div>

          <div className="field">
            <label>Summary</label>
            <textarea value={draft.summary} onChange={e => set('summary', e.target.value)} />
          </div>

          <div className="field">
            <label>Why it matters</label>
            <textarea value={draft.why_it_matters} onChange={e => set('why_it_matters', e.target.value)} />
          </div>

          <div className="field">
            <label>Deep dive — explanation</label>
            <textarea
              rows={10}
              value={deepDive.explanation}
              onChange={e => setDeepDive(d => ({ ...d, explanation: e.target.value }))}
            />
            <div className="hint">HTML. Penni renders this directly, including &lt;strong&gt; section headings.</div>
          </div>

          <div className="field">
            <label>Deep dive — possible mains question</label>
            <textarea
              rows={2}
              value={deepDive.possibleMainsQuestion}
              onChange={e => setDeepDive(d => ({ ...d, possibleMainsQuestion: e.target.value }))}
            />
          </div>

          <div className="field">
            <label>Penni Explain script (English)</label>
            <textarea
              rows={6}
              value={draft.audio_script ?? ''}
              onChange={e => set('audio_script', e.target.value || null)}
            />
            <div className="hint">Spoken narration. Plain text, no HTML. Roughly 450–900 words.</div>
          </div>

          <div className="field">
            <label>Penni Explain script (Hinglish)</label>
            <textarea
              rows={6}
              value={draft.audio_script_hi ?? ''}
              onChange={e => set('audio_script_hi', e.target.value || null)}
            />
          </div>

          <div className="field">
            <label>Key terms</label>
            <input value={keyTerms} onChange={e => setKeyTerms(e.target.value)} placeholder="repo rate, MPC, inflation" />
            <div className="hint">Comma separated.</div>
          </div>

          <div className="field">
            <label>Location (news globe)</label>
            <div className="row">
              <input placeholder="lat" value={location.lat} onChange={e => setLocation(l => ({ ...l, lat: e.target.value }))} />
              <input placeholder="lon" value={location.lon} onChange={e => setLocation(l => ({ ...l, lon: e.target.value }))} />
              <input placeholder="place" value={location.place} onChange={e => setLocation(l => ({ ...l, place: e.target.value }))} />
            </div>
            <div className="hint">Leave blank to keep this story off the globe.</div>
          </div>

          <div className="field">
            <label>Prelims MCQs ({questions.length})</label>
            {questions.map((q, i) => (
              <div className="card" key={i} style={{ marginTop: 8 }}>
                <div className="field">
                  <label>Q{i + 1} stem</label>
                  <textarea rows={3} value={q.q} onChange={e => setQuestion(i, { q: e.target.value })} />
                </div>
                {q.options.map((opt, oi) => (
                  <div className="field" key={oi}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="radio"
                        style={{ width: 'auto' }}
                        checked={q.answer === oi}
                        onChange={() => setQuestion(i, { answer: oi })}
                      />
                      Option {String.fromCharCode(65 + oi)} {q.answer === oi && '· correct'}
                    </label>
                    <input
                      value={opt}
                      onChange={e => setQuestion(i, {
                        options: q.options.map((o, oj) => (oj === oi ? e.target.value : o)),
                      })}
                    />
                  </div>
                ))}
                <div className="field">
                  <label>Explanation</label>
                  <textarea rows={3} value={q.explanation} onChange={e => setQuestion(i, { explanation: e.target.value })} />
                </div>
                <button
                  className="btn sm danger"
                  onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                >
                  Remove Q{i + 1}
                </button>
              </div>
            ))}
            <button
              className="btn sm"
              style={{ marginTop: 8 }}
              onClick={() => setQuestions(qs => [...qs, { q: '', options: ['', '', '', ''], answer: 0, explanation: '' }])}
            >
              Add MCQ
            </button>
          </div>
        </div>

        <div className="modal-foot">
          <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={draft.status === 'published'}
              onChange={e => set('status', e.target.checked ? 'published' : 'draft')}
            />
            Published
          </label>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={busy || !draft.headline.trim()} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
