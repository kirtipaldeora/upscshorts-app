import { useEffect, useState, useCallback } from 'react'

interface ToastProps {
  message: string | null
  onClear: () => void
}

export function Toast({ message, onClear }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onClear, 300)
    }, 2000)
    return () => clearTimeout(t)
  }, [message, onClear])

  if (!message) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
        background: '#fff',
        color: '#4A4E8C',
        padding: '11px 22px',
        borderRadius: 20,
        fontSize: 12.5,
        fontWeight: 800,
        zIndex: 500,
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow)',
      }}
    >
      {message}
    </div>
  )
}

// ─── Toast Manager Hook ───────────────────────────────────────
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  const show = useCallback((msg: string) => {
    setMessage(msg)
  }, [])

  const clear = useCallback(() => {
    setMessage(null)
  }, [])

  return { message, show, clear }
}
