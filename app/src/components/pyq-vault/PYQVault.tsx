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

interface DropdownProps<T> {
  value: T
  options: { value: T; label: string }[]
  onChange: (val: T) => void
  isOpen: boolean
  setOpen: (open: boolean) => void
  placeholder: string
}

function CustomDropdown<T extends string | number>({
  value,
  options,
  onChange,
  isOpen,
  setOpen,
  placeholder,
}: DropdownProps<T>) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {/* Dropdown Button */}
      <button
        onClick={() => setOpen(!isOpen)}
        style={{
          width: '100%',
          height: 40,
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          color: 'var(--on)',
          fontFamily: 'Nunito, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '82%', textAlign: 'left' }}>
          {selectedLabel}
        </span>
        <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>

      {/* Floating Options Menu */}
      {isOpen && (
        <>
          {/* Backdrop click closer */}
          <div 
            onClick={() => setOpen(false)} 
            style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--card)',
              border: '1px solid var(--panel-border)',
              borderRadius: 16,
              boxShadow: 'var(--shadow)',
              zIndex: 999,
              padding: '6px 0',
              animation: 'scrIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 16px',
                    textAlign: 'left',
                    background: isSelected ? 'rgba(233, 185, 59, 0.12)' : 'transparent',
                    border: 'none',
                    color: isSelected ? 'var(--yellow)' : 'var(--ink)',
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 13,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--card2)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
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
  const [yearOpen, setYearOpen] = useState(false)
  const [subjectOpen, setSubjectOpen] = useState(false)

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

  const yearOptions = useMemo(() => [
    { value: 'all' as const, label: 'All Years' },
    ...years.map((y) => ({ value: y, label: String(y) }))
  ], [years])

  const subjectOptions = useMemo(() => [
    { value: 'all' as const, label: 'All Subjects' },
    ...subjects.map((s) => ({ value: s, label: s }))
  ], [subjects])

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
          padding: '7px 14px',
          borderRadius: 15,
          fontSize: 11.5,
          fontWeight: 700,
          border: active ? '1px solid transparent' : '1px solid var(--panel-border)',
          background: active ? '#fff' : 'var(--panel)',
          color: active ? '#4A4E8C' : 'var(--on2)',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          boxShadow: active ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
          transform: active ? 'scale(1.02)' : 'scale(1)',
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = active ? 'scale(1.02)' : 'scale(1)';
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
      {/* Header with Title, Subtitle, and Inline Search Bar */}
      <div className="ma-header" style={{ height: 'auto', padding: '10px 18px', gap: 12, display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setOverlay(null)} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 100 }}>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: 'var(--on)', margin: 0, whiteSpace: 'nowrap' }}>
            PYQ <span style={{ color: 'var(--yellow)' }}>Vault</span>
          </h2>
          <span style={{ fontSize: 10.5, color: 'var(--on2)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Practice years 📝
          </span>
        </div>

        {/* Small Inline Search Bar */}
        <div 
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            background: 'var(--panel)', 
            border: '1px solid var(--panel-border)', 
            backdropFilter: 'blur(16px)', 
            borderRadius: 16, 
            padding: '8px 12px',
            marginLeft: 8,
          }}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: 'var(--on2)', fontSize: 12 }} />
          <input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Search PYQs..." 
            style={{ 
              width: '100%', 
              background: 'none', 
              border: 'none', 
              outline: 'none', 
              color: 'var(--on)', 
              fontFamily: 'Nunito, sans-serif', 
              fontSize: 12.5, 
              fontWeight: 600 
            }} 
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 60px', position: 'relative', zIndex: 2 }}>

        {/* Exam tabs (Capsule Segmented Control) */}
        <div 
          style={{ 
            display: 'flex', 
            background: 'var(--panel)', 
            border: '1px solid var(--panel-border)', 
            backdropFilter: 'blur(16px)', 
            borderRadius: 20, 
            padding: 4, 
            marginBottom: 14 
          }}
        >
          {(['all', 'prelims', 'mains'] as const).map((e) => {
            const isSel = exam === e
            return (
              <button 
                key={e} 
                onClick={() => setExam(e)} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  padding: '9px 0', 
                  borderRadius: 16, 
                  border: 'none', 
                  background: isSel ? '#fff' : 'transparent', 
                  color: isSel ? '#4A4E8C' : 'var(--on2)', 
                  fontSize: 12.5, 
                  fontWeight: 800, 
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                  cursor: 'pointer',
                  boxShadow: isSel ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {e === 'all' ? 'All' : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            )
          })}
        </div>

        {/* Year + Subject Select Dropdowns (Side-by-Side Compact Custom Layout) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, position: 'relative', zIndex: 10 }}>
          {/* Year Custom Dropdown */}
          <CustomDropdown
            value={activeYear}
            options={yearOptions}
            onChange={(val) => setActiveYear(val)}
            isOpen={yearOpen}
            setOpen={(open) => {
              setYearOpen(open)
              if (open) setSubjectOpen(false) // Close subject dropdown if year is clicked
            }}
            placeholder="All Years"
          />

          {/* Subject Custom Dropdown */}
          <CustomDropdown
            value={activeSubject}
            options={subjectOptions}
            onChange={(val) => setActiveSubject(val)}
            isOpen={subjectOpen}
            setOpen={(open) => {
              setSubjectOpen(open)
              if (open) setYearOpen(false) // Close year dropdown if subject is clicked
            }}
            placeholder="All Subjects"
          />
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
