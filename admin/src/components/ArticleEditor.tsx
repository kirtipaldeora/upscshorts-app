import { useState } from 'react'
import type { DeepDive, DeepDiveHindi, PrelimQuestion } from '@penni/types/article'
import { CATEGORIES, GS_PAPERS, type ArticleRow } from '@/lib/mapArticle'

interface Props {
  row: ArticleRow
  onCancel: () => void
  onSave: (row: ArticleRow) => Promise<void>
}

function asQuestions(value: unknown): PrelimQuestion[] {
  return Array.isArray(value) ? (value as PrelimQuestion[]) : []
}

type EditableDeepDive = Omit<Required<DeepDive>, 'hindi'> & { hindi: DeepDiveHindi }

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asConcepts(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const concept = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return typeof concept.term === 'string' && typeof concept.definition === 'string'
          ? [{ term: concept.term, definition: concept.definition }]
          : []
      })
    : []
}

function asHindiDeepDive(value: unknown): DeepDiveHindi {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    syllabusLinkage: typeof raw.syllabusLinkage === 'string' ? raw.syllabusLinkage : '',
    context: typeof raw.context === 'string' ? raw.context : '',
    keyHighlights: asStringList(raw.keyHighlights),
    keyConcepts: asConcepts(raw.keyConcepts),
    wayForward: asStringList(raw.wayForward),
    possibleMainsQuestion: typeof raw.possibleMainsQuestion === 'string' ? raw.possibleMainsQuestion : '',
  }
}

function asDeepDive(value: unknown): EditableDeepDive {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    syllabusLinkage: typeof raw.syllabusLinkage === 'string' ? raw.syllabusLinkage : '',
    context: typeof raw.context === 'string' ? raw.context : '',
    keyHighlights: asStringList(raw.keyHighlights),
    keyConcepts: asConcepts(raw.keyConcepts),
    wayForward: asStringList(raw.wayForward),
    hindi: asHindiDeepDive(raw.hindi),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    possibleMainsQuestion: typeof raw.possibleMainsQuestion === 'string' ? raw.possibleMainsQuestion : '',
  }
}

function lines(value: string): string[] {
  return value.split('\n').map(item => item.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean)
}

function conceptLines(value: string) {
  return lines(value).flatMap(line => {
    const divider = line.indexOf('|')
    if (divider < 1) return []
    const term = line.slice(0, divider).trim()
    const definition = line.slice(divider + 1).trim()
    return term && definition ? [{ term, definition }] : []
  })
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
            <label>Deep dive — syllabus linkage</label>
            <input
              value={deepDive.syllabusLinkage}
              onChange={e => setDeepDive(d => ({ ...d, syllabusLinkage: e.target.value }))}
              placeholder="GS II: Bilateral Relations; GS III: International Trade"
            />
          </div>

          <div className="field">
            <label>Deep dive — context</label>
            <textarea
              rows={3}
              value={deepDive.context}
              onChange={e => setDeepDive(d => ({ ...d, context: e.target.value }))}
            />
            <div className="hint">Two or three direct sentences: what happened and why it is significant.</div>
          </div>

          <div className="field">
            <label>Deep dive — key highlights</label>
            <textarea
              rows={6}
              value={deepDive.keyHighlights.join('\n')}
              onChange={e => setDeepDive(d => ({ ...d, keyHighlights: lines(e.target.value) }))}
            />
            <div className="hint">One factual point per line. Use 4–6 points.</div>
          </div>

          <div className="field">
            <label>Deep dive — key concepts</label>
            <textarea
              rows={6}
              value={deepDive.keyConcepts.map(concept => `${concept.term} | ${concept.definition}`).join('\n')}
              onChange={e => setDeepDive(d => ({ ...d, keyConcepts: conceptLines(e.target.value) }))}
            />
            <div className="hint">One per line as Term | plain-English definition.</div>
          </div>

          <div className="field">
            <label>Deep dive — way forward</label>
            <textarea
              rows={6}
              value={deepDive.wayForward.join('\n')}
              onChange={e => setDeepDive(d => ({ ...d, wayForward: lines(e.target.value) }))}
            />
            <div className="hint">One practical action per line. Use 3–6 points.</div>
          </div>

          <div className="field">
            <label>Supporting explanation (optional)</label>
            <textarea
              rows={6}
              value={deepDive.explanation}
              onChange={e => setDeepDive(d => ({ ...d, explanation: e.target.value }))}
            />
            <div className="hint">Used for narration and compatibility with older articles. It is not shown as extra headings in the study note.</div>
          </div>

          <div className="field">
            <label>Deep dive — possible mains question</label>
            <textarea
              rows={2}
              value={deepDive.possibleMainsQuestion}
              onChange={e => setDeepDive(d => ({ ...d, possibleMainsQuestion: e.target.value }))}
            />
          </div>

          <div className="card" style={{ margin: '18px 0', padding: 16 }}>
            <div className="modal-head" style={{ padding: 0, marginBottom: 14 }}>
              <h2 style={{ fontSize: 16 }}>Deep Dive — Hindi translation</h2>
            </div>
            <div className="hint" style={{ marginBottom: 14 }}>
              Translate the verified English note faithfully. Preserve all facts, names, numbers, concept order and bullet counts; do not add new information.
            </div>

            <div className="field">
              <label>पाठ्यक्रम संबंध</label>
              <input
                value={deepDive.hindi.syllabusLinkage}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, syllabusLinkage: e.target.value } }))}
                placeholder="GS II: द्विपक्षीय संबंध; GS III: अंतरराष्ट्रीय व्यापार"
              />
            </div>

            <div className="field">
              <label>संदर्भ</label>
              <textarea
                rows={3}
                value={deepDive.hindi.context}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, context: e.target.value } }))}
              />
            </div>

            <div className="field">
              <label>मुख्य बिंदु</label>
              <textarea
                rows={6}
                value={deepDive.hindi.keyHighlights.join('\n')}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, keyHighlights: lines(e.target.value) } }))}
              />
              <div className="hint">English Key Highlights के समान संख्या और क्रम रखें।</div>
            </div>

            <div className="field">
              <label>प्रमुख अवधारणाएँ</label>
              <textarea
                rows={6}
                value={deepDive.hindi.keyConcepts.map(concept => `${concept.term} | ${concept.definition}`).join('\n')}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, keyConcepts: conceptLines(e.target.value) } }))}
              />
              <div className="hint">Term को English जैसा ही रखें; `Term | स्वाभाविक हिन्दी परिभाषा` लिखें।</div>
            </div>

            <div className="field">
              <label>आगे की राह</label>
              <textarea
                rows={6}
                value={deepDive.hindi.wayForward.join('\n')}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, wayForward: lines(e.target.value) } }))}
              />
              <div className="hint">English Way Forward के समान संख्या और क्रम रखें।</div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>संभावित मुख्य परीक्षा प्रश्न</label>
              <textarea
                rows={2}
                value={deepDive.hindi.possibleMainsQuestion}
                onChange={e => setDeepDive(d => ({ ...d, hindi: { ...d.hindi, possibleMainsQuestion: e.target.value } }))}
              />
            </div>
          </div>

          <div className="field">
            <label>Penni Explain script (English)</label>
            <textarea
              rows={6}
              value={draft.audio_script ?? ''}
              onChange={e => set('audio_script', e.target.value || null)}
            />
            <div className="hint">Calm spoken explanation. Plain text, no labels or HTML. Target 300–450 words.</div>
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
