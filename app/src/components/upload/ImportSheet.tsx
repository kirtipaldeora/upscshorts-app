import { useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport, faCircleCheck, faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'
import type { ArticlesByDate } from '@/types/article'
import { contentQualityIssues } from '@/utils/questionQuality'

interface ImportSheetProps {
  visible: boolean
  onClose: () => void
  onShowToast: (msg: string) => void
}

type ImportPhase = 'idle' | 'processing' | 'success'

export function ImportSheet({ visible, onClose, onShowToast }: ImportSheetProps) {
  const { mergeArticles } = useAppStore()
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [addedCount, setAddedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleClose() {
    setPhase('idle')
    setAddedCount(0)
    onClose()
  }

  async function processFile(file: File) {
    setPhase('processing')
    try {
      const text = await file.text()
      const data: ArticlesByDate = JSON.parse(text)
      const count = Object.values(data).flat().length
      const qualityIssues = contentQualityIssues(data)
      mergeArticles(data)
      setAddedCount(count)
      setPhase('success')
      if (qualityIssues.length > 0) {
        const prelims = qualityIssues.filter(issue => issue.field === 'prelims').length
        const deepDive = qualityIssues.filter(issue => issue.field === 'deepDive').length
        const audio = qualityIssues.filter(issue => issue.field === 'audio').length
        onShowToast(`Quality check: ${prelims} prelims, ${deepDive} deep dives, ${audio} audio scripts need improvement`)
      }
    } catch {
      setPhase('idle')
      onShowToast('Invalid JSON file')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.json')) processFile(file)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: 'var(--overlay)',
          backdropFilter: 'blur(6px)',
          display: visible ? 'block' : 'none',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${visible ? 0 : '100%'})`,
          width: '100%',
          maxWidth: 480,
          background: 'var(--card)',
          borderRadius: '30px 30px 0 0',
          padding: 22,
          maxHeight: '85vh',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          color: 'var(--ink)',
          zIndex: 200,
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', margin: '0 auto 18px' }} />

        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 3, color: 'var(--ink)' }}>Import Content</h3>
        <p style={{ fontSize: 12, marginBottom: 14, color: 'var(--ink2)' }}>Add a generated JSON with shorts, Deep Dives, questions, and Penni Explain scripts</p>

        {phase === 'idle' && (
          <>
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--acc)' : 'var(--border)'}`,
                borderRadius: 22,
                padding: '30px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 14,
                background: isDragOver ? 'rgba(108,113,196,0.05)' : 'transparent',
              }}
            >
              <FontAwesomeIcon icon={faFileImport} style={{ fontSize: 28, color: 'var(--ink3)', marginBottom: 8, display: 'block' }} />
              <p style={{ color: 'var(--ink2)', fontSize: 13, fontWeight: 600 }}>
                Tap to select or <strong style={{ color: 'var(--acc)' }}>drag & drop</strong> a{' '}
                <span style={{ color: 'var(--acc)', fontWeight: 800 }}>Penni JSON</span> file
              </p>
              <p style={{ fontSize: 11, marginTop: 4, color: 'var(--ink3)' }}>Every article should include a Penni Explain audioScript</p>
            </div>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileChange} />
          </>
        )}

        {phase === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Reading file', 'Parsing data', 'Merging articles'].map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, background: 'var(--card2)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: 'rgba(108,113,196,.15)', color: 'var(--acc)' }}>
                  <FontAwesomeIcon icon={faCircleNotch} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--acc)' }}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {phase === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 38, color: 'var(--good)' }} />
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>Feed Updated</h3>
            <p style={{ color: 'var(--ink2)', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
              {addedCount} article{addedCount !== 1 ? 's' : ''} added to your feed
            </p>
            <button
              onClick={handleClose}
              style={{ marginTop: 8, padding: '13px 32px', borderRadius: 20, background: 'var(--yellow)', color: 'var(--yellow-ink)', fontSize: 13, fontWeight: 900, border: 'none', cursor: 'pointer' }}
            >
              View in Feed
            </button>
          </div>
        )}
      </div>
    </>
  )
}
