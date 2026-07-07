import { useState, useEffect, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faMagnifyingGlass, faBookmark } from '@fortawesome/free-solid-svg-icons'
import { useAppStore } from '@/stores/useAppStore'

interface PYQQuestion {
  id: string
  year: number
  exam: 'prelims' | 'mains'
  subject: string
  paper?: string
  question: string
  options?: string[]
  answer?: string | number
  explanation?: string
}

export function PYQVault() {
  const { setOverlay } = useAppStore()
  const [data, setData] = useState<PYQQuestion[]>([])
  const [query, setQuery] = useState('')
  const [exam, setExam] = useState<'all' | 'prelims' | 'mains'>('all')
  const [activeYear, setActiveYear] = useState<number | 'all'>('all')
  const [activeSubject, setActiveSubject] = useState<string | 'all'>('all')
  const [bookmarked, setBookmarked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('u4pyqbm') || '[]') } catch { return [] }
  })
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/data/pyq-data.json')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const pool = useMemo(() => exam === 'all' ? data : data.filter((q) => q.exam === exam), [data, exam])
  const years = useMemo(() => [...new Set(pool.map((q) => q.year))].sort((a, b) => b - a), [pool])
  const subjects = useMemo(() => [...new Set(pool.map((q) => q.subject))].sort(), [pool])

  const results = useMemo(() => {
    const q = query.toLowerCase()
    return pool.filter((item) => {
      const matchYear = activeYear === 'all' || item.year === activeYear
      const matchSub = activeSubject === 'all' || item.subject === activeSubject
      const matchQ = !q || item.question.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)
      return matchYear && matchSub && matchQ
    })
  }, [pool, activeYear, activeSubject, query])

  function toggleBm(id: string) {
    setBookmarked((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
      try { localStorage.setItem('u4pyqbm', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function chip(label: string, active: boolean, onClick: () => void) {
    return (
      <button
        key={label}
        onClick={onClick}
        style={{
          flexShrink: 0,
          padding: '8px 15px',
          borderRadius: 18,
          fontSize: 12,
          fontWeight: 700,
          border: active ? '1px solid transparent' : '1px solid var(--panel-border)',
          background: active ? '#fff' : 'var(--panel2)',
          color: active ? '#4A4E8C' : 'var(--on2)',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 300,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
        transform: 'translateX(0)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 0', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <button onClick={() => setOverlay(null)} className="icon-btn">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
      </div>

      <div style={{ padding: '2px 20px 12px', position: 'relative', zIndex: 2, textAlign: 'center', marginTop: -42, pointerEvents: 'none' }}>
        <p style={{ fontSize: 12, color: 'var(--on2)', fontWeight: 700, marginBottom: 2 }}>Practice previous years 📝</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.08, color: 'var(--on)' }}>
          PYQ <span style={{ color: 'var(--yellow)' }}>Vault</span>
        </h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 60px', position: 'relative', zIndex: 2 }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)', backdropFilter: 'blur(16px)', borderRadius: 20, padding: '13px 17px', marginBottom: 12 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: 'var(--on2)', fontSize: 14 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions, subjects..." style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--on)', fontFamily: 'Nunito, sans-serif', fontSize: 14.5, fontWeight: 600 }} />
        </div>

        {/* Exam tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['all', 'prelims', 'mains'] as const).map((e) => (
            <button key={e} onClick={() => setExam(e)} style={{ flex: 1, textAlign: 'center', padding: 11, borderRadius: 18, border: exam === e ? '1px solid transparent' : '1px solid var(--panel-border)', background: exam === e ? '#fff' : 'var(--panel2)', backdropFilter: 'blur(12px)', color: exam === e ? '#4A4E8C' : 'var(--on2)', fontSize: 13, fontWeight: 800, transition: 'all 0.25s', cursor: 'pointer' }}>
              {e === 'all' ? 'All' : e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>

        {/* Year + Subject chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 2, scrollbarWidth: 'none' }}>
          {chip('All Years', activeYear === 'all', () => setActiveYear('all'))}
          {years.map((y) => chip(String(y), activeYear === y, () => setActiveYear(y)))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 2, scrollbarWidth: 'none' }}>
          {chip('All Subjects', activeSubject === 'all', () => setActiveSubject('all'))}
          {subjects.map((s) => chip(s, activeSubject === s, () => setActiveSubject(s)))}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--on2)', margin: '4px 4px 12px', fontWeight: 800 }}>
          {results.length} question{results.length !== 1 ? 's' : ''}
        </p>

        {/* Questions */}
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--on2)', fontWeight: 700 }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.5 }} />
            No questions match your filters.
          </div>
        ) : (
          results.map((q) => {
            const isBm = bookmarked.includes(q.id)
            const isRevealed = revealed.has(q.id)
            return (
              <div key={q.id} style={{ background: 'var(--card)', borderRadius: 26, padding: 18, marginBottom: 12, boxShadow: 'var(--shadow-soft)', animation: 'cardIn 0.45s cubic-bezier(0.22,1,0.36,1) both', color: 'var(--ink)' }}>
                {/* Tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', padding: '5px 11px', borderRadius: 12, background: 'rgba(108,113,196,.14)', color: 'var(--acc)' }}>{q.year}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', padding: '5px 11px', borderRadius: 12, background: 'rgba(76,175,130,.15)', color: 'var(--good)' }}>{q.exam}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', padding: '5px 11px', borderRadius: 12, background: 'var(--card2)', color: 'var(--ink2)' }}>{q.subject}</span>
                  <button onClick={() => toggleBm(q.id)} style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBm ? 'var(--yellow)' : 'var(--card2)', color: isBm ? 'var(--yellow-ink)' : 'var(--ink2)', fontSize: 14 }}>
                    <FontAwesomeIcon icon={faBookmark} />
                  </button>
                </div>

                {/* Question */}
                <p style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 800, marginBottom: 14, color: 'var(--ink)' }}>{q.question}</p>

                {/* Options */}
                {q.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                    {q.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx)
                      const isCorrect = isRevealed && q.answer === letter
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 16, border: isCorrect ? '1.5px solid var(--good)' : '1.5px solid var(--border)', background: isCorrect ? 'rgba(76,175,130,.12)' : 'var(--card2)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                          <span style={{ width: 24, height: 24, borderRadius: 9, border: isCorrect ? 'none' : '1.5px solid var(--border)', background: isCorrect ? 'var(--good)' : 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 900, color: isCorrect ? '#fff' : 'var(--ink2)', flexShrink: 0 }}>
                            {letter}
                          </span>
                          {opt}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Reveal / Explanation */}
                {!isRevealed ? (
                  <button onClick={() => toggleReveal(q.id)} style={{ background: 'var(--yellow)', color: 'var(--yellow-ink)', border: 'none', borderRadius: 16, padding: '11px 18px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                    Reveal Answer
                  </button>
                ) : q.explanation ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px dashed var(--border)', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65, fontWeight: 600 }}>
                    <strong style={{ color: 'var(--ink)' }}>Explanation: </strong>
                    {q.explanation}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
