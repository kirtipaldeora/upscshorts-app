import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faXmark,
  faPlus,
  faWandMagicSparkles,
  faCircleNotch,
  faFilePdf,
  faKey,
  faTriangleExclamation,
  faCloudArrowUp,
} from '@fortawesome/free-solid-svg-icons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { idbPut, idbGet } from '@/hooks/useMainsDB'
import type { MainsQuestion } from '@/utils/practiceUtils'
import type { MainsEval, MainsRecord } from '@/hooks/useMainsDB'
import { TODAY } from '@/constants/categories'

interface MainsDetailProps {
  question: MainsQuestion
  onClose: () => void
  onShowToast: (msg: string) => void
  onOpenSettings: () => void
}

interface UploadedAnswer {
  url: string // base64 data URL
  type: string
  name: string
  kind: 'image' | 'pdf'
}

const EVAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    score: { type: 'integer' }, max_score: { type: 'integer' },
    overall: { type: 'string' }, structure: { type: 'string' },
    content_feedback: { type: 'string' },
    missing_points: { type: 'array', items: { type: 'string' } },
    value_addition: { type: 'array', items: { type: 'string' } },
    intro_body_conclusion: { type: 'string' }, facts_examples: { type: 'string' },
    language_presentation: { type: 'string' }, model_answer: { type: 'string' },
    page_comments: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { page: { type: 'integer' }, comments: { type: 'array', items: { type: 'string' } } },
        required: ['page', 'comments'],
      },
    },
  },
  required: ['score', 'max_score', 'overall', 'structure', 'content_feedback', 'missing_points', 'value_addition', 'intro_body_conclusion', 'facts_examples', 'language_presentation', 'model_answer', 'page_comments'],
}

function EvalReport({ ev, rec }: { ev: MainsEval; rec: MainsRecord }) {
  const li = (a: string[]) => (a ?? []).map((x, i) => <li key={i}>{x}</li>)

  async function downloadPDF(ts: number) {
    if (!window.jspdf) {
      alert('PDF library not loaded. Please reload the app.')
      return
    }
    const record = await idbGet(ts)
    if (!record) return
    const { jsPDF } = window.jspdf as any
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const W = 595, H = 842, M = 40
    const wrap = (txt: string, w: number) => doc.splitTextToSize(String(txt ?? ''), w)
    // Cover
    doc.setFillColor(122, 127, 201); doc.rect(0, 0, W, H, 'F')
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(26)
    doc.text('Penni — Mains Evaluation', M, 90)
    doc.setFontSize(13); doc.setFont('helvetica', 'normal')
    doc.text(wrap(record.qtext, W - 2 * M), M, 130)
    doc.setFontSize(64); doc.setFont('helvetica', 'bold')
    doc.text(`${ev.score}/${ev.max_score}`, M, 320)
    doc.setFontSize(12); doc.setFont('helvetica', 'normal')
    doc.text(wrap(ev.overall, W - 2 * M), M, 360)
    doc.setFontSize(9)
    doc.text(`Evaluated ${new Date(record.ts).toLocaleString('en-IN')} · model: claude-opus-4-8`, M, H - 40)
    // Answer pages with margin comments
    record.images.forEach((img: string, i: number) => {
      doc.addPage()
      const imgW = W * 0.62, imgH = H - 2 * M
      try {
        doc.addImage(img, img.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, M, imgW, imgH, undefined, 'FAST')
      } catch {}
      const cx = M + imgW + 14, cw = W - cx - M
      doc.setFillColor(246, 214, 107); doc.roundedRect(cx, M, cw, 24, 6, 6, 'F')
      doc.setTextColor(60, 50, 10); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(`Page ${i + 1} remarks`, cx + 8, M + 16)
      doc.setTextColor(40); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      let y = M + 40
      const pc = (ev.page_comments.find(p => p.page === i + 1) ?? { comments: [] }).comments
      pc.forEach((cmt: string) => {
        const lines = wrap('• ' + cmt, cw - 6)
        if (y + lines.length * 11 > H - M) return
        doc.text(lines, cx + 2, y); y += lines.length * 11 + 8
      })
    })
    // Feedback pages
    const sections: [string, string][] = [
      ['Structure', ev.structure], ['Content', ev.content_feedback],
      ['Intro / Body / Conclusion', ev.intro_body_conclusion],
      ['Facts, examples & case studies', ev.facts_examples],
      ['Language & presentation', ev.language_presentation],
      ['Missing points', (ev.missing_points ?? []).map(x => '• ' + x).join('\n')],
      ['Value addition', (ev.value_addition ?? []).map(x => '• ' + x).join('\n')],
      ['Model answer', ev.model_answer],
    ]
    doc.addPage(); let y2 = M; doc.setTextColor(40)
    sections.forEach(([h, t]) => {
      const lines = wrap(t, W - 2 * M)
      if (y2 + 30 + lines.length * 12 > H - M) { doc.addPage(); y2 = M }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(108, 113, 196)
      doc.text(h, M, y2); y2 += 16
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40)
      doc.text(lines, M, y2); y2 += lines.length * 12 + 14
    })
    doc.save('penni-mains-evaluation.pdf')
  }

  return (
    <div className="pn-report" style={{ marginTop: 18 }}>
      <div className="pn-sec" style={{ marginBottom: 8 }}>Evaluation</div>
      <div className="pn-scorebox"><b>{ev.score}</b><span>/ {ev.max_score}</span></div>
      <p className="pn-overall">{ev.overall}</p>
      <div className="pn-rsec"><h5>Structure</h5><p>{ev.structure}</p></div>
      <div className="pn-rsec"><h5>Content</h5><p>{ev.content_feedback}</p></div>
      <div className="pn-rsec"><h5>Intro · Body · Conclusion</h5><p>{ev.intro_body_conclusion}</p></div>
      <div className="pn-rsec"><h5>Facts, examples &amp; case studies</h5><p>{ev.facts_examples}</p></div>
      <div className="pn-rsec"><h5>Language &amp; presentation</h5><p>{ev.language_presentation}</p></div>
      <div className="pn-rsec"><h5>Missing points</h5><ul>{li(ev.missing_points)}</ul></div>
      <div className="pn-rsec"><h5>Value addition</h5><ul>{li(ev.value_addition)}</ul></div>
      <div className="pn-rsec"><h5>Model answer</h5><p style={{ whiteSpace: 'pre-wrap' }}>{ev.model_answer}</p></div>
      <button className="pn-btn" onClick={() => downloadPDF(rec.ts)}>
        <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: 8 }} />
        Download annotated PDF
      </button>
    </div>
  )
}

export function MainsDetail({ question, onClose, onShowToast, onOpenSettings }: MainsDetailProps) {
  const { settings, mainsQuota, incrementMainsQuota } = usePracticeStore()
  const [uploads, setUploads] = useState<UploadedAnswer[]>([])
  const [busy, setBusy] = useState(false)
  const [evalResult, setEvalResult] = useState<{ ev: MainsEval; rec: MainsRecord } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const left = 5 - (mainsQuota[TODAY] ?? 0)

  function addUploads(files: FileList | null) {
    if (!files) return
    const remaining = 4 - uploads.length
    const toProcess = Array.from(files).slice(0, remaining)
    toProcess.forEach(f => {
      if (f.type === 'application/pdf') {
        const rd = new FileReader()
        rd.onload = () => {
          setUploads(prev => [...prev, {
            url: rd.result as string,
            type: 'application/pdf',
            name: f.name,
            kind: 'pdf',
          }])
        }
        rd.onerror = () => onShowToast('Could not read that PDF')
        rd.readAsDataURL(f)
        return
      }

      if (!f.type.startsWith('image/')) {
        onShowToast('Use image files or PDF')
        return
      }

      const rd = new FileReader()
      rd.onload = () => {
        const im = new Image()
        im.onload = () => {
          const max = 1600
          const sc = Math.min(1, max / Math.max(im.width, im.height))
          const cv = document.createElement('canvas')
          cv.width = Math.round(im.width * sc)
          cv.height = Math.round(im.height * sc)
          cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height)
          setUploads(prev => [...prev, {
            url: cv.toDataURL('image/jpeg', 0.85),
            type: 'image/jpeg',
            name: f.name,
            kind: 'image',
          }])
        }
        im.onerror = () => onShowToast('Could not read that image')
        im.src = rd.result as string
      }
      rd.readAsDataURL(f)
    })
  }

  function removeUpload(i: number) {
    setUploads(prev => prev.filter((_, idx) => idx !== i))
  }

  async function evaluate() {
    if (!settings.key || !uploads.length || left <= 0) return
    setBusy(true); setErrorMsg('')
    const uploadBlocks = uploads.map(u => (
      u.kind === 'pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: u.url.split(',')[1] },
          }
        : {
            type: 'image',
            source: { type: 'base64', media_type: u.type, data: u.url.split(',')[1] },
          }
    ))
    const content: any[] = [...uploadBlocks, {
      type: 'text',
      text: `You are a strict but constructive UPSC Mains examiner. Evaluate the uploaded handwritten or typed answer against this question (15 marks, GS standard):\n\n"${question.q}"\n\n${question.keyPoints ? 'Key points a good answer covers: ' + question.keyPoints.join('; ') : ''}\n\nRead the uploaded answer carefully, whether it is provided as page images or a PDF document. Score out of 15. Give specific, actionable feedback grounded in what is actually written. page_comments must have one entry per visible page or uploaded file section you can inspect, with 2-4 margin-style remarks tied to that content.`,
    }]
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 8000,
          output_config: { format: { type: 'json_schema', schema: EVAL_SCHEMA } },
          messages: [{ role: 'user', content }],
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as any
        throw new Error((e.error?.message) ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as any
      if (data.stop_reason === 'refusal') throw new Error('The evaluation was declined. Try another question.')
      const txt = (data.content?.find((b: any) => b.type === 'text') ?? {}).text ?? '{}'
      const ev: MainsEval = JSON.parse(txt)
      incrementMainsQuota()
      const rec: MainsRecord = {
        ts: Date.now(),
        qid: question.id,
        qtext: question.q,
        images: uploads.filter(u => u.kind === 'image').map(u => u.url),
        eval: ev,
      }
      await idbPut(rec)
      setEvalResult({ ev, rec })
      onShowToast('Evaluation saved to your profile')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err).slice(0, 220))
    } finally {
      setBusy(false)
    }
  }

  const canEval = !!settings.key && uploads.length > 0 && left > 0 && !busy

  return (
    <div className="quiz-overlay">
      <div className="quiz-header">
        <span className="qz-title">Mains Writing</span>
        <button className="icon-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="quiz-body">
        {/* Quota badge */}
        <div className={`pn-quota ${left > 0 ? '' : 'out'}`}>
          <FontAwesomeIcon icon={faCloudArrowUp} />
          {' '}{left > 0 ? `${left} of 5 evaluations left today` : 'Daily limit reached — resets tomorrow'}
        </div>

        {/* API key warning */}
        {!settings.key && (
          <div className="pn-warn" onClick={onOpenSettings} style={{ cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faKey} />
            {' '}Add your Claude API key in Settings to enable AI evaluation
          </div>
        )}

        {/* Question */}
        <div className="pn-qcard" style={{ cursor: 'default', marginTop: 12 }}>
          <div className="pn-qcard-top">
            <span className="pv-tag subject">{question.subject || 'GS'}</span>
            <span className="qz-src">{question.srcLabel}</span>
          </div>
          <p style={{ fontWeight: 800 }}>{question.q}</p>
          {question.keyPoints && (
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink2)' }}>
              {question.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          )}
        </div>

        {/* Upload area */}
        <div className="pn-sec" style={{ marginTop: 16 }}>
          Your answer <span>(photos or PDF, up to 4 files)</span>
        </div>
        <div className="pn-ups">
          {uploads.map((u, i) => (
            <div className={`pn-up ${u.kind === 'pdf' ? 'pdf' : ''}`} key={`${u.name}-${i}`}>
              {u.kind === 'pdf' ? (
                <div className="pn-pdf-tile">
                  <FontAwesomeIcon icon={faFilePdf} />
                  <span>{u.name}</span>
                </div>
              ) : (
                <img src={u.url} alt={`Page ${i + 1}`} />
              )}
              <button onClick={() => removeUpload(i)} aria-label="Remove">×</button>
            </div>
          ))}
          {uploads.length < 4 && (
            <label className="pn-add">
              <FontAwesomeIcon icon={faPlus} />
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={e => addUploads(e.target.files)}
              />
            </label>
          )}
        </div>

        {/* Evaluate button */}
        {busy ? (
          <div className="pn-busy">
            <FontAwesomeIcon icon={faCircleNotch} spin />
            {' '}Evaluating with Claude — this can take a minute…
          </div>
        ) : (
          <>
            <button className="pn-btn" disabled={!canEval} onClick={evaluate}>
              <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 8 }} />
              Evaluate my answer ({left} left today)
            </button>
            {!settings.key && <p className="pn-note">Add your API key in Settings first.</p>}
            {!uploads.length && <p className="pn-note">Add at least one page photo or PDF.</p>}
          </>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="pn-warn" style={{ marginTop: 12 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} /> {errorMsg}
          </div>
        )}

        {/* Eval report */}
        {evalResult && <EvalReport ev={evalResult.ev} rec={evalResult.rec} />}
      </div>
    </div>
  )
}

// Extend window for jspdf vendor lib
declare global {
  interface Window { jspdf: any }
}
