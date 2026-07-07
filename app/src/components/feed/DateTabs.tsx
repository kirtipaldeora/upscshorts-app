import { useAppStore } from '@/stores/useAppStore'
import { fmtShort, dayName, TODAY, YESTERDAY } from '@/constants/categories'

interface DateTabsProps {
  dates: string[]
}

export function DateTabs({ dates }: DateTabsProps) {
  const { selectedDate, setSelectedDate } = useAppStore()

  function label(d: string) {
    if (d === TODAY) return 'Today'
    if (d === YESTERDAY) return 'Yesterday'
    return fmtShort(d)
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '2px 20px 12px',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {dates.map((d) => {
        const active = d === selectedDate
        return (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            style={{
              padding: '9px 16px',
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: active ? '1px solid transparent' : '1px solid var(--panel-border)',
              background: active ? '#fff' : 'var(--panel2)',
              backdropFilter: 'blur(12px)',
              borderRadius: 20,
              transition: 'all 0.25s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.25,
              letterSpacing: 0.3,
              color: active ? '#4A4E8C' : 'var(--on2)',
              boxShadow: active ? 'var(--shadow-soft)' : 'none',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 9,
                fontWeight: 700,
                opacity: 0.6,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {dayName(d)}
            </span>
            {label(d)}
          </button>
        )
      })}
    </div>
  )
}
